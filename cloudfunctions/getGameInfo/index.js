// 云函数：getGameInfo
// 功能：通过 gameId 或 inviteCode 获取牌局信息（加入牌局时预览用）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { gameId, inviteCode } = event;
  try {
    let game;

    if (gameId) {
      const res = await db.collection('games').doc(gameId).get();
      game = res.data;
    } else if (inviteCode) {
      const res = await db.collection('games')
        .where({ inviteCode: inviteCode.toUpperCase(), status: 'waiting' })
        .limit(1)
        .get();
      if (!res.data || res.data.length === 0) {
        return { success: false, message: '邀请码无效或牌局已开始' };
      }
      game = res.data[0];
    } else {
      return { success: false, message: '缺少参数' };
    }

    if (!game) return { success: false, message: '牌局不存在' };

    const ownerPlayer = (game.players || []).find(p => p.isHost);
    return {
      success: true,
      data: {
        _id: game._id,
        name: game.name,
        inviteCode: game.inviteCode,
        hostOpenid: game.hostOpenid,
        ownerName: ownerPlayer ? ownerPlayer.nickname : '未知',
        playerCount: game.players.length,
        totalRounds: game.totalRounds,
        players: game.players.map(p => ({ openid: p.openid, nickname: p.nickname, isHost: p.isHost, avatarUrl: p.avatarUrl })),
        status: game.status,
      }
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
