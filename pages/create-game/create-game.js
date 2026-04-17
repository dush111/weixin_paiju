// pages/create-game/create-game.js
const app = getApp();

const BOT_NAMES = ['张三', '李四', '王五', '赵六', '陈七', '钱八', '周九', '吴十'];

Page({
  data: {
    step: 1,
    gameName: '',
    targetRounds: 10,
    roundOptions: [5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
    gameId: null,
    gameCode: '',
    qrCodeUrl: '',
    players: [],       // 真实加入的玩家
    filledPlayers: [], // 含机器人的4人展示列表
    teammateIndex: -1, // 房主选择的队友在 filledPlayers 中的下标（1/2/3）
    teamANames: '',
    teamBNames: '',
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
      gameName: `${userInfo.nickname}的牌局`
    });
  },

  onUnload() {
    this.stopPolling();
  },

  onGameNameInput(e) {
    this.setData({ gameName: e.detail.value });
  },

  selectRounds(e) {
    this.setData({ targetRounds: e.currentTarget.dataset.val });
  },

  async createGame() {
    const { gameName, targetRounds } = this.data;
    if (!gameName.trim()) {
      wx.showToast({ title: '请输入牌局名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'createGame',
        data: { gameName: gameName.trim(), targetRounds }
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
        // 更新真实玩家列表，保留已有机器人位置
        const { filledPlayers, teammateIndex } = this.data;
        const newFilled = [...filledPlayers];
        // 用真实玩家数据替换对应位置（保留机器人）
        players.forEach((p, i) => { newFilled[i] = p; });
        const updates = { players, filledPlayers: newFilled };
        if (players.length === 4 && filledPlayers.length < 4) {
          wx.vibrateShort({ type: 'medium' });
        }
        // 刷新队伍预览
        if (teammateIndex >= 0) {
          Object.assign(updates, this.calcTeamNames(newFilled, teammateIndex));
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

  // 选择队友
  selectTeammate(e) {
    const idx = e.currentTarget.dataset.index;
    const { filledPlayers, teammateIndex } = this.data;
    const newIdx = teammateIndex === idx ? -1 : idx;
    const updates = { teammateIndex: newIdx };
    if (newIdx >= 0) {
      Object.assign(updates, this.calcTeamNames(filledPlayers, newIdx));
    } else {
      updates.teamANames = '';
      updates.teamBNames = '';
    }
    this.setData(updates);
  },

  // 计算队伍名称预览
  calcTeamNames(filledPlayers, teammateIndex) {
    // A队：0（房主）+ teammateIndex；B队：其余两人
    const aNames = [filledPlayers[0], filledPlayers[teammateIndex]]
      .filter(Boolean).map(p => p.nickname).join(' & ');
    const bNames = [1, 2, 3].filter(i => i !== teammateIndex)
      .map(i => filledPlayers[i]).filter(Boolean).map(p => p.nickname).join(' & ');
    return { teamANames: aNames, teamBNames: bNames };
  },

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
    const { filledPlayers, teammateIndex, gameId } = this.data;
    if (filledPlayers.length < 4) return;
    if (teammateIndex < 0) {
      wx.showToast({ title: '请先选择你的队友', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '开始中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'startGame',
        data: {
          gameId,
          filledPlayers,   // 含机器人的4人完整列表
          teammateIndex,   // 房主的队友下标
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
  }
});
