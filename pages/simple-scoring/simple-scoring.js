// pages/simple-scoring/simple-scoring.js
// 简易模式：云端存储，选2名得分者+分值，表格记录每人得分
const app = getApp();

const SCORE_OPTIONS = [100, 150, 200, 300];

Page({
  data: {
    gameId: '',
    gameName: '',
    isHost: false,
    players: [],       // [{openid, nickname, avatarUrl, score}]
    rounds: [],        // 每局记录
    currentRound: 1,

    // 本局输入
    selectedScorers: [],   // seatId 数组，最多2个
    scorerName0: '',       // 预览用：第1位得分者名字
    scorerName1: '',       // 预览用：第2位得分者名字
    selectedPoints: 200,
    scoreOptions: SCORE_OPTIONS,

    showEndModal: false,
    pollingTimer: null,
    submitting: false,
  },

  onLoad(options) {
    const { gameId } = options;
    if (!gameId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    this.setData({ gameId });
    this.loadGameData();
    this.startSync();
  },

  onUnload() {
    this.stopSync();
  },

  startSync() {
    const timer = setInterval(() => {
      this.loadGameData();
    }, 5000);
    this.setData({ pollingTimer: timer });
  },

  stopSync() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.setData({ pollingTimer: null });
    }
  },

  async loadGameData() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGameScore',
        data: { gameId: this.data.gameId }
      });
      if (res.result.success) {
        const d = res.result.data;
        const myOpenid = app.globalData?.userInfo?.openid || app.getUserInfo()?.openid;
        this.setData({
          gameName: d.name,
          currentRound: d.currentRound || 1,
          isHost: d.hostOpenid === myOpenid,
          players: d.players,
          rounds: d.rounds || [],
        });
      }
    } catch (err) {
      console.error('加载记分数据失败:', err);
    }
  },

  // 切换得分者（最多选2，点已选则取消）—— 使用 seatId 标识，与数组下标无关
  toggleScorer(e) {
    const { pi } = e.currentTarget.dataset;
    // pi 现在是 seatId 字符串
    let selected = [...this.data.selectedScorers];
    const idx = selected.indexOf(pi);
    if (idx !== -1) {
      // 已选中 → 取消
      selected.splice(idx, 1);
    } else {
      if (selected.length >= 2) {
        wx.showToast({ title: '最多选2位得分者', icon: 'none' });
        return;
      }
      selected.push(pi);
    }
    // 同步更新预览用的玩家名
    const findName = (seatId) => (this.data.players.find(p => p.seatId === seatId) || {}).nickname || '';
    this.setData({
      selectedScorers: selected,
      scorerName0: selected[0] ? findName(selected[0]) : '',
      scorerName1: selected[1] ? findName(selected[1]) : '',
    });
  },

  // 选择分值
  selectPoints(e) {
    this.setData({ selectedPoints: e.currentTarget.dataset.val });
  },

  // 提交本局
  async submitRound() {
    const { gameId, selectedScorers, selectedPoints, players, currentRound, submitting } = this.data;
    if (submitting) return;
    if (selectedScorers.length !== 2) {
      wx.showToast({ title: '请选择2位得分者', icon: 'none' });
      return;
    }

    // selectedScorers 存的是 seatId，通过 seatId 查找玩家名
    const findName = (seatId) => (players.find(p => p.seatId === seatId) || {}).nickname || seatId;
    const name1 = findName(selectedScorers[0]);
    const name2 = findName(selectedScorers[1]);
    const confirmText = `${name1} & ${name2} 各得 ${selectedPoints} 分`;

    wx.showModal({
      title: `第 ${currentRound} 局确认`,
      content: confirmText,
      confirmText: '确认',
      confirmColor: '#2ed573',
      success: async (res) => {
        if (!res.confirm) return;
        if (this.data.submitting) return;
        this.setData({ submitting: true });
        wx.showLoading({ title: '提交中...' });
        try {
          const result = await wx.cloud.callFunction({
            name: 'submitSimpleRound',
            data: {
              gameId,
              roundNumber: currentRound,
              scorerSeatIds: [...selectedScorers],   // 传 seatId 而非下标
              points: selectedPoints,
            }
          });
          if (result.result.success) {
            wx.vibrateShort({ type: 'light' });
            this.setData({ selectedScorers: [], scorerName0: '', scorerName1: '', selectedPoints: 200 });
            this.loadGameData();
          } else {
            wx.showToast({ title: result.result.message || '提交失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '提交失败', icon: 'error' });
        } finally {
          wx.hideLoading();
          this.setData({ submitting: false });
        }
      }
    });
  },

  // 结束牌局
  confirmEndGame() {
    this.setData({ showEndModal: true });
  },

  cancelEnd() {
    this.setData({ showEndModal: false });
  },

  async doEndGame() {
    this.setData({ showEndModal: false });
    wx.showLoading({ title: '结束中...' });
    try {
      await wx.cloud.callFunction({
        name: 'endGame',
        data: { gameId: this.data.gameId }
      });
      this.stopSync();
      wx.showToast({ title: '牌局已结束', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/game-detail/game-detail?id=${this.data.gameId}`
        });
      }, 800);
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  onShareAppMessage() {
    return { title: '转蛋积分', path: '/pages/home/home' };
  }
});
