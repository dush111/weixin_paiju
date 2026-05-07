// pages/scoring/scoring.js
const app = getApp();

Page({
  data: {
    gameId: '',
    gameName: '',
    currentRound: 1,
    isHost: false,
    currentLevel: '2',
    levelOptions: ['2','3','4','5','6','7','8','9','10','J','Q','K','A'],
    players: [],       // [{openid, nickname, avatarUrl, score, lastRank}]

    // ---- 本局队友选择 ----
    // step: 'pick-partner' → 选自己队友  |  'pick-rank' → 选名次
    step: 'pick-partner',
    myIndex: -1,           // 我在 players 中的下标
    partnerIndex: -1,      // 我选的队友下标
    // 队伍分组: teamA=[myIndex, partnerIndex], teamB=另外两位
    teamA: [],
    teamB: [],

    // ---- 名次选择 ----
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

    // ---- 预览 ----
    previewReady: false,
    previewScores: [],   // [{nickname, delta}]
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
        const myOpenid = app.globalData?.userInfo?.openid || app.getUserInfo()?.openid;
        const myIndex = d.players.findIndex(p => p.openid === myOpenid);
        this.setData({
          gameName: d.name,
          currentRound: d.currentRound,
          isHost: d.hostOpenid === myOpenid,
          currentLevel: d.currentLevel || '2',
          players: d.players,
          myIndex,
          rounds: d.rounds,
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

  // ============ 选队友 ============

  onPickPartner(e) {
    const { pi } = e.currentTarget.dataset;
    const { myIndex } = this.data;
    if (pi === myIndex) return; // 不能选自己

    const players = this.data.players;
    // 另外两位为对方队
    const teamA = [myIndex, pi];
    const teamB = players.map((_, i) => i).filter(i => !teamA.includes(i));

    this.setData({ partnerIndex: pi, teamA, teamB });
  },

  confirmPartner() {
    if (this.data.partnerIndex === -1) {
      wx.showToast({ title: '请先选择本局队友', icon: 'none' });
      return;
    }
    this.setData({ step: 'pick-rank' });
  },

  backToPickPartner() {
    this.setData({
      step: 'pick-partner',
      partnerIndex: -1,
      teamA: [],
      teamB: [],
      rankIndexes: [-1, -1, -1, -1],
      rankSelections: ['', '', '', ''],
      usedIndexes: { 0: false, 1: false, 2: false, 3: false },
      selectedCount: 0,
      previewReady: false,
    });
  },

  // ============ 选名次 ============

  onPickAvatar(e) {
    const { rank, pi } = e.currentTarget.dataset;
    const { rankIndexes, rankSelections, players } = this.data;

    const usedByOther = rankIndexes.some((idx, r) => idx === pi && r !== rank);
    if (usedByOther) return;

    let newIndexes = [...rankIndexes];
    let newSelections = [...rankSelections];

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
      this.calcPreviewScore(newIndexes);
    } else {
      this.setData({ previewReady: false });
    }
  },

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
   * 积分规则（个人版）：
   * - 判断第一名所在队（teamA or teamB）
   * - 一二名同队 → 胜队各人 +300/2=150，败队 +0
   * - 一三名同队 → 胜队各人 +200/2=100，败队 +0
   * - 一四名同队 → 胜队各人 +100/2=50，败队 +0
   */
  calcPreviewScore(rankIndexes) {
    const { teamA, teamB, players } = this.data;
    const teamASet = new Set(teamA);
    const teamBSet = new Set(teamB);

    const rank1 = rankIndexes[0];
    const rank2 = rankIndexes[1];
    const rank4 = rankIndexes[3];

    const isSameTeam = (a, b) => {
      return (teamASet.has(a) && teamASet.has(b)) || (teamBSet.has(a) && teamBSet.has(b));
    };

    let score = 0;
    let caseText = '';

    if (isSameTeam(rank1, rank2)) {
      score = 300;
      caseText = '一、二名同队（300分局）';
    } else if (!isSameTeam(rank1, rank4)) {
      score = 200;
      caseText = '一、三名同队（200分局）';
    } else {
      score = 100;
      caseText = '一、四名同队（100分局）';
    }

    const firstTeamIsA = teamASet.has(rank1);
    const winTeam = firstTeamIsA ? teamASet : teamBSet;
    const perPersonScore = score / 2;

    const previewScores = players.map((p, i) => ({
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      delta: winTeam.has(i) ? perPersonScore : 0,
    }));

    this.setData({
      previewReady: true,
      previewScores,
      scoreCase: caseText,
    });
  },

  async submitRound() {
    const { gameId, rankIndexes, previewScores, scoreCase, currentRound, teamA, teamB } = this.data;
    if (!this.data.previewReady) return;
    if (this._submitting) return;

    const confirmContent = previewScores.map(p =>
      `${p.nickname}: ${p.delta > 0 ? '+' + p.delta : '0'}`
    ).join('  ');

    wx.showModal({
      title: '确认提交',
      content: `${scoreCase}\n${confirmContent}`,
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
                teamA,
                teamB,
                caseText: scoreCase,
              }
            });

            if (result.result.success) {
              if (!result.result.duplicate) {
                wx.vibrateShort({ type: 'light' });
              }

              // 重置到选队友步骤
              this.setData({
                step: 'pick-partner',
                partnerIndex: -1,
                teamA: [],
                teamB: [],
                rankIndexes: [-1, -1, -1, -1],
                rankSelections: ['', '', '', ''],
                usedIndexes: { 0: false, 1: false, 2: false, 3: false },
                selectedCount: 0,
                previewReady: false,
              });

              this.loadGameData();
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

  onShareAppMessage() {
    return { title: '转蛋积分', path: '/pages/home/home' };
  }
});
