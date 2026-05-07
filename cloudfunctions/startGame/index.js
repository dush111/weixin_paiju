// 云函数：startGame
// 功能：房主开始牌局，支持机器人填满4人
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameId, filledPlayers } = event;

  try {
    const { data: game } = await db.collection('games').doc(gameId).get();

    if (game.hostOpenid !== OPENID) {
      return { success: false, message: '只有房主才能开始游戏' };
    }
    if (game.status !== 'waiting') {
      return { success: false, message: '牌局状态异常' };
    }
    if (!filledPlayers || filledPlayers.length !== 4) {
      return { success: false, message: '需要4名玩家才能开始' };
    }

    const finalPlayers = filledPlayers.map((p, i) => ({
      openid: p.openid || `bot_${i}`,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl || '',
      isBot: p.isBot || false,
      isHost: i === 0,
      position: i,
      seatId: `seat_${i}`,   // 牌局内唯一座位标识，永久绑定，不随数组排序变化
      score: 0,
    }));

    await db.collection('games').doc(gameId).update({
      data: {
        players: finalPlayers,
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
