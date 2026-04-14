// pages/login/login.js
const app = getApp();

Page({
  data: {
    step: 1,           // 1=登录入口  2=填写头像昵称
    isLoading: false,
    tempAvatarUrl: '', // 用户选择的临时头像（本地路径）
    tempNickname: '',  // 用户输入的昵称
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
  }
});
