// 云函数：updateGameSettings
// 功能：房主实时修改计划局数和当前级牌
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameId, targetRounds, currentLevel } = event;

  try {
    const { data: game } = await db.collection('games').doc(gameId).get();
    if (!game) return { success: false, message: '牌局不存在' };
    if (game.hostOpenid !== OPENID) {
      return { success: false, message: '只有房主可修改设置' };
    }
    if (game.status !== 'playing') {
      return { success: false, message: '牌局未在进行中' };
    }

    const updateData = { updatedAt: db.serverDate() };

    if (targetRounds !== undefined) {
      // 计划局数不能小于当前已进行的局数
      const minRounds = game.currentRound - 1; // currentRound 是下一局，已完成 currentRound-1 局
      if (targetRounds < minRounds || targetRounds < 1) {
        return { success: false, message: `计划局数不能小于已完成的 ${minRounds} 局` };
      }
      updateData.targetRounds = targetRounds;
    }

    const validLevels = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    if (currentLevel !== undefined) {
      if (!validLevels.includes(String(currentLevel))) {
        return { success: false, message: '无效的级牌' };
      }
      updateData.currentLevel = currentLevel;
    }

    await db.collection('games').doc(gameId).update({ data: updateData });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
