// 云函数：updateNickname
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { nickname } = event;

  if (!nickname || nickname.trim().length < 2) {
    return { success: false, message: '昵称至少2个字符' };
  }

  try {
    await db.collection('users').where({ openid: OPENID }).update({
      data: {
        nickname: nickname.trim(),
        updatedAt: db.serverDate(),
      }
    });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
