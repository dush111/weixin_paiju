// 云函数：getHomeData
// 功能：首页数据（今日战绩 + 最近牌局 + 总分 + 进行中/等待中的房间）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 并发查询：进行中&等待中 + 最近已结束 + 今日已结束 + 全部已结束（算总分）
    const [activeRes, recentRes, todayRes, allFinishedRes] = await Promise.all([
      // 进行中（playing）或等待中（waiting）的房间
      db.collection('games')
        .where({
          'players': _.elemMatch({ openid: OPENID }),
          status: _.in(['playing', 'waiting']),
        })
        .orderBy('updatedAt', 'desc')
        .limit(5)
        .get(),

      // 最近5条已结束的牌局
      db.collection('games')
        .where({
          'players': _.elemMatch({ openid: OPENID }),
          status: 'finished',
        })
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get(),

      // 今日已结束的牌局（算今日战绩）
      db.collection('games')
        .where({
          'players': _.elemMatch({ openid: OPENID }),
          status: 'finished',
          createdAt: _.gte(today).and(_.lt(tomorrow)),
        })
        .get(),

      // 全部已结束牌局（用于汇总总积分）
      db.collection('games')
        .where({
          'players': _.elemMatch({ openid: OPENID }),
          status: 'finished',
        })
        .limit(1000)
        .get(),
    ]);

    const activeGames = activeRes.data;
    const recentGames = recentRes.data;
    const todayGames = todayRes.data;
    const allFinishedGames = allFinishedRes.data;

    // 名次积分规则
    const RANK_SCORES = [30, 15, 5, 1];

    // 从全部已结束牌局汇总总积分（每局取最后一局的 lastRank）
    let totalScore = 0;
    allFinishedGames.forEach(g => {
      const me = g.players.find(p => p.openid === OPENID);
      if (!me) return;
      // 遍历每一局 round，找到该玩家的名次并累计积分
      const myIdx = g.players.findIndex(p => p.openid === OPENID);
      (g.rounds || []).forEach(round => {
        if (!round.ranks) return;
        const rankPos = round.ranks.indexOf(myIdx); // 0=第1名
        const s = RANK_SCORES[rankPos] !== undefined ? RANK_SCORES[rankPos] : 1;
        totalScore += s;
      });
    });

    // 今日战绩
    let todayScore = 0, todayWins = 0;
    todayGames.forEach(g => {
      const me = g.players.find(p => p.openid === OPENID);
      if (!me) return;
      const myIdx = g.players.findIndex(p => p.openid === OPENID);
      (g.rounds || []).forEach(round => {
        if (!round.ranks) return;
        const rankPos = round.ranks.indexOf(myIdx);
        todayScore += RANK_SCORES[rankPos] !== undefined ? RANK_SCORES[rankPos] : 1;
      });
      const myTeamScore = me.team === 'A' ? (g.teamAScore || 0) : (g.teamBScore || 0);
      const oppTeamScore = me.team === 'A' ? (g.teamBScore || 0) : (g.teamAScore || 0);
      if (myTeamScore >= oppTeamScore) todayWins++;
    });

    // 最近牌局格式化
    const formattedRecent = recentGames.map(g => {
      const me = g.players.find(p => p.openid === OPENID);
      const myTeam = me ? me.team : 'A';
      const myScore = myTeam === 'A' ? (g.teamAScore || 0) : (g.teamBScore || 0);
      const myRank = me ? (me.lastRank || 4) : 4;
      return {
        ...g,
        myRank,
        score: myScore,
        rounds: g.rounds ? g.rounds.length : 0,
      };
    });

    // 进行中房间格式化（只返回前端需要的字段，避免数据过大）
    const formattedActive = activeGames.map(g => ({
      _id: g._id,
      name: g.name || '掼蛋牌局',
      status: g.status,
      players: (g.players || []).map(p => ({ openid: p.openid, nickname: p.nickname })),
      rounds: g.rounds || [],
      totalRounds: g.totalRounds || 10,
      createdAt: g.createdAt,
    }));

    return {
      success: true,
      data: {
        totalScore,
        todayStats: {
          games: todayGames.length,
          score: todayScore,
          wins: todayWins,
        },
        recentGames: formattedRecent,
        activeGames: formattedActive,
      }
    };
  } catch (err) {
    console.error('getHomeData error:', err);
    return { success: false, message: err.message };
  }
};
