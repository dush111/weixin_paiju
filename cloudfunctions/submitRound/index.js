// 云函数：submitRound
// 功能：提交单局积分（核心逻辑）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameId, roundNumber, ranks, scoreA, scoreB, caseText } = event;

  try {
    const { data: game } = await db.collection('games').doc(gameId).get();

    if (game.status !== 'playing') {
      return { success: false, message: '牌局未在进行中' };
    }

    // 只有房主或指定玩家可记分（此处允许所有参与者记分）
    const isPlayer = game.players.some(p => p.openid === OPENID);
    if (!isPlayer) {
      return { success: false, message: '非牌局参与者' };
    }

    // 幂等校验：同一局编号已存在则直接返回成功，防止并发重复提交
    const alreadyExists = (game.rounds || []).some(r => r.roundNumber === roundNumber);
    if (alreadyExists) {
      return { success: true, duplicate: true, message: '该局已记录，请勿重复提交' };
    }

    const newRound = {
      roundNumber,
      ranks, // [rank1_playerIndex, rank2_playerIndex, rank3_playerIndex, rank4_playerIndex]
      scoreA,
      scoreB,
      caseText,
      recordedBy: OPENID,
      createdAt: new Date(),
    };

    const newTeamAScore = game.teamAScore + scoreA;
    const newTeamBScore = game.teamBScore + scoreB;
    const newCurrentRound = roundNumber + 1;
    const gameOver = roundNumber >= game.targetRounds;

    // 名次对应本局积分：第1名30、第2名15、第3名5、第4名1
    const RANK_SCORES = [30, 15, 5, 1];

    // 同步更新每位玩家的个人积分
    const updatedPlayers = game.players.map((p, idx) => {
      const rankPos = ranks.indexOf(idx); // 0=第一名，1=第二名...
      const playerScore = RANK_SCORES[rankPos] !== undefined ? RANK_SCORES[rankPos] : 1;
      return {
        ...p,
        score: (p.score || 0) + playerScore,
        lastRank: rankPos + 1,
      };
    });

    await db.collection('games').doc(gameId).update({
      data: {
        rounds: _.push(newRound),
        teamAScore: newTeamAScore,
        teamBScore: newTeamBScore,
        currentRound: gameOver ? roundNumber : newCurrentRound,
        status: gameOver ? 'finished' : 'playing',
        players: updatedPlayers,
        updatedAt: db.serverDate(),
        ...(gameOver ? { endedAt: db.serverDate() } : {})
      }
    });

    // 如果游戏结束，更新所有玩家的统计数据
    if (gameOver) {
      await updatePlayerStats(game, newTeamAScore, newTeamBScore, updatedPlayers, ranks);
    }

    return {
      success: true,
      data: {
        gameOver,
        winner: gameOver ? (newTeamAScore >= newTeamBScore ? 'A' : 'B') : null,
        finalScoreA: newTeamAScore,
        finalScoreB: newTeamBScore,
      }
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};

// 游戏结束后更新玩家统计
// ranks: [rank1_playerIdx, rank2_playerIdx, ...] 按名次排列
async function updatePlayerStats(game, finalA, finalB, updatedPlayers, ranks) {
  const RANK_SCORES = [30, 15, 5, 1];
  const winningTeam = finalA >= finalB ? 'A' : 'B';

  const updates = updatedPlayers.map(async (player, idx) => {
    const rankPos = ranks.indexOf(idx);
    const rankScore = RANK_SCORES[rankPos] !== undefined ? RANK_SCORES[rankPos] : 1;
    const isWinner = player.team === winningTeam;
    await db.collection('users').where({ openid: player.openid }).update({
      data: {
        totalGames: db.command.inc(1),
        wins: db.command.inc(isWinner ? 1 : 0),
        updatedAt: db.serverDate(),
      }
    });
  });

  await Promise.all(updates);
}
