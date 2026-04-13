// 云函数：getGameInfo
// 功能：获取牌局基础信息（等待室用）
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
        name: game.name,
        code: game.code,
        players: game.players,
        status: game.status,
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
