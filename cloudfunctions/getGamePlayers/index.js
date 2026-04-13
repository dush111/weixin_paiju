// 云函数：getGamePlayers
// 功能：获取牌局当前玩家列表（用于轮询）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { gameId } = event;
  try {
    const { data: game } = await db.collection('games').doc(gameId).get();
    return {
      success: true,
      data: {
        players: game.players,
        status: game.status
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
