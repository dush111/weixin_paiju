// 云函数：cancelGame
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
      return { success: false, message: '只有房主可取消牌局' };
    }
    await db.collection('games').doc(gameId).update({
      data: { status: 'cancelled', updatedAt: db.serverDate() }
    });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
