// pages/game-detail/game-detail.js
Page({
  data: {
    game: null,
    winner: null,
  },

  onLoad(options) {
    const { id } = options;
    this.loadDetail(id);
  },

  async loadDetail(gameId) {
    wx.showLoading({ title: '加载中' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGameDetail',
        data: { gameId }
      });
      if (res.result.success) {
        const game = res.result.data;
        const date = new Date(game.createdAt);
        const statusMap = { playing: '进行中', finished: '已结束', cancelled: '已取消' };

        this.setData({
          game: {
            ...game,
            formattedDate: `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`,
            statusText: statusMap[game.status] || '未知'
          },
          winner: game.teamAScore > game.teamBScore ? 'A' : 'B'
        });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  }
});
