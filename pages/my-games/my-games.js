// pages/my-games/my-games.js
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    filters: [
      { key: 'all', label: '全部' },
      { key: 'finished', label: '已结束' },
      { key: 'playing', label: '进行中' },
      { key: 'win', label: '胜场' },
    ],
    activeFilter: 'all',
    games: [],
    summary: { total: 0, wins: 0, totalScore: 0, winRate: 0 },
    hasMore: false,
    loadingMore: false,
    page: 1,
    pageSize: 20,
    showDeleteModal: false,
    deleteTargetId: '',
    deleteTargetName: '',
    deleting: false,
  },

  onShow() {
    const userInfo = app.getUserInfo();
    const isLoggedIn = !!userInfo;
    this.setData({ isLoggedIn });
    if (!userInfo) {
      this.setData({ games: [], summary: { total: 0, wins: 0, totalScore: 0, winRate: 0 } });
      return;
    }
    this.setData({ page: 1, games: [] });
    this.loadGames();
  },

  setFilter(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeFilter: key, page: 1, games: [] });
    this.loadGames();
  },

  async loadGames() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMyGames',
        data: {
          filter: this.data.activeFilter,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      });
      if (res.result.success) {
        const { games, summary, hasMore } = res.result.data;
        const formatted = games.map(g => this.formatGame(g));
        this.setData({
          games: this.data.page === 1 ? formatted : [...this.data.games, ...formatted],
          summary,
          hasMore
        });
      }
    } catch (err) {
      console.error('加载牌局失败:', err);
    }
  },

  formatGame(game) {
    const RANK_SCORES = [30, 15, 5, 1];
    const myOpenid = app.globalData.userInfo?.openid;
    const myIdx = game.players.findIndex(p => p.openid === myOpenid);
    const myPlayer = myIdx >= 0 ? game.players[myIdx] : null;
    const myRank = myPlayer?.rank || 4;
    const myTeam = myPlayer?.team || '-';

    // 个人积分：遍历每轮 ranks 按名次累加
    let myScore = 0;
    (game.rounds || []).forEach(round => {
      if (!round.ranks) return;
      const rankPos = round.ranks.indexOf(myIdx);
      myScore += RANK_SCORES[rankPos] !== undefined ? RANK_SCORES[rankPos] : 1;
    });

    const otherPlayers = game.players
      .filter(p => p.openid !== myOpenid)
      .map(p => p.nickname)
      .slice(0, 2)
      .join('、');

    const date = new Date(game.createdAt);
    const formattedDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;

    const statusMap = { playing: '进行中', finished: '已结束', cancelled: '已取消' };

    const roundCount = game.rounds?.length || 0;
    const playerCount = game.players?.length || 0;
    // 四人已满且完成了全部计划局数 → 正常结束，不可删除
    const isCompleted = game.status === 'finished'
      && playerCount === 4
      && roundCount >= (game.targetRounds || 1);

    return {
      ...game,
      myRank,
      myScore,
      myTeam,
      playersText: otherPlayers ? `与${otherPlayers}等` : '牌局',
      formattedDate,
      statusText: statusMap[game.status] || '未知',
      rounds: roundCount,
      canDelete: !isCompleted,
    };
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.setData({ loadingMore: true, page: this.data.page + 1 });
    await this.loadGames();
    this.setData({ loadingMore: false });
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/game-detail/game-detail?id=${id}` });
  },

  confirmDelete(e) {
    const { id, name } = e.currentTarget.dataset;
    this.setData({
      showDeleteModal: true,
      deleteTargetId: id,
      deleteTargetName: name || '该牌局',
    });
  },

  cancelDelete() {
    this.setData({ showDeleteModal: false, deleteTargetId: '', deleteTargetName: '' });
  },

  async doDelete() {
    if (this.data.deleting) return;
    const targetId = this.data.deleteTargetId;
    this.setData({ deleting: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteGame',
        data: { gameId: targetId }
      });
      if (res.result.success) {
        wx.showToast({ title: '已删除', icon: 'success' });
        this.setData({
          showDeleteModal: false,
          deleteTargetId: '',
          deleteTargetName: '',
          deleting: false,
          page: 1,
          games: [],
        });
        this.loadGames();
      } else {
        wx.showToast({ title: res.result.message || '删除失败', icon: 'none' });
        this.setData({ deleting: false });
      }
    } catch (err) {
      console.error('deleteGame error:', err);
      wx.showToast({ title: '删除失败：' + (err.message || '请重试'), icon: 'none' });
      this.setData({ deleting: false });
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
