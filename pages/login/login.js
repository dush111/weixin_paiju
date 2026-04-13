// pages/login/login.js
const app = getApp();

Page({
  data: {
    isLoading: false,
  },

  onLoad() {
    // 检查是否已登录
    const userInfo = app.getUserInfo();
    if (userInfo) {
      this.navigateToHome();
    }
  },

  // 微信授权登录
  async onGetUserInfo(e) {
    if (this.data.isLoading) return;

    if (!e.detail.userInfo) {
      wx.showToast({ title: '需要授权才能使用', icon: 'none' });
      return;
    }

    this.setData({ isLoading: true });

    try {
      // 调用云函数登录
      const res = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          userInfo: e.detail.userInfo
        }
      });

      if (res.result.success) {
        const userData = res.result.data;
        app.setUserInfo(userData);
        
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
        
        setTimeout(() => {
          this.navigateToHome();
        }, 1000);
      } else {
        throw new Error(res.result.message || '登录失败');
      }
    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'error' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  navigateToHome() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
