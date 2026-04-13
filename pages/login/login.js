// pages/login/login.js
const app = getApp();

Page({
  data: {
    step: 1,           // 1=登录入口  2=填写头像昵称
    isLoading: false,
    tempAvatarUrl: '', // 用户选择的临时头像
    tempNickname: '',  // 用户输入的昵称
  },

  onLoad() {
    // 已登录直接进主页
    const userInfo = app.getUserInfo();
    if (userInfo) {
      this.navigateToHome();
    }
  },

  // 第一步：微信静默登录，获取 openid
  async doWxLogin() {
    if (this.data.isLoading) return;
    this.setData({ isLoading: true });
    wx.showLoading({ title: '登录中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'userLogin',
        data: { action: 'checkOrCreate' }
      });
      wx.hideLoading();

      if (res.result.success) {
        const userData = res.result.data;

        if (userData.isNewUser) {
          // 新用户：进入第二步填写头像昵称
          this.setData({
            step: 2,
            isLoading: false,
            // 预填已有微信昵称（如果有）
            tempNickname: userData.nickname || '',
            tempAvatarUrl: userData.avatarUrl || '',
          });
        } else {
          // 老用户：直接进主页
          app.setUserInfo(userData);
          wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
          setTimeout(() => this.navigateToHome(), 1000);
          this.setData({ isLoading: false });
        }
      } else {
        throw new Error(res.result.message || '登录失败');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'error' });
      this.setData({ isLoading: false });
    }
  },

  // 第二步：选择头像（新 API）
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ tempAvatarUrl: avatarUrl });
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  // 昵称失焦（微信键盘选择昵称后触发）
  onNicknameBlur(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  // 第二步：确认保存头像昵称
  async confirmProfile() {
    const { tempNickname, tempAvatarUrl, isLoading } = this.data;
    if (!tempNickname.trim() || isLoading) return;

    this.setData({ isLoading: true });
    wx.showLoading({ title: '保存中...' });

    try {
      // 如果选择了头像，先上传到云存储
      let finalAvatarUrl = tempAvatarUrl;
      if (tempAvatarUrl && tempAvatarUrl.startsWith('http://tmp/')) {
        finalAvatarUrl = await this.uploadAvatar(tempAvatarUrl);
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

      if (res.result.success) {
        app.setUserInfo(res.result.data);
        wx.showToast({ title: '设置成功', icon: 'success', duration: 1000 });
        setTimeout(() => this.navigateToHome(), 1000);
      } else {
        throw new Error(res.result.message || '保存失败');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存资料失败:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'error' });
      this.setData({ isLoading: false });
    }
  },

  // 上传头像到云存储
  async uploadAvatar(tempFilePath) {
    try {
      const ext = tempFilePath.split('.').pop() || 'jpg';
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath,
      });
      return uploadRes.fileID;
    } catch (err) {
      console.error('头像上传失败:', err);
      return tempFilePath; // 上传失败则用临时路径（仅本次有效）
    }
  },

  navigateToHome() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
