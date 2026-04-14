// 云函数：getAnnualStats
// 功能：获取年度战绩统计
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  const { year } = event;

  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  try {
    const { data: games } = await db.collection('games')
      .where({
        'players': _.elemMatch({ openid: OPENID }),
        status: 'finished',
        createdAt: _.gte(startDate).and(_.lt(endDate))
      })
      .limit(1000)
      .get();

    // 基础统计
    const RANK_SCORES = [30, 15, 5, 1];
    let totalScore = 0, wins = 0;
    const rankCounts = [0, 0, 0, 0]; // rank 1,2,3,4
    const monthlyMap = {};
    const partnerMap = {};
    let totalRounds = 0;
    let currentStreak = 0, bestStreak = 0;

    games.forEach(game => {
      const myIdx = game.players.findIndex(p => p.openid === OPENID);
      const me = game.players[myIdx];
      if (!me) return;

      const myTeamScore = me.team === 'A' ? game.teamAScore : game.teamBScore;
      const oppTeamScore = me.team === 'A' ? game.teamBScore : game.teamAScore;
      const isWin = myTeamScore >= oppTeamScore;

      // 按名次积分累加（每轮）
      let gameScore = 0;
      (game.rounds || []).forEach(round => {
        if (!round.ranks) return;
        const rankPos = round.ranks.indexOf(myIdx);
        gameScore += RANK_SCORES[rankPos] !== undefined ? RANK_SCORES[rankPos] : 1;
      });
      totalScore += gameScore;

      if (isWin) {
        wins++;
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }

      totalRounds += (game.rounds?.length || 0);

      // 月度积分（用本局名次积分之和）
      const date = new Date(game.createdAt);
      const month = date.getMonth() + 1;
      if (!monthlyMap[month]) monthlyMap[month] = 0;
      monthlyMap[month] += gameScore;

      // 名次分布（取各轮平均名次）
      if (game.rounds && game.rounds.length > 0) {
        const myRanks = game.rounds.map(r => {
          const posInRanks = r.ranks ? r.ranks.indexOf(myIdx) : -1;
          return posInRanks === -1 ? 4 : posInRanks + 1;
        });
        const avgRank = Math.round(myRanks.reduce((a, b) => a + b, 0) / myRanks.length);
        rankCounts[Math.min(avgRank, 4) - 1]++;
      }

      // 战友统计
      game.players.forEach(p => {
        if (p.openid === OPENID) return;
        if (!partnerMap[p.openid]) {
          partnerMap[p.openid] = { ...p, games: 0, wins: 0 };
        }
        partnerMap[p.openid].games++;
        if (p.team === me.team && isWin) partnerMap[p.openid].wins++;
      });
    });

    const totalGames = games.length;
    const winRate = totalGames > 0 ? Math.round(wins / totalGames * 100) : 0;

    // 名次分布百分比
    const rankDist = rankCounts.map((count, i) => ({
      rank: i + 1,
      count,
      pct: totalGames > 0 ? Math.round(count / totalGames * 100) : 0
    }));

    // 月度数据（1-12月）
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      score: monthlyMap[i + 1] || 0
    }));

    // 战友排行（按合作场次排序）
    const topPartners = Object.values(partnerMap)
      .sort((a, b) => b.games - a.games)
      .slice(0, 5)
      .map(p => ({
        ...p,
        winRate: p.games > 0 ? Math.round(p.wins / p.games * 100) : 0
      }));

    return {
      success: true,
      data: {
        stats: {
          totalScore,
          totalGames,
          wins,
          winRate,
          avgScore: totalGames > 0 ? Math.round(totalScore / totalGames) : 0,
          avgRounds: totalGames > 0 ? Math.round(totalRounds / totalGames) : 0,
          bestStreak,
        },
        rankDist,
        monthlyData,
        topPartners,
      }
    };
  } catch (err) {
    console.error(err);
    return { success: false, message: err.message };
  }
};
