// pages/waiting-room/waiting-room.js
const app = getApp();

Page({
  data: {
    gameId: '',
    gameName: '',
    gameCode: '',
    players: [],
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
        this.setData({
          gameName: game.name,
          gameCode: game.code,
          players: game.players
        });
      }
    } catch (err) {
      console.error(err);
    }
  },

  async joinGame() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'joinGame',
        data: { gameId: this.data.gameId }
      });
      if (res.result.success) {
        this.loadGameInfo();
      }
    } catch (err) {
      wx.showToast({ title: '加入失败', icon: 'error' });
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
  }
});
