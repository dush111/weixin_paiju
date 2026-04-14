// 云函数：deleteGame
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameId } = event;
  try {
    const { data: game } = await db.collection('games').doc(gameId).get();
    if (!game) return { success: false, message: '牌局不存在' };
    if (game.hostOpenid !== OPENID) {
      return { success: false, message: '只有房主可删除牌局' };
    }
    // 四人已满且完成了全部计划局数的牌局不允许删除
    const roundCount = (game.rounds || []).length;
    const playerCount = (game.players || []).length;
    const isCompleted = game.status === 'finished'
      && playerCount === 4
      && roundCount >= (game.targetRounds || 1);
    if (isCompleted) {
      return { success: false, message: '已正常完成的牌局不可删除' };
    }
    await db.collection('games').doc(gameId).remove();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
