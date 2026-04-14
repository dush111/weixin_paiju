// pages/create-game/create-game.js
const app = getApp();

Page({
  data: {
    step: 1,
    gameName: '',
    targetRounds: 10,
    roundOptions: [5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
    gameId: null,
    gameCode: '',
    qrCodeUrl: '',
    players: [],
    pollingTimer: null,
  },

  onLoad() {
    const userInfo = app.getUserInfo();
    if (userInfo) {
      this.setData({
        players: [userInfo],
        gameName: `${userInfo.nickname}的牌局`
      });
    }
  },

  onUnload() {
    this.stopPolling();
  },

  onGameNameInput(e) {
    this.setData({ gameName: e.detail.value });
  },

  selectRounds(e) {
    this.setData({ targetRounds: e.currentTarget.dataset.val });
  },

  async createGame() {
    const { gameName, targetRounds } = this.data;
    if (!gameName.trim()) {
      wx.showToast({ title: '请输入牌局名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'createGame',
        data: { gameName: gameName.trim(), targetRounds }
      });

      if (res.result.success) {
        const { gameId, gameCode, qrCodeUrl } = res.result.data;
        this.setData({
          step: 2,
          gameId,
          gameCode,
          qrCodeUrl
        });
        this.startPolling();
      } else {
        throw new Error(res.result.message);
      }
    } catch (err) {
      console.error('创建牌局失败:', err);
      wx.showToast({ title: '创建失败，请重试', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  // 轮询玩家加入状态
  startPolling() {
    const timer = setInterval(() => {
      this.pollPlayers();
    }, 2000);
    this.setData({ pollingTimer: timer });
  },

  stopPolling() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.setData({ pollingTimer: null });
    }
  },

  async pollPlayers() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGamePlayers',
        data: { gameId: this.data.gameId }
      });
      if (res.result.success) {
        const { players } = res.result.data;
        this.setData({ players });
        if (players.length === 4) {
          // 全员到齐，震动提示
          wx.vibrateShort({ type: 'medium' });
        }
      }
    } catch (err) {
      console.error('轮询失败:', err);
    }
  },

  async copyGameCode() {
    const { gameCode, gameName } = this.data;
    const text = `【转蛋积分】邀请你加入「${gameName}」，口令：${gameCode}，快来掼蛋！`;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '口令已复制', icon: 'success' })
    });
  },

  onShareAppMessage() {
    const { gameId, gameName } = this.data;
    return {
      title: `邀请你加入「${gameName}」掼蛋牌局！`,
      path: `/pages/waiting-room/waiting-room?gameId=${gameId}`,
      imageUrl: '/assets/images/share-cover.png'
    };
  },

  onInviteShare() {
    // 分享由 open-type="share" 处理
  },

  async startGame() {
    if (this.data.players.length < 4) return;

    wx.showLoading({ title: '开始中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'startGame',
        data: { gameId: this.data.gameId }
      });

      if (res.result.success) {
        this.stopPolling();
        wx.redirectTo({
          url: `/pages/scoring/scoring?gameId=${this.data.gameId}`
        });
      }
    } catch (err) {
      console.error('开始游戏失败:', err);
      wx.showToast({ title: '操作失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  cancelGame() {
    wx.showModal({
      title: '取消牌局',
      content: '确定要取消本次牌局吗？',
      confirmColor: '#e94560',
      success: (res) => {
        if (res.confirm) {
          this.stopPolling();
          if (this.data.gameId) {
            wx.cloud.callFunction({
              name: 'cancelGame',
              data: { gameId: this.data.gameId }
            });
          }
          wx.navigateBack();
        }
      }
    });
  }
});
