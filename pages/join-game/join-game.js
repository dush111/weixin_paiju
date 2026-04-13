// pages/join-game/join-game.js
const app = getApp();

Page({
  data: {
    inviteCode: '345332',
    loading: false,
    showPreview: false,
    gameInfo: null,
  },

  onLoad(options) {
    // 支持从扫码或分享链接带入邀请码
    if (options.code) {
      this.setData({ inviteCode: options.code });
      // 如果邀请码完整，自动预览
      if (options.code.length === 6) {
        this.fetchGameInfo(options.code);
      }
    }
  },

  onCodeInput(e) {
    const val = e.detail.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    console.log("input "+ val);
    this.setData({ inviteCode: val.slice(0, 6) });
    // 满6位自动拉取游戏信息
    if (val.length >= 6) {
      this.fetchGameInfo(val.slice(0, 6));
    }
  },

  clearCode() {
    this.setData({ inviteCode: '', gameInfo: null, showPreview: false });
  },

  // 拉取游戏信息（预览用）
  async fetchGameInfo(code) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGameInfo',
        data: { inviteCode: code }
      });
      if (res.result.success) {
        this.setData({
          gameInfo: res.result.data,
          showPreview: true,
        });
      } else {
        wx.showToast({
          title: res.result.message || '邀请码无效',
          icon: 'none',
        });
      }
    } catch (err) {
      console.error('查询牌局失败:', err);
      wx.showToast({ title: '查询失败，请重试', icon: 'none' });
    }
  },

  // 点击「确认加入」按钮（代码不足6位时无效）
  joinByCode() {
    const { inviteCode, loading } = this.data;
    if (inviteCode.length !== 6 || loading) return;
    if (this.data.gameInfo) {
      this.setData({ showPreview: true });
    } else {
      this.fetchGameInfo(inviteCode);
    }
  },

  // 扫码加入
  scanQRCode() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        // 解析二维码中的邀请码
        const url = res.result;
        const match = url.match(/code=([A-Z0-9]{6})/);
        if (match) {
          const code = match[1];
          this.setData({ inviteCode: code });
          this.fetchGameInfo(code);
        } else if (url.length === 6 && /^[A-Z0-9]{6}$/.test(url)) {
          this.setData({ inviteCode: url });
          this.fetchGameInfo(url);
        } else {
          wx.showToast({ title: '二维码无效', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '扫码取消', icon: 'none' });
      }
    });
  },

  // 确认加入
  async confirmJoin() {
    const { inviteCode, loading, gameInfo } = this.data;
    if (loading) return;

    // 检查是否已满员
    if (gameInfo && gameInfo.playerCount >= 4) {
      wx.showToast({ title: '牌局已满员', icon: 'none' });
      return;
    }

    this.setData({ loading: true, showPreview: false });
    wx.showLoading({ title: '加入中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'joinGame',
        data: { inviteCode }
      });
      wx.hideLoading();

      if (res.result.success) {
        const { gameId } = res.result.data;
        wx.showToast({ title: '加入成功！', icon: 'success' });
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/waiting-room/waiting-room?gameId=${gameId}`
          });
        }, 800);
      } else {
        wx.showToast({ title: res.result.message || '加入失败', icon: 'none' });
        this.setData({ loading: false });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加入牌局失败:', err);
      wx.showToast({ title: '加入失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  cancelJoin() {
    this.setData({ showPreview: false });
  },

  noop() {}
});
