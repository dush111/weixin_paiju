// 云函数：updateGameSettings
// 功能：房主修改当前级牌
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameId, currentLevel } = event;

  try {
    const { data: game } = await db.collection('games').doc(gameId).get();
    if (!game) return { success: false, message: '牌局不存在' };
    if (game.hostOpenid !== OPENID) {
      return { success: false, message: '只有房主可修改设置' };
    }
    if (game.status !== 'playing') {
      return { success: false, message: '牌局未在进行中' };
    }

    const validLevels = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    if (currentLevel === undefined || !validLevels.includes(String(currentLevel))) {
      return { success: false, message: '无效的级牌' };
    }

    await db.collection('games').doc(gameId).update({
      data: { currentLevel, updatedAt: db.serverDate() }
    });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
