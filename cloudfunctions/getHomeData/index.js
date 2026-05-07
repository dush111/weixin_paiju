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
      const myIdx = g.players.findIndex(p => p.openid === OPENID);
      if (myIdx < 0) return;
      let myGameScore = 0;
      (g.rounds || []).forEach(round => {
        if (!round.ranks) return;
        const rankPos = round.ranks.indexOf(myIdx);
        const s = RANK_SCORES[rankPos] !== undefined ? RANK_SCORES[rankPos] : 1;
        myGameScore += s;
        todayScore += s;
      });
      // 以个人积分是否最高判断胜场（积分 >= 第2名视为胜）
      if (myGameScore >= RANK_SCORES[1]) todayWins++;
    });

    // 最近牌局格式化：分数取该局每轮名次积分之和
    const formattedRecent = recentGames.map(g => {
      const myIdx = g.players.findIndex(p => p.openid === OPENID);
      let myScore = 0;
      let myRank = 4;
      if (myIdx >= 0) {
        const rounds = g.rounds || [];
        rounds.forEach(round => {
          if (!round.ranks) return;
          const rankPos = round.ranks.indexOf(myIdx);
          myScore += RANK_SCORES[rankPos] !== undefined ? RANK_SCORES[rankPos] : 1;
        });
        // 取最后一局名次作为展示名次
        if (rounds.length > 0) {
          const lastRound = rounds[rounds.length - 1];
          if (lastRound.ranks) {
            myRank = (lastRound.ranks.indexOf(myIdx) + 1) || 4;
          }
        }
      }
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
