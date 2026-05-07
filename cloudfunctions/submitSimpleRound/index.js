// 云函数：submitSimpleRound
// 功能：简易模式提交单局记分（选2名得分者 + 分值，每人各得该分）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  // scorerIndexes: 得分者在 players 数组中的下标，长度必须为 2
  // points: 本局分值，每人各得
  const { gameId, roundNumber, scorerIndexes, points } = event;

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

    if (!scorerIndexes || scorerIndexes.length !== 2) {
      return { success: false, message: '请选择2名得分者' };
    }

    const scorerSet = new Set(scorerIndexes);

    // 更新玩家积分
    const updatedPlayers = game.players.map((p, i) => ({
      ...p,
      score: (p.score || 0) + (scorerSet.has(i) ? points : 0),
    }));

    const newRound = {
      roundNumber,
      scorerIndexes,
      points,
      // 简易模式标识
      mode: 'simple',
      recordedBy: OPENID,
      createdAt: new Date(),
    };

    await db.collection('games').doc(gameId).update({
      data: {
        rounds: _.push(newRound),
        currentRound: roundNumber + 1,
        players: updatedPlayers,
        updatedAt: db.serverDate(),
      }
    });

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
