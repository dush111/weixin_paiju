// pages/nickname/nickname.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    newNickname: '',
    canSave: false,
  },

  onLoad() {
    const userInfo = app.getUserInfo() || {};
    this.setData({
      userInfo,
      newNickname: userInfo.nickname || ''
    });
  },

  onNameInput(e) {
    const val = e.detail.value.trim();
    this.setData({
      newNickname: val,
      canSave: val.length >= 2 && val !== this.data.userInfo.nickname
    });
  },

  async saveNickname() {
    const { newNickname } = this.data;
    if (!this.data.canSave) return;

    wx.showLoading({ title: '保存中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateNickname',
        data: { nickname: newNickname }
      });

      if (res.result.success) {
        const updatedUser = { ...this.data.userInfo, nickname: newNickname };
        app.setUserInfo(updatedUser);
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1200);
      } else {
        throw new Error(res.result.message);
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  goBack() {
    wx.navigateBack();
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
