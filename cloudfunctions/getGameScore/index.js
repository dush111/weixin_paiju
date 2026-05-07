// 云函数：getGameScore
// 功能：获取当前牌局记分数据（个人积分制）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { gameId } = event;
  try {
    const { data: game } = await db.collection('games').doc(gameId).get();

    // 按个人积分降序排序 players
    const players = [...(game.players || [])].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );

    return {
      success: true,
      data: {
        name: game.name,
        status: game.status,
        targetRounds: game.targetRounds,
        currentRound: game.currentRound,
        players,           // 已按积分排序
        rounds: game.rounds || [],
        currentLevel: game.currentLevel || '2',
        hostOpenid: game.hostOpenid,
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
