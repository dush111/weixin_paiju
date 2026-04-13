// 云函数：endGame
// 功能：提前结束牌局
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameId } = event;
  try {
    await db.collection('games').doc(gameId).update({
      data: {
        status: 'finished',
        endedAt: db.serverDate(),
        updatedAt: db.serverDate(),
      }
    });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
