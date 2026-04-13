// 云函数：userLogin
// 功能：微信登录，创建/更新用户信息
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { userInfo } = event;

  try {
    // 查找已有用户
    const { data: users } = await db.collection('users')
      .where({ openid: OPENID })
      .limit(1)
      .get();

    let userData;

    if (users.length === 0) {
      // 新用户：创建记录
      const result = await db.collection('users').add({
        data: {
          openid: OPENID,
          nickname: userInfo.nickName || `玩家${OPENID.slice(-4)}`,
          avatarUrl: userInfo.avatarUrl || '',
          totalScore: 0,
          totalGames: 0,
          wins: 0,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        }
      });
      userData = {
        _id: result._id,
        openid: OPENID,
        nickname: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        totalScore: 0,
      };
    } else {
      // 老用户：更新头像
      userData = users[0];
      await db.collection('users').doc(userData._id).update({
        data: {
          avatarUrl: userInfo.avatarUrl,
          updatedAt: db.serverDate(),
        }
      });
    }

    return { success: true, data: userData };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
