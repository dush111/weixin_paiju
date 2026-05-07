// pages/simple-scoring/simple-scoring.js
// 简易模式：本地记分，无队伍，选2名得分者+分值，简单表格

const SCORE_OPTIONS = [100, 150, 200, 300];

Page({
  data: {
    gameName: '',
    players: [],   // [{openid, nickname, score}]
    rounds: [],    // [{roundNumber, scorer1, scorer2, points, note}]
    currentRound: 1,

    // 当前局输入
    // 得分者选择：最多2人
    selectedScorers: [],   // 下标数组，最多2个
    selectedPoints: 200,   // 本局得分值（每人各得此分）
    scoreOptions: SCORE_OPTIONS,

    showEndModal: false,
  },

  onLoad() {
    const data = wx.getStorageSync('simpleGameData');
    if (!data) {
      wx.showToast({ title: '数据丢失，请重新创建', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    this.setData({
      gameName: data.gameName,
      players: data.players.map(p => ({ ...p, score: 0 })),
      rounds: data.rounds || [],
      currentRound: (data.rounds || []).length + 1,
    });
  },

  onUnload() {
    // 离开时保存最新数据
    this._saveToStorage();
  },

  _saveToStorage() {
    wx.setStorageSync('simpleGameData', {
      gameName: this.data.gameName,
      players: this.data.players,
      rounds: this.data.rounds,
      createdAt: wx.getStorageSync('simpleGameData')?.createdAt || Date.now(),
    });
  },

  // 切换得分者（最多选2）
  toggleScorer(e) {
    const { pi } = e.currentTarget.dataset;
    let selected = [...this.data.selectedScorers];
    const idx = selected.indexOf(pi);
    if (idx !== -1) {
      selected.splice(idx, 1);
    } else {
      if (selected.length >= 2) {
        wx.showToast({ title: '最多选2位得分者', icon: 'none' });
        return;
      }
      selected.push(pi);
    }
    this.setData({ selectedScorers: selected });
  },

  // 选择分值
  selectPoints(e) {
    this.setData({ selectedPoints: e.currentTarget.dataset.val });
  },

  // 提交本局
  submitRound() {
    const { selectedScorers, selectedPoints, players, rounds, currentRound, gameName } = this.data;
    if (selectedScorers.length !== 2) {
      wx.showToast({ title: '请选择2位得分者', icon: 'none' });
      return;
    }

    const scorer1 = players[selectedScorers[0]].nickname;
    const scorer2 = players[selectedScorers[1]].nickname;
    const confirmText = `${scorer1} & ${scorer2} 各得 ${selectedPoints} 分`;

    wx.showModal({
      title: `第 ${currentRound} 局确认`,
      content: confirmText,
      confirmText: '确认',
      confirmColor: '#2ed573',
      success: (res) => {
        if (!res.confirm) return;

        // 更新玩家总分
        const newPlayers = players.map((p, i) => ({
          ...p,
          score: (p.score || 0) + (selectedScorers.includes(i) ? selectedPoints : 0),
        }));

        const newRound = {
          roundNumber: currentRound,
          scorerIndexes: [...selectedScorers],
          scorer1,
          scorer2,
          points: selectedPoints,
        };

        this.setData({
          players: newPlayers,
          rounds: [...rounds, newRound],
          currentRound: currentRound + 1,
          selectedScorers: [],
          selectedPoints: 200,
        });

        this._saveToStorage();
        wx.vibrateShort({ type: 'light' });
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

  doEndGame() {
    this._saveToStorage();
    this.setData({ showEndModal: false });
    // 清理本次 session 数据（保留历史可查）
    wx.removeStorageSync('simpleGameData');
    wx.showToast({ title: '牌局已结束', icon: 'success' });
    setTimeout(() => {
      wx.switchTab({ url: '/pages/home/home' });
    }, 1000);
  },

  onShareAppMessage() {
    return { title: '转蛋积分', path: '/pages/home/home' };
  }
});
