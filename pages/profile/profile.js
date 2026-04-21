// pages/profile/profile.js
const app = getApp();

const USER_AGREEMENT = `一、服务说明
转蛋计分（以下简称"本应用"）是一款专为掼蛋牌局提供计分记录服务的小程序，由开发者个人提供。

二、账号与登录
1. 本应用使用微信授权登录，无需注册独立账号。
2. 您的微信 openid 将作为唯一身份标识，用于关联您的牌局记录和积分数据。
3. 请勿将账号转让或共享给他人使用。

三、用户行为规范
1. 您应遵守中华人民共和国相关法律法规，不得利用本应用从事任何违法活动。
2. 您在本应用中设置的昵称不得包含违法、侵权或不当内容。
3. 本应用仅供娱乐计分使用，不涉及任何形式的赌博或金钱交易。

四、数据与存储
1. 您的牌局记录、积分数据等信息存储于微信云开发数据库中。
2. 您可随时通过退出登录的方式停止使用本应用。
3. 如需删除账号数据，请联系开发者处理。

五、免责声明
1. 本应用按现状提供服务，不对服务中断、数据丢失等情况承担责任。
2. 因网络问题、微信平台故障等导致的数据异常，开发者不承担赔偿责任。

六、协议修改
开发者保留随时修改本协议的权利，修改后将在应用内通知用户。继续使用即视为同意修改后的协议。`;

const PRIVACY_POLICY = `一、信息收集
本应用收集的信息仅限于以下内容：
1. 微信 openid（由微信平台提供，用于身份识别）
2. 您主动设置的昵称和头像
3. 您参与的牌局记录及积分数据

二、信息使用
收集的信息仅用于以下目的：
1. 识别用户身份，保存和展示您的牌局记录
2. 计算和展示您的积分、战绩统计
3. 在多人牌局中向同局玩家展示您的昵称和头像

三、信息共享
1. 本应用不会将您的个人信息出售、出租或交换给第三方。
2. 您的昵称和头像将在同一牌局的其他玩家中可见，这是多人计分功能所必需的。
3. 除上述情形外，未经您明确同意，不会向任何第三方披露您的信息。

四、信息存储与安全
1. 您的数据存储于腾讯云微信云开发平台，受腾讯云安全体系保护。
2. 本应用采用合理的安全措施保护您的信息，但无法保证绝对安全。

五、信息删除
如您希望删除本应用中的个人数据，请联系开发者，我们将在合理时间内处理您的请求。

六、未成年人保护
本应用不针对未满14周岁的未成年人提供服务。

七、联系我们
如对本隐私政策有任何疑问，请通过微信小程序反馈渠道联系开发者。

本政策自您首次使用本应用时生效。`;

Page({
  data: {
    // 登录状态
    isLoggedIn: false,
    userInfo: null,

    // 登录流程
    loginStep: 1,   // 1=微信登录 2=设置头像昵称
    isLoading: false,
    agreed: false,
    showAgreement: false,
    showPrivacy: false,
    agreementText: USER_AGREEMENT,
    privacyText: PRIVACY_POLICY,

    // 设置头像昵称（登录 step2 / 编辑模式共用）
    tempAvatarUrl: '',
    tempNickname: '',

    // 编辑模式
    isEditing: false,
    newNickname: '',
    canSave: false,
  },

  onShow() {
    const userInfo = app.getUserInfo();
    const isLoggedIn = !!userInfo;
    this.setData({
      isLoggedIn,
      userInfo: userInfo || null,
      isEditing: false,
    });
    if (!isLoggedIn) {
      // 重置登录步骤
      this.setData({ loginStep: 1 });
    }
  },

  // ─── 登录流程 ────────────────────────────────────────────────────

  toggleAgreed() {
    this.setData({ agreed: !this.data.agreed });
  },

  showUserAgreement() {
    this.setData({ showAgreement: true });
  },

  closeAgreement() {
    this.setData({ showAgreement: false });
  },

  showPrivacyPolicy() {
    this.setData({ showPrivacy: true });
  },

  closePrivacy() {
    this.setData({ showPrivacy: false });
  },

  async doWxLogin() {
    if (this.data.isLoading) return;
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none' });
      return;
    }
    this.setData({ isLoading: true });
    wx.showLoading({ title: '登录中...', mask: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'userLogin',
        data: { action: 'checkOrCreate' }
      });
      wx.hideLoading();

      if (!res.result.success) throw new Error(res.result.message || '登录失败');

      const userData = res.result.data;

      if (userData.isNewUser) {
        this.setData({
          loginStep: 2,
          isLoading: false,
          tempNickname: userData.nickname || '',
          tempAvatarUrl: userData.avatarUrl || '',
        });
      } else {
        app.setUserInfo(userData);
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
        setTimeout(() => {
          this.setData({
            isLoggedIn: true,
            userInfo: userData,
            isLoading: false,
          });
        }, 1000);
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '登录失败，请重试', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },

  // ─── 设置头像（登录step2 / 编辑模式） ──────────────────────────────

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      this.setData({ tempAvatarUrl: avatarUrl });
      if (this.data.isEditing) {
        this._checkCanSave();
      }
    }
  },

  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  onNicknameBlur(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  async confirmProfile() {
    const { tempNickname, tempAvatarUrl, isLoading } = this.data;
    if (!tempNickname.trim() || isLoading) return;

    this.setData({ isLoading: true });
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      let finalAvatarUrl = '';
      if (tempAvatarUrl) {
        finalAvatarUrl = await this._uploadAvatar(tempAvatarUrl);
      }

      const res = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          action: 'saveProfile',
          nickname: tempNickname.trim(),
          avatarUrl: finalAvatarUrl,
        }
      });
      wx.hideLoading();

      if (!res.result.success) throw new Error(res.result.message || '保存失败');

      app.setUserInfo(res.result.data);
      wx.showToast({ title: '设置成功', icon: 'success', duration: 1000 });
      setTimeout(() => {
        this.setData({
          isLoggedIn: true,
          userInfo: res.result.data,
          isLoading: false,
          loginStep: 1,
        });
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },

  // ─── 编辑资料模式 ────────────────────────────────────────────────

  startEdit() {
    const { userInfo } = this.data;
    this.setData({
      isEditing: true,
      newNickname: userInfo ? userInfo.nickname : '',
      tempAvatarUrl: userInfo ? userInfo.avatarUrl : '',
      canSave: false,
    });
  },

  cancelEdit() {
    this.setData({ isEditing: false });
  },

  onNewNicknameInput(e) {
    this.setData({ newNickname: e.detail.value });
    this._checkCanSave();
  },

  onNewNicknameBlur(e) {
    this.setData({ newNickname: e.detail.value });
    this._checkCanSave();
  },

  _checkCanSave() {
    const { newNickname, tempAvatarUrl, userInfo } = this.data;
    const nicknameChanged = newNickname.trim().length >= 2 && newNickname.trim() !== (userInfo && userInfo.nickname);
    const avatarChanged = tempAvatarUrl && tempAvatarUrl !== (userInfo && userInfo.avatarUrl);
    this.setData({ canSave: nicknameChanged || avatarChanged });
  },

  async saveProfile() {
    const { newNickname, tempAvatarUrl, userInfo, isLoading, canSave } = this.data;
    if (!canSave || isLoading) return;

    this.setData({ isLoading: true });
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      // 上传新头像（如果换了头像）
      let finalAvatarUrl = userInfo ? userInfo.avatarUrl : '';
      const avatarChanged = tempAvatarUrl && tempAvatarUrl !== (userInfo && userInfo.avatarUrl);
      if (avatarChanged) {
        finalAvatarUrl = await this._uploadAvatar(tempAvatarUrl);
      }

      const nicknameToSave = newNickname.trim().length >= 2 ? newNickname.trim() : (userInfo ? userInfo.nickname : '');

      const res = await wx.cloud.callFunction({
        name: 'updateNickname',
        data: {
          nickname: nicknameToSave,
          avatarUrl: finalAvatarUrl,
        }
      });
      wx.hideLoading();

      if (!res.result.success) throw new Error(res.result.message || '保存失败');

      const updated = { ...userInfo, nickname: nicknameToSave, avatarUrl: finalAvatarUrl || userInfo.avatarUrl };
      app.setUserInfo(updated);

      wx.showToast({ title: '保存成功', icon: 'success', duration: 1000 });
      setTimeout(() => {
        this.setData({
          isEditing: false,
          isLoading: false,
          userInfo: updated,
        });
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },

  // ─── 退出登录 ────────────────────────────────────────────────────

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#e94560',
      success: (res) => {
        if (res.confirm) {
          app.clearUserInfo();
          wx.showToast({ title: '已退出登录', icon: 'success' });
          setTimeout(() => {
            this.setData({
              isLoggedIn: false,
              userInfo: null,
              loginStep: 1,
              agreed: false,
            });
          }, 800);
        }
      }
    });
  },

  // ─── 上传头像 ────────────────────────────────────────────────────

  async _uploadAvatar(tempFilePath) {
    try {
      const match = tempFilePath.match(/\.([a-zA-Z0-9]+)(\?|$)/);
      const ext = (match ? match[1] : 'jpg').toLowerCase();
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      wx.showLoading({ title: '上传头像...', mask: true });
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
      });
      wx.hideLoading();
      return uploadRes.fileID;
    } catch (err) {
      wx.hideLoading();
      console.error('头像上传失败:', err);
      return '';
    }
  },

  onShareAppMessage() {
    const promise = new Promise(resolve => {
      setTimeout(() => {
        resolve({
          title: '转蛋积分'
        })
      }, 2000)
    })
    return {
      title: '转蛋积分',
      path: '/page/home/home.html',
      promise
    }
  }
});
