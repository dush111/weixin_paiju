// pages/scoring/scoring.js
const app = getApp();

Page({
  data: {
    gameId: '',
    gameName: '',
    targetRounds: 10,
    currentRound: 1,
    progressPct: 0,
    isHost: false,
    currentLevel: '2',
    levelOptions: ['2','3','4','5','6','7','8','9','10','J','Q','K','A'],
    players: [],
    playerNames: [],
    teamAScore: 0,
    teamBScore: 0,
    teamAWinning: false,
    // 当前局名次选择
    rankIndexes: [-1, -1, -1, -1],
    rankSelections: ['', '', '', ''],
    usedIndexes: { 0: false, 1: false, 2: false, 3: false },
    selectedCount: 0,
    rankBlocks: [
      { rank: 0, icon: '🥇', label: '第一名' },
      { rank: 1, icon: '🥈', label: '第二名' },
      { rank: 2, icon: '🥉', label: '第三名' },
      { rank: 3, icon: '4️⃣', label: '第四名' },
    ],
    previewReady: false,
    previewAScore: 0,
    previewBScore: 0,
    scoreCase: '',
    rounds: [],
    showRuleModal: false,
    pollingTimer: null,
  },

  onLoad(options) {
    const { gameId } = options;
    this.setData({ gameId });
    this.loadGameData();
    this.startSync();
  },

  onUnload() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
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
        const playerNames = d.players.map(p => p.nickname);
        const myOpenid = app.globalData?.userInfo?.openid || app.getUserInfo()?.openid;
        this.setData({
          gameName: d.name,
          targetRounds: d.targetRounds,
          currentRound: d.currentRound,
          isHost: d.hostOpenid === myOpenid,
          currentLevel: d.currentLevel || '2',
          players: d.players,
          playerNames,
          teamAScore: d.teamAScore,
          teamBScore: d.teamBScore,
          teamAWinning: d.teamAScore > d.teamBScore,
          rounds: d.rounds,
          progressPct: Math.round((d.currentRound - 1) / d.targetRounds * 100)
        });
      }
    } catch (err) {
      console.error('加载记分数据失败:', err);
    }
  },

  startSync() {
    const timer = setInterval(() => {
      this.loadGameData();
    }, 5000);
    this.setData({ pollingTimer: timer });
  },

  // 头像点选
  onPickAvatar(e) {
    const { rank, pi } = e.currentTarget.dataset;
    const { rankIndexes, rankSelections, playerNames } = this.data;
    const players = this.data.players;

    // 已被其他名次选中则不能点
    const usedByOther = rankIndexes.some((idx, r) => idx === pi && r !== rank);
    if (usedByOther) return;

    let newIndexes = [...rankIndexes];
    let newSelections = [...rankSelections];

    // 再次点同一个头像 → 取消选择
    if (newIndexes[rank] === pi) {
      newIndexes[rank] = -1;
      newSelections[rank] = '';
    } else {
      newIndexes[rank] = pi;
      newSelections[rank] = players[pi].nickname;
    }

    const usedIndexes = { 0: false, 1: false, 2: false, 3: false };
    newIndexes.forEach(idx => { if (idx !== -1) usedIndexes[idx] = true; });
    const selectedCount = newIndexes.filter(i => i !== -1).length;

    this.setData({ rankIndexes: newIndexes, rankSelections: newSelections, usedIndexes, selectedCount });

    if (newIndexes.every(i => i !== -1)) {
      this.calcPreviewScore(newIndexes, players);
    } else {
      this.setData({ previewReady: false });
    }
  },

  // 取消所有选择
  cancelSelection() {
    this.setData({
      rankIndexes: [-1, -1, -1, -1],
      rankSelections: ['', '', '', ''],
      usedIndexes: { 0: false, 1: false, 2: false, 3: false },
      selectedCount: 0,
      previewReady: false,
    });
  },

  /**
   * 积分规则：
   * A队 = players[0], players[2]（位置0,2）
   * B队 = players[1], players[3]（位置1,3）
   *
   * rankIndexes[0] = 第一名 player index
   * rankIndexes[1] = 第二名 player index
   * rankIndexes[2] = 第三名 player index
   * rankIndexes[3] = 第四名 player index
   *
   * 判断第一名属于哪队：
   *   若第一名 index 在 {0,2} → A队拥有第一名
   *   若第一名 index 在 {1,3} → B队拥有第一名
   *
   * 第二名 index 所在队与第一名队相同 → 300分
   * 第三名 index 所在队与第一名队相同 → 200分
   * 第四名 index 所在队与第一名队相同 → 100分
   */
  calcPreviewScore(rankIndexes, players) {
    const teamA = new Set([0, 2]); // player下标
    const teamB = new Set([1, 3]);

    const rank1 = rankIndexes[0];
    const rank2 = rankIndexes[1];
    // const rank3 = rankIndexes[2];  // 隐含
    const rank4 = rankIndexes[3];

    const firstTeamIsA = teamA.has(rank1);

    // 同队判断
    const isSameTeam = (a, b) => {
      return (teamA.has(a) && teamA.has(b)) || (teamB.has(a) && teamB.has(b));
    };

    let score = 0;
    let caseText = '';

    if (isSameTeam(rank1, rank2)) {
      score = 300;
      caseText = '一、二名同队（300分局）';
    } else if (!isSameTeam(rank1, rank4)) {
      // 第一名和第四名不同队 → 第一名和第三名可能同队（200分）
      score = 200;
      caseText = '一、三名同队（200分局）';
    } else {
      // 第一名和第四名同队 → 100分
      score = 100;
      caseText = '一、四名同队（100分局）';
    }

    const aScore = firstTeamIsA ? score : 0;
    const bScore = firstTeamIsA ? 0 : score;

    this.setData({
      previewReady: true,
      previewAScore: aScore,
      previewBScore: bScore,
      scoreCase: caseText
    });
  },

  async submitRound() {
    const { gameId, rankIndexes, previewAScore, previewBScore, scoreCase, currentRound } = this.data;
    if (!this.data.previewReady) return;
    if (this._submitting) return; // 防止重复点击

    wx.showModal({
      title: '确认提交',
      content: `${scoreCase}\nA队 ${previewAScore > 0 ? '+' + previewAScore : 0}，B队 ${previewBScore > 0 ? '+' + previewBScore : 0}`,
      confirmText: '确认',
      confirmColor: '#e94560',
      success: async (res) => {
        if (res.confirm) {
          if (this._submitting) return;
          this._submitting = true;
          wx.showLoading({ title: '提交中...' });
          try {
            const result = await wx.cloud.callFunction({
              name: 'submitRound',
              data: {
                gameId,
                roundNumber: currentRound,
                ranks: rankIndexes,
                scoreA: previewAScore,
                scoreB: previewBScore,
                caseText: scoreCase
              }
            });

            if (result.result.success) {
              // duplicate 表示已被他人提交，直接刷新数据即可
              if (!result.result.duplicate) {
                wx.vibrateShort({ type: 'light' });
              }

              // 重置选择
              this.setData({
                rankIndexes: [-1, -1, -1, -1],
                rankSelections: ['', '', '', ''],
                usedIndexes: { 0: false, 1: false, 2: false, 3: false },
                selectedCount: 0,
                previewReady: false
              });

              // 检查是否游戏结束
              if (!result.result.duplicate && result.result.data && result.result.data.gameOver) {
                this.showGameOver(result.result.data);
              } else {
                this.loadGameData();
              }
            } else {
              wx.showToast({ title: result.result.message || '提交失败', icon: 'none' });
            }
          } catch (err) {
            wx.showToast({ title: '提交失败', icon: 'error' });
          } finally {
            wx.hideLoading();
            this._submitting = false;
          }
        }
      }
    });
  },

  showGameOver(data) {
    const winner = data.winner === 'A' ? 'A队' : 'B队';
    wx.showModal({
      title: '🎉 牌局结束',
      content: `${winner}获胜！\nA队：${data.finalScoreA}分\nB队：${data.finalScoreB}分`,
      showCancel: false,
      confirmText: '查看详情',
      success: () => {
        wx.redirectTo({
          url: `/pages/game-detail/game-detail?id=${this.data.gameId}`
        });
      }
    });
  },

  confirmEndGame() {
    wx.showModal({
      title: '结束牌局',
      content: '确定提前结束本次牌局吗？',
      confirmColor: '#e94560',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({
              name: 'endGame',
              data: { gameId: this.data.gameId }
            });
            wx.redirectTo({
              url: `/pages/game-detail/game-detail?id=${this.data.gameId}`
            });
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'error' });
          }
        }
      }
    });
  },

  showRules() { this.setData({ showRuleModal: true }); },
  hideRules() { this.setData({ showRuleModal: false }); },

  // 房主修改级牌（picker bindchange）
  async changeLevel(e) {
    const { levelOptions, currentLevel } = this.data;
    const newLevel = levelOptions[e.detail.value];
    if (newLevel === currentLevel) return;
    try {
      const result = await wx.cloud.callFunction({
        name: 'updateGameSettings',
        data: { gameId: this.data.gameId, currentLevel: newLevel }
      });
      if (result.result.success) {
        this.setData({ currentLevel: newLevel });
        wx.showToast({ title: `级牌改为 ${newLevel}`, icon: 'success' });
      } else {
        wx.showToast({ title: result.result.message || '修改失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },
});
