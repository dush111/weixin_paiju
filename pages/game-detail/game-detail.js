// pages/game-detail/game-detail.js
Page({
  data: {
    game: null,
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

        // 按 players[i].score 排序，score 是在 submitRound 中累计的个人积分
        const rankIcons = ['🥇', '🥈', '🥉', '4️⃣'];
        const rankLabels = ['第1名', '第2名', '第3名', '第4名'];

        const players = [...(game.players || [])]
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map((p, rankPos) => ({
            ...p,
            rankIcon: rankIcons[rankPos] || `${rankPos + 1}`,
            rankLabel: rankLabels[rankPos] || `第${rankPos + 1}名`,
            rankPos,
          }));

        this.setData({
          game: {
            ...game,
            players,
            formattedDate: `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`,
            statusText: statusMap[game.status] || '未知',
          },
        });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  onShareAppMessage() {
    return { title: '转蛋积分', path: '/pages/home/home' };
  }
});
