// 云函数：getGameDetail
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { gameId } = event;
  try {
    const { data: game } = await db.collection('games').doc(gameId).get();
    return { success: true, data: game };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
