// 云函数：resetAllScores
// 功能：将所有用户的 totalScore 重置为 0（一次性维护用）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    // 查出所有用户
    const { data: users } = await db.collection('users').limit(1000).get();

    if (!users || users.length === 0) {
      return { success: true, message: '没有用户记录', updated: 0 };
    }

    // 逐个将 totalScore 置为 0
    const updates = users.map(u =>
      db.collection('users').doc(u._id).update({
        data: {
          totalScore: 0,
          updatedAt: db.serverDate(),
        }
      })
    );

    await Promise.all(updates);

    return { success: true, message: `已重置 ${users.length} 个用户的总积分`, updated: users.length };
  } catch (err) {
    console.error('resetAllScores error:', err);
    return { success: false, message: err.message };
  }
};
