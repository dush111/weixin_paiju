// 云函数：getMyGames
// 功能：获取用户的牌局列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { filter = 'all', page = 1, pageSize = 20 } = event;

  try {
    let query = db.collection('games').where({
      'players': _.elemMatch({ openid: OPENID })
    });

    if (filter === 'finished') {
      query = db.collection('games').where({
        'players': _.elemMatch({ openid: OPENID }),
        status: 'finished'
      });
    } else if (filter === 'playing') {
      query = db.collection('games').where({
        'players': _.elemMatch({ openid: OPENID }),
        status: _.in(['playing', 'waiting'])
      });
    }

    const skip = (page - 1) * pageSize;
    const [gamesRes, countRes] = await Promise.all([
      query.orderBy('createdAt', 'desc').skip(skip).limit(pageSize).get(),
      query.count()
    ]);

    const games = gamesRes.data;
    const total = countRes.total;

    // 计算汇总数据（仅第1页）
    let summary = { total: 0, wins: 0, totalScore: 0, winRate: 0 };
    if (page === 1) {
      const allRes = await db.collection('games')
        .where({
          'players': _.elemMatch({ openid: OPENID }),
          status: 'finished'
        })
        .field({ players: true, teamAScore: true, teamBScore: true })
        .limit(500)
        .get();

      const allGames = allRes.data;
      summary.total = total;

      allGames.forEach(g => {
        const me = g.players.find(p => p.openid === OPENID);
        if (!me) return;
        const myScore = me.team === 'A' ? g.teamAScore : g.teamBScore;
        const oppScore = me.team === 'A' ? g.teamBScore : g.teamAScore;
        summary.totalScore += myScore;
        if (myScore >= oppScore) summary.wins++;
      });

      summary.winRate = summary.total > 0
        ? Math.round(summary.wins / allGames.length * 100)
        : 0;
    }

    // 过滤win
    let filteredGames = games;
    if (filter === 'win') {
      filteredGames = games.filter(g => {
        const me = g.players.find(p => p.openid === OPENID);
        if (!me || g.status !== 'finished') return false;
        const myScore = me.team === 'A' ? g.teamAScore : g.teamBScore;
        const oppScore = me.team === 'A' ? g.teamBScore : g.teamAScore;
        return myScore >= oppScore;
      });
    }

    return {
      success: true,
      data: {
        games: filteredGames,
        summary,
        hasMore: skip + games.length < total
      }
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
