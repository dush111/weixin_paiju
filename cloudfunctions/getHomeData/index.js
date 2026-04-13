// 云函数：getHomeData
// 功能：首页数据（今日战绩 + 最近牌局 + 总分）
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

    const [userRes, recentRes, todayRes] = await Promise.all([
      db.collection('users').where({ openid: OPENID }).limit(1).get(),
      db.collection('games')
        .where({ 'players': _.elemMatch({ openid: OPENID }) })
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get(),
      db.collection('games')
        .where({
          'players': _.elemMatch({ openid: OPENID }),
          status: 'finished',
          createdAt: _.gte(today).and(_.lt(tomorrow))
        })
        .get(),
    ]);

    const user = userRes.data[0] || {};
    const recentGames = recentRes.data;
    const todayGames = todayRes.data;

    // 今日战绩
    let todayScore = 0, todayWins = 0;
    todayGames.forEach(g => {
      const me = g.players.find(p => p.openid === OPENID);
      if (!me) return;
      const myScore = me.team === 'A' ? g.teamAScore : g.teamBScore;
      const oppScore = me.team === 'A' ? g.teamBScore : g.teamAScore;
      todayScore += myScore;
      if (myScore >= oppScore) todayWins++;
    });

    // 最近牌局数据
    const formattedGames = recentGames.map(g => {
      const me = g.players.find(p => p.openid === OPENID);
      const myTeam = me?.team || 'A';
      const myScore = myTeam === 'A' ? g.teamAScore : g.teamBScore;
      const myRank = me?.lastRank || 4;
      return {
        ...g,
        myRank,
        score: myScore,
        rounds: g.rounds?.length || 0,
      };
    });

    return {
      success: true,
      data: {
        totalScore: user.totalScore || 0,
        todayStats: {
          games: todayGames.length,
          score: todayScore,
          wins: todayWins,
        },
        recentGames: formattedGames,
      }
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
