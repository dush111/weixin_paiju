// pages/waiting-room/waiting-room.js
const app = getApp();

Page({
  data: {
    gameId: '',
    gameName: '',
    gameCode: '',
    players: [],
    isHost: false,
    starting: false,
    pollingTimer: null,
  },

  onLoad(options) {
    const { gameId } = options;
    this.setData({ gameId });
    this.loadGameInfo();
    this.startPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  async loadGameInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGameInfo',
        data: { gameId: this.data.gameId }
      });
      if (res.result.success) {
        const game = res.result.data;
        const myOpenid = app.globalData.userInfo && app.globalData.userInfo.openid;
        this.setData({
          gameName: game.name,
          gameCode: game.inviteCode,
          players: game.players,
          isHost: game.hostOpenid === myOpenid,
        });
      }
    } catch (err) {
      console.error(err);
    }
  },

  startPolling() {
    const timer = setInterval(() => {
      this.pollStatus();
    }, 2000);
    this.setData({ pollingTimer: timer });
  },

  stopPolling() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.setData({ pollingTimer: null });
    }
  },

  async pollStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGamePlayers',
        data: { gameId: this.data.gameId }
      });
      if (res.result.success) {
        const { players, status } = res.result.data;
        this.setData({ players });
        if (status === 'playing') {
          this.stopPolling();
          wx.redirectTo({
            url: `/pages/scoring/scoring?gameId=${this.data.gameId}`
          });
        }
      }
    } catch (err) {}
  },

  async startGame() {
    if (this.data.starting) return;
    this.setData({ starting: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'startGame',
        data: { gameId: this.data.gameId }
      });
      if (res.result.success) {
        // 房主自己也跳转
        this.stopPolling();
        wx.redirectTo({
          url: `/pages/scoring/scoring?gameId=${this.data.gameId}`
        });
      } else {
        wx.showToast({ title: res.result.message || '开始失败', icon: 'none' });
        this.setData({ starting: false });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      this.setData({ starting: false });
    }
  },
});
