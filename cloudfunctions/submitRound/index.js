// 云函数：submitRound
// 功能：提交单局积分（个人积分制，每局队友可变）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  // teamA/teamB: 本局队伍的 player 下标数组，如 [0,2] [1,3]
  const { gameId, roundNumber, ranks, teamA, teamB, caseText } = event;

  try {
    const { data: game } = await db.collection('games').doc(gameId).get();

    if (game.status !== 'playing') {
      return { success: false, message: '牌局未在进行中' };
    }

    const isPlayer = game.players.some(p => p.openid === OPENID);
    if (!isPlayer) {
      return { success: false, message: '非牌局参与者' };
    }

    // 幂等校验
    const alreadyExists = (game.rounds || []).some(r => r.roundNumber === roundNumber);
    if (alreadyExists) {
      return { success: true, duplicate: true, message: '该局已记录，请勿重复提交' };
    }

    // 根据名次和队伍分组计算本局每人得分
    // 规则：一二同队→300，一三同队→200，一四同队→100；胜队每人平分
    const teamASet = new Set(teamA);
    const teamBSet = new Set(teamB);

    const rank1 = ranks[0];
    const rank2 = ranks[1];
    const rank4 = ranks[3];

    const isSameTeam = (a, b) =>
      (teamASet.has(a) && teamASet.has(b)) || (teamBSet.has(a) && teamBSet.has(b));

    let totalScore = 0;
    if (isSameTeam(rank1, rank2)) {
      totalScore = 300;
    } else if (!isSameTeam(rank1, rank4)) {
      totalScore = 200;
    } else {
      totalScore = 100;
    }

    const perPersonScore = totalScore / 2;
    const firstTeamIsA = teamASet.has(rank1);
    const winTeam = firstTeamIsA ? teamASet : teamBSet;

    // 计算每位玩家本局 delta
    const playerDeltas = game.players.map((_, i) => winTeam.has(i) ? perPersonScore : 0);
    const playerDeltaNames = game.players.map(p => p.nickname);

    // 更新玩家积分
    const updatedPlayers = game.players.map((p, i) => ({
      ...p,
      score: (p.score || 0) + playerDeltas[i],
    }));

    const newRound = {
      roundNumber,
      ranks,
      teamA,
      teamB,
      caseText,
      playerDeltas,
      playerDeltaNames,
      recordedBy: OPENID,
      createdAt: new Date(),
    };

    const newCurrentRound = roundNumber + 1;

    await db.collection('games').doc(gameId).update({
      data: {
        rounds: _.push(newRound),
        currentRound: newCurrentRound,
        players: updatedPlayers,
        updatedAt: db.serverDate(),
      }
    });

    return {
      success: true,
      data: {
        gameOver: false,
      }
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
