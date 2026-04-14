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
    step: 1,
    isLoading: false,
    tempAvatarUrl: '',
    tempNickname: '',
    agreed: false,
    showAgreement: false,
    showPrivacy: false,
    agreementText: USER_AGREEMENT,
    privacyText: PRIVACY_POLICY,
  },

  onLoad() {
    const userInfo = app.getUserInfo();
    if (userInfo) {
      this.navigateToHome();
    }
  },

  // ─── 第一步：微信静默登录，获取 openid ───────────────────────────
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
        // 新用户 → 进入第二步设置头像昵称
        this.setData({
          step: 2,
          isLoading: false,
          tempNickname: userData.nickname || '',
          tempAvatarUrl: userData.avatarUrl || '',
        });
      } else {
        // 老用户 → 直接进首页
        app.setUserInfo(userData);
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
        setTimeout(() => this.navigateToHome(), 1000);
        this.setData({ isLoading: false });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('登录失败:', err);
      wx.showToast({ title: err.message || '登录失败，请重试', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },

  // ─── 第二步：选择微信头像（open-type="chooseAvatar"）──────────────
  onChooseAvatar(e) {
    // e.detail.avatarUrl 是微信给的临时文件路径，形如 http://tmp/xxx.jpg
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      this.setData({ tempAvatarUrl: avatarUrl });
    }
  },

  // ─── 第二步：输入昵称（type="nickname" 支持微信键盘一键填入）────────
  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  onNicknameBlur(e) {
    // 微信键盘选择昵称后会触发 blur，此时 value 已是最终值
    this.setData({ tempNickname: e.detail.value });
  },

  // ─── 第二步：确认 → 先上传头像到云存储，再保存资料 ─────────────────
  async confirmProfile() {
    const { tempNickname, tempAvatarUrl, isLoading } = this.data;
    if (!tempNickname.trim() || isLoading) return;

    this.setData({ isLoading: true });
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      // 1. 上传头像（如果用户选择了头像）
      let finalAvatarUrl = '';
      if (tempAvatarUrl) {
        finalAvatarUrl = await this._uploadAvatar(tempAvatarUrl);
      }

      // 2. 调用云函数保存昵称 + 头像 URL 到数据库
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
      setTimeout(() => this.navigateToHome(), 1000);
    } catch (err) {
      wx.hideLoading();
      console.error('保存资料失败:', err);
      wx.showToast({ title: err.message || '保存失败，请重试', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },

  // ─── 上传头像到云存储 ────────────────────────────────────────────
  async _uploadAvatar(tempFilePath) {
    // 微信 chooseAvatar 给的路径以 http://tmp/ 开头
    // 也有可能是 wxfile:// 或其他临时协议，统一尝试上传
    try {
      // 从路径尾部取扩展名，找不到则默认 jpg
      const match = tempFilePath.match(/\.([a-zA-Z0-9]+)(\?|$)/);
      const ext = (match ? match[1] : 'jpg').toLowerCase();
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      wx.showLoading({ title: '上传头像...', mask: true });
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
      });
      wx.hideLoading();

      return uploadRes.fileID; // 云存储永久 ID
    } catch (err) {
      wx.hideLoading();
      console.error('头像上传失败，将跳过头像设置:', err);
      // 上传失败不阻断流程，返回空串（后续可在「更改昵称」页补传）
      return '';
    }
  },

  navigateToHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

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
});
