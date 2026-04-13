// 云函数：joinGame
// 功能：玩家通过邀请码或 gameId 加入牌局
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameId, inviteCode } = event;

  try {
    // 通过 gameId 或 inviteCode 查找牌局
    let game;
    let docId;

    if (gameId) {
      const res = await db.collection('games').doc(gameId).get();
      game = res.data;
      docId = gameId;
    } else if (inviteCode) {
      const res = await db.collection('games')
        .where({ inviteCode: inviteCode.toUpperCase(), status: 'waiting' })
        .limit(1)
        .get();
      if (!res.data || res.data.length === 0) {
        return { success: false, message: '邀请码无效或牌局已开始' };
      }
      game = res.data[0];
      docId = game._id;
    } else {
      return { success: false, message: '缺少 gameId 或 inviteCode' };
    }

    if (!game) return { success: false, message: '牌局不存在' };
    if (game.status !== 'waiting') return { success: false, message: '牌局已开始或已结束' };
    if (game.players.length >= 4) return { success: false, message: '牌局已满员（4人）' };

    // 已经在牌局中，直接返回
    if (game.players.some(p => p.openid === OPENID)) {
      return { success: true, data: { gameId: docId, message: '已在牌局中' } };
    }

    // 查询用户信息
    const userRes = await db.collection('users').where({ openid: OPENID }).limit(1).get();
    if (!userRes.data || userRes.data.length === 0) {
      return { success: false, message: '请先登录' };
    }
    const user = userRes.data[0];

    const position = game.players.length; // 0,1,2,3
    // 位置0,2 → A队；位置1,3 → B队
    const team = (position === 0 || position === 2) ? 'A' : 'B';

    await db.collection('games').doc(docId).update({
      data: {
        players: _.push({
          openid: OPENID,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl || '',
          team,
          position,
          isHost: false,
        }),
        updatedAt: db.serverDate(),
      }
    });

    return { success: true, data: { gameId: docId, position, team } };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
