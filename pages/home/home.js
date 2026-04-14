// pages/home/home.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    totalScore: 0,
    rankText: '新手牌手',
    todayDate: '',
    todayStats: { games: 0, score: 0, wins: 0 },
    recentGames: [],
    activeGames: [],   // 进行中 / 等待中的房间
  },

  onLoad() {
    this.initData();
  },

  onShow() {
    this.checkLogin();
    this.loadData();
  },

  checkLogin() {
    const userInfo = app.getUserInfo();
    if (!userInfo) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    this.setData({
      userInfo,
      todayDate: `${month}月${day}日`
    });
  },

  initData() {
    const userInfo = app.getUserInfo();
    if (userInfo) {
      const today = new Date();
      this.setData({
        userInfo,
        todayDate: `${today.getMonth()+1}月${today.getDate()}日`
      });
    }
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

  // 格式化进行中的游戏
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

  createGame() {
    wx.navigateTo({ url: '/pages/create-game/create-game' });
  },

  joinGame() {
    wx.navigateTo({ url: '/pages/join-game/join-game' });
  },

  // 点击进行中的房间，根据状态跳转不同页面
  resumeGame(e) {
    const { id, status } = e.currentTarget.dataset;
    if (status === 'playing') {
      wx.navigateTo({ url: `/pages/scoring/scoring?gameId=${id}` });
    } else {
      // waiting 状态 → 等待室
      wx.navigateTo({ url: `/pages/waiting-room/waiting-room?gameId=${id}` });
    }
  },

  goToMyGames() {
    wx.switchTab({ url: '/pages/my-games/my-games' });
  },

  goToAnnualStats() {
    wx.switchTab({ url: '/pages/annual-stats/annual-stats' });
  },

  goToNickname() {
    wx.navigateTo({ url: '/pages/nickname/nickname' });
  },

  goToGameDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/game-detail/game-detail?id=${id}` });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#e94560',
      success: (res) => {
        if (res.confirm) {
          // 清除本地用户信息
          app.clearUserInfo();
          wx.showToast({ title: '已退出登录', icon: 'success' });
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/login/login' });
          }, 800);
        }
      }
    });
  }
});
