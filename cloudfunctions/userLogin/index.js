// 云函数：userLogin
// 功能：微信登录 + 保存用户头像昵称
// action: 'checkOrCreate' - 静默登录/检查用户
// action: 'saveProfile'   - 保存头像昵称
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { action = 'checkOrCreate', nickname, avatarUrl } = event;

  try {
    // 查找已有用户
    const { data: users } = await db.collection('users')
      .where({ openid: OPENID })
      .limit(1)
      .get();

    // ── action: checkOrCreate ──────────────────────────────────────
    if (action === 'checkOrCreate') {
      if (users.length === 0) {
        // 全新用户：创建一条空记录，前端进入第二步填写资料
        const result = await db.collection('users').add({
          data: {
            openid: OPENID,
            nickname: '',
            avatarUrl: '',
            totalScore: 0,
            totalGames: 0,
            wins: 0,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate(),
          }
        });
        return {
          success: true,
          data: {
            _id: result._id,
            openid: OPENID,
            nickname: '',
            avatarUrl: '',
            totalScore: 0,
            isNewUser: true,   // 告知前端需要填写资料
          }
        };
      } else {
        // 已有用户
        const user = users[0];
        const needProfile = !user.nickname; // 昵称为空则仍需完善
        return {
          success: true,
          data: {
            _id: user._id,
            openid: OPENID,
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            totalScore: user.totalScore || 0,
            isNewUser: needProfile,
          }
        };
      }
    }

    // ── action: saveProfile ───────────────────────────────────────
    if (action === 'saveProfile') {
      if (!nickname || !nickname.trim()) {
        return { success: false, message: '昵称不能为空' };
      }

      let targetId;
      if (users.length === 0) {
        // 极少情况：用户记录未建立，重新创建
        const result = await db.collection('users').add({
          data: {
            openid: OPENID,
            nickname: nickname.trim(),
            avatarUrl: avatarUrl || '',
            totalScore: 0,
            totalGames: 0,
            wins: 0,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate(),
          }
        });
        targetId = result._id;
      } else {
        targetId = users[0]._id;
        await db.collection('users').doc(targetId).update({
          data: {
            nickname: nickname.trim(),
            avatarUrl: avatarUrl || users[0].avatarUrl || '',
            updatedAt: db.serverDate(),
          }
        });
      }

      // 重新读取最新数据返回
      const { data: updated } = await db.collection('users').doc(targetId).get();
      return {
        success: true,
        data: {
          _id: updated._id,
          openid: OPENID,
          nickname: updated.nickname,
          avatarUrl: updated.avatarUrl,
          totalScore: updated.totalScore || 0,
          isNewUser: false,
        }
      };
    }

    return { success: false, message: '未知 action' };

  } catch (err) {
    console.error('userLogin error:', err);
    return { success: false, message: err.message };
  }
};
