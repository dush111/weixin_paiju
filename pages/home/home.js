// pages/home/home.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    totalScore: 0,
    rankText: '新手牌手',
    todayDate: '',
    todayStats: { games: 0, score: 0, wins: 0 },
    recentGames: [],
    activeGames: [],
  },

  onLoad() {
    this.initDate();
  },

  onShow() {
    this.refreshUserState();
  },

  initDate() {
    const today = new Date();
    this.setData({
      todayDate: `${today.getMonth() + 1}月${today.getDate()}日`
    });
  },

  refreshUserState() {
    const userInfo = app.getUserInfo();
    const isLoggedIn = !!userInfo;
    this.setData({ userInfo, isLoggedIn });
    if (isLoggedIn) {
      this.loadData();
    }
  },

  // 点击头像区域 → 未登录则跳转个人中心登录，已登录也跳个人中心
  onAvatarTap() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  async loadData() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getHomeData',
        data: {}
      });
      if (res.result.success) {
        const { totalScore, todayStats, recentGames, activeGames } = res.result.data;
        this.setData({
          totalScore,
          todayStats,
          recentGames: recentGames.map(g => this.formatGame(g)),
          activeGames: (activeGames || []).map(g => this.formatActiveGame(g)),
          rankText: this.getRankText(totalScore)
        });
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  },

  formatActiveGame(game) {
    const names = (game.players || []).map(p => p.nickname).join('、');
    return {
      ...game,
      playersText: names || '等待玩家',
      currentRound: game.rounds ? game.rounds.length + 1 : 1,
    };
  },

  formatGame(game) {
    const date = new Date(game.createdAt);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const playerNames = game.players
      .filter(p => p.openid !== app.globalData.userInfo?.openid)
      .map(p => p.nickname)
      .slice(0, 2)
      .join('、');

    return {
      ...game,
      formattedDate: `${m}月${d}日`,
      playersText: playerNames ? `与${playerNames}等` : '牌局记录',
    };
  },

  getRankText(score) {
    if (score >= 10000) return '掼蛋宗师';
    if (score >= 5000) return '掼蛋高手';
    if (score >= 2000) return '资深牌手';
    if (score >= 500) return '进阶牌手';
    return '新手牌手';
  },

  // 需要登录的操作统一检查
  requireLogin(callback) {
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '需要登录',
        content: '请先登录后再使用此功能',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
      return false;
    }
    if (callback) callback();
    return true;
  },

  createGame() {
    this.requireLogin(() => {
      wx.navigateTo({ url: '/pages/create-game/create-game' });
    });
  },

  joinGame() {
    this.requireLogin(() => {
      wx.navigateTo({ url: '/pages/join-game/join-game' });
    });
  },

  resumeGame(e) {
    if (!this.requireLogin()) return;
    const { id, status } = e.currentTarget.dataset;
    if (status === 'playing') {
      wx.navigateTo({ url: `/pages/scoring/scoring?gameId=${id}` });
    } else {
      wx.navigateTo({ url: `/pages/waiting-room/waiting-room?gameId=${id}` });
    }
  },

  goToMyGames() {
    wx.switchTab({ url: '/pages/my-games/my-games' });
  },

  goToAnnualStats() {
    wx.switchTab({ url: '/pages/annual-stats/annual-stats' });
  },

  goToGameDetail(e) {
    if (!this.requireLogin()) return;
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/game-detail/game-detail?id=${id}` });
  },
});
