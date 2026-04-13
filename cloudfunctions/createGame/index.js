// 云函数：createGame
// 功能：创建新牌局
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 生成6位随机口令
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { gameName, targetRounds } = event;

  try {
    // 获取用户信息
    const { data: users } = await db.collection('users')
      .where({ openid: OPENID }).limit(1).get();

    if (users.length === 0) {
      return { success: false, message: '用户未找到，请重新登录' };
    }

    const host = users[0];
    const inviteCode = generateCode();

    // 创建牌局
    const result = await db.collection('games').add({
      data: {
        name: gameName,
        inviteCode: inviteCode,
        hostOpenid: OPENID,
        targetRounds: targetRounds || 10,
        currentRound: 1,
        status: 'waiting', // waiting | playing | finished | cancelled
        players: [
          {
            openid: OPENID,
            nickname: host.nickname,
            avatarUrl: host.avatarUrl,
            team: 'A',     // A队：位置0,2；B队：位置1,3
            position: 0,
            isHost: true,
          }
        ],
        teamAScore: 0,
        teamBScore: 0,
        rounds: [],
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      }
    });

    // 生成小程序码（实际需要调用微信API，此处返回gameId供前端处理）
    return {
      success: true,
      data: {
        gameId: result._id,
        gameCode: inviteCode,
        qrCodeUrl: '', // 实际部署时通过 wx.cloud.openapi.wxacode.getUnlimited 生成
      }
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
