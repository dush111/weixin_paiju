// pages/create-game/create-game.js
const app = getApp();

const BOT_NAMES = ['张三', '李四', '王五', '赵六', '陈七', '钱八', '周九', '吴十'];

Page({
  data: {
    // 模式选择：'standard' | 'simple'
    gameMode: 'standard',
    step: 1,
    gameName: '',
    // 简易模式：本地直接填4个玩家名字
    simplePlayers: ['', '', '', ''],
    gameId: null,
    gameCode: '',
    qrCodeUrl: '',
    players: [],
    filledPlayers: [],
    pollingTimer: null,
  },

  onLoad() {
    const userInfo = app.getUserInfo();
    if (!userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/profile/profile' });
      }, 800);
      return;
    }
    this.setData({
      players: [userInfo],
      filledPlayers: [userInfo],
      gameName: `${userInfo.nickname}的牌局`,
      simplePlayers: [userInfo.nickname || '玩家1', '玩家2', '玩家3', '玩家4'],
    });
  },

  onUnload() {
    this.stopPolling();
  },

  onGameNameInput(e) {
    this.setData({ gameName: e.detail.value });
  },

  selectMode(e) {
    this.setData({ gameMode: e.currentTarget.dataset.mode });
  },

  onSimplePlayerInput(e) {
    const { index } = e.currentTarget.dataset;
    const simplePlayers = [...this.data.simplePlayers];
    simplePlayers[index] = e.detail.value;
    this.setData({ simplePlayers });
  },

  // 简易模式：直接开始，无需等待房间
  startSimpleGame() {
    const { gameName, simplePlayers } = this.data;
    if (!gameName.trim()) {
      wx.showToast({ title: '请输入牌局名称', icon: 'none' });
      return;
    }
    const names = simplePlayers.map(n => n.trim());
    if (names.some(n => !n)) {
      wx.showToast({ title: '请填写4位玩家名称', icon: 'none' });
      return;
    }
    // 名字不能重复
    if (new Set(names).size !== 4) {
      wx.showToast({ title: '玩家名称不能重复', icon: 'none' });
      return;
    }
    const userInfo = app.getUserInfo();
    const players = names.map((name, i) => ({
      openid: i === 0 ? (userInfo?.openid || 'host') : `simple_${i}`,
      nickname: name,
      avatarUrl: i === 0 ? (userInfo?.avatarUrl || '') : '',
      isHost: i === 0,
      position: i,
      score: 0,
    }));
    // 将玩家信息传给 simple-scoring 页面（通过本地存储）
    wx.setStorageSync('simpleGameData', {
      gameName: gameName.trim(),
      players,
      rounds: [],
      createdAt: Date.now(),
    });
    wx.redirectTo({ url: '/pages/simple-scoring/simple-scoring' });
  },

  async createGame() {
    const { gameName } = this.data;
    if (!gameName.trim()) {
      wx.showToast({ title: '请输入牌局名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'createGame',
        data: { gameName: gameName.trim() }
      });

      if (res.result.success) {
        const { gameId, gameCode } = res.result.data;
        // 调用云函数生成二维码
        const qrRes = await wx.cloud.callFunction({
          name: 'generateQRCode',
          data: { text: gameCode }
        });
        const qrCodeUrl = qrRes.result.success ? qrRes.result.data : '';
        this.setData({
          step: 2,
          gameId,
          gameCode,
          qrCodeUrl
        });
        this.startPolling();
      } else {
        throw new Error(res.result.message);
      }
    } catch (err) {
      console.error('创建牌局失败:', err);
      wx.showToast({ title: '创建失败，请重试', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  // 轮询玩家加入状态
  startPolling() {
    const timer = setInterval(() => {
      this.pollPlayers();
    }, 2000);
    this.setData({ pollingTimer: timer });
  },

  stopPolling() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.setData({ pollingTimer: null });
    }
  },

  async pollPlayers() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGamePlayers',
        data: { gameId: this.data.gameId }
      });
      if (res.result.success) {
        const { players } = res.result.data;
        const { filledPlayers } = this.data;
        const newFilled = [...filledPlayers];
        players.forEach((p, i) => { newFilled[i] = p; });
        const updates = { players, filledPlayers: newFilled };
        if (players.length === 4 && filledPlayers.length < 4) {
          wx.vibrateShort({ type: 'medium' });
        }
        this.setData(updates);
      }
    } catch (err) {
      console.error('轮询失败:', err);
    }
  },

  // 一键填满：用随机机器人补足4人
  fillBots() {
    const { filledPlayers } = this.data;
    if (filledPlayers.length >= 4) return;
    const usedNames = filledPlayers.map(p => p.nickname);
    const availNames = BOT_NAMES.filter(n => !usedNames.includes(n));
    const newFilled = [...filledPlayers];
    while (newFilled.length < 4) {
      const name = availNames.splice(Math.floor(Math.random() * availNames.length), 1)[0] || `玩家${newFilled.length + 1}`;
      newFilled.push({
        openid: `bot_${Date.now()}_${newFilled.length}`,
        nickname: name,
        avatarUrl: '',
        isBot: true,
      });
    }
    this.setData({ filledPlayers: newFilled });
  },

  // 选择队友（已移除，队友每局在记分页选择）

  // 计算队伍名称预览（已移除）

  async copyGameCode() {
    const { gameCode, gameName } = this.data;
    const text = `【转蛋积分】邀请你加入「${gameName}」，口令：${gameCode}，快来掼蛋！`;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '口令已复制', icon: 'success' })
    });
  },

  onShareAppMessage() {
    const { gameId, gameName } = this.data;
    return {
      title: `邀请你加入「${gameName}」掼蛋牌局！`,
      path: `/pages/waiting-room/waiting-room?gameId=${gameId}`,
      imageUrl: '/assets/images/share-cover.png'
    };
  },

  onInviteShare() {
    // 分享由 open-type="share" 处理
  },

  async startGame() {
    const { filledPlayers, gameId } = this.data;
    if (filledPlayers.length < 4) return;

    wx.showLoading({ title: '开始中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'startGame',
        data: {
          gameId,
          filledPlayers,
        }
      });

      if (res.result.success) {
        this.stopPolling();
        wx.redirectTo({
          url: `/pages/scoring/scoring?gameId=${gameId}`
        });
      } else {
        wx.showToast({ title: res.result.message || '开始失败', icon: 'none' });
      }
    } catch (err) {
      console.error('开始游戏失败:', err);
      wx.showToast({ title: '操作失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  cancelGame() {
    wx.showModal({
      title: '取消牌局',
      content: '确定要取消本次牌局吗？',
      confirmColor: '#e94560',
      success: (res) => {
        if (res.confirm) {
          this.stopPolling();
          if (this.data.gameId) {
            wx.cloud.callFunction({
              name: 'cancelGame',
              data: { gameId: this.data.gameId }
            });
          }
          wx.navigateBack();
        }
      }
    });
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
