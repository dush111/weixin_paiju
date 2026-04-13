// 云函数：joinGame
// 功能：玩家扫码/分享加入牌局
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameId } = event;

  try {
    const [gameRes, userRes] = await Promise.all([
      db.collection('games').doc(gameId).get(),
      db.collection('users').where({ openid: OPENID }).limit(1).get()
    ]);

    const game = gameRes.data;
    const users = userRes.data;

    if (!game) return { success: false, message: '牌局不存在' };
    if (game.status !== 'waiting') return { success: false, message: '牌局已开始或已结束' };
    if (game.players.length >= 4) return { success: false, message: '牌局已满员' };
    if (game.players.some(p => p.openid === OPENID)) {
      return { success: true, data: { message: '已在牌局中' } };
    }
    if (users.length === 0) return { success: false, message: '请先登录' };

    const user = users[0];
    const position = game.players.length; // 0,1,2,3
    // 位置0,2 → A队；位置1,3 → B队
    const team = (position === 0 || position === 2) ? 'A' : 'B';

    await db.collection('games').doc(gameId).update({
      data: {
        players: _.push({
          openid: OPENID,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          team,
          position,
          isHost: false,
        }),
        updatedAt: db.serverDate(),
      }
    });

    return { success: true, data: { position, team } };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
