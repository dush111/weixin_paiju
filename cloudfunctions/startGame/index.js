// 云函数：startGame
// 功能：房主开始牌局
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameId } = event;

  try {
    const { data: game } = await db.collection('games').doc(gameId).get();

    if (game.hostOpenid !== OPENID) {
      return { success: false, message: '只有房主才能开始游戏' };
    }
    if (game.players.length < 4) {
      return { success: false, message: '需要4名玩家才能开始' };
    }
    if (game.status !== 'waiting') {
      return { success: false, message: '牌局状态异常' };
    }

    await db.collection('games').doc(gameId).update({
      data: {
        status: 'playing',
        startedAt: db.serverDate(),
        updatedAt: db.serverDate(),
      }
    });

    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
