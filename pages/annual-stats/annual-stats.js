// pages/annual-stats/annual-stats.js
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    selectedYear: new Date().getFullYear(),
    stats: {
      totalScore: 0,
      totalGames: 0,
      wins: 0,
      winRate: 0,
      avgScore: 0,
      avgRounds: 0,
      bestStreak: 0,
    },
    rankDist: [
      { rank: 1, count: 0, pct: 0 },
      { rank: 2, count: 0, pct: 0 },
      { rank: 3, count: 0, pct: 0 },
      { rank: 4, count: 0, pct: 0 },
    ],
    monthlyData: [],
    topPartners: [],
    yearlySummary: null,
  },

  onShow() {
    const userInfo = app.getUserInfo();
    const isLoggedIn = !!userInfo;
    this.setData({ isLoggedIn });
    if (!userInfo) return;
    this.loadStats();
  },

  prevYear() {
    this.setData({ selectedYear: this.data.selectedYear - 1 });
    this.loadStats();
  },

  nextYear() {
    const now = new Date().getFullYear();
    if (this.data.selectedYear >= now) return;
    this.setData({ selectedYear: this.data.selectedYear + 1 });
    this.loadStats();
  },

  async loadStats() {
    wx.showLoading({ title: '加载中', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getAnnualStats',
        data: { year: this.data.selectedYear }
      });
      if (res.result.success) {
        const d = res.result.data;
        this.setData({
          stats: d.stats,
          rankDist: d.rankDist,
          monthlyData: this.buildMonthlyChart(d.monthlyData),
          topPartners: d.topPartners,
          yearlySummary: this.buildSummary(d.stats)
        });
      }
    } catch (err) {
      console.error('加载年度数据失败:', err);
    } finally {
      wx.hideLoading();
    }
  },

  buildMonthlyChart(monthlyData) {
    const maxAbs = Math.max(...monthlyData.map(m => Math.abs(m.score)), 1);
    const maxBarH = 140; // rpx

    return monthlyData.map(m => ({
      ...m,
      barH: Math.max(Math.round(Math.abs(m.score) / maxAbs * maxBarH), 4)
    }));
  },

  buildSummary(stats) {
    if (stats.totalGames === 0) return null;

    if (stats.winRate >= 70) {
      return { emoji: '🏆', text: `这一年你战绩辉煌，胜率高达 ${stats.winRate}%，掌控全场！` };
    } else if (stats.winRate >= 50) {
      return { emoji: '💪', text: `这一年胜多负少，积分 ${stats.totalScore}，继续保持！` };
    } else if (stats.totalGames >= 50) {
      return { emoji: '🎯', text: `这一年共鏖战 ${stats.totalGames} 场，热情满满！` };
    } else {
      return { emoji: '🃏', text: `掼蛋路上没有一蹴而就，下一年继续加油！` };
    }
  }
});
