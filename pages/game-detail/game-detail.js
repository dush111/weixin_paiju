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
        const rankLabels = ['第1名', '第2名', '第3名', '第4名'];
        const RANK_SCORES = [30, 15, 5, 1];

        // 按 rounds 中的 ranks 数组计算每位玩家的积分和最终名次
        const playerCount = (game.players || []).length;
        const totalScores = new Array(playerCount).fill(0);
        (game.rounds || []).forEach(round => {
          if (!round.ranks) return;
          round.ranks.forEach((playerIdx, rankPos) => {
            if (playerIdx >= 0 && playerIdx < playerCount) {
              totalScores[playerIdx] += RANK_SCORES[rankPos] !== undefined ? RANK_SCORES[rankPos] : 1;
            }
          });
        });

        // 按总积分降序排列得出最终名次
        const sortedIndexes = totalScores
          .map((s, i) => ({ i, s }))
          .sort((a, b) => b.s - a.s)
          .map(x => x.i);

        const players = (game.players || []).map((p, idx) => {
          const rankPos = sortedIndexes.indexOf(idx);
          return {
            ...p,
            score: totalScores[idx],
            rankLabel: rankLabels[rankPos] || `第${rankPos + 1}名`
          };
        });

        this.setData({
          game: {
            ...game,
            players,
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
  },

  onShareAppMessage() {
    const promise = new Promise(resolve => {
      setTimeout(() => {
        resolve({
          title: '转蛋积分'
        })
      }, 2000)
    })
    return {
      title: '转蛋积分',
      path: '/page/home/home.html',
      promise
    }
  }
});
