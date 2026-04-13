/**
 * 转蛋积分 - 数据库初始化脚本
 * 在微信云开发控制台 -> 数据库 中执行
 * 或通过云函数调用
 *
 * 集合结构说明：
 * ========================
 *
 * 1. users 集合（用户信息）
 * {
 *   _id: string,           // 自动生成
 *   openid: string,        // 微信openid（唯一索引）
 *   nickname: string,      // 昵称
 *   avatarUrl: string,     // 微信头像
 *   totalScore: number,    // 累计积分
 *   totalGames: number,    // 总场次
 *   wins: number,          // 胜场次数
 *   createdAt: date,
 *   updatedAt: date
 * }
 *
 * 2. games 集合（牌局）
 * {
 *   _id: string,
 *   name: string,          // 牌局名称
 *   code: string,          // 6位口令（唯一索引）
 *   hostOpenid: string,    // 房主openid
 *   targetRounds: number,  // 计划局数
 *   currentRound: number,  // 当前局数
 *   status: string,        // waiting|playing|finished|cancelled
 *   players: [             // 最多4名玩家（位置固定）
 *     {
 *       openid: string,
 *       nickname: string,
 *       avatarUrl: string,
 *       team: 'A'|'B',    // A队：position 0,2；B队：position 1,3
 *       position: 0|1|2|3,
 *       isHost: boolean,
 *       score: number,     // 本局累计积分
 *       lastRank: number,  // 最后一局名次
 *     }
 *   ],
 *   teamAScore: number,    // A队总积分
 *   teamBScore: number,    // B队总积分
 *   rounds: [              // 逐局记录
 *     {
 *       roundNumber: number,
 *       ranks: [number, number, number, number], // 各名次对应player的position
 *       scoreA: number,    // A队本局得分
 *       scoreB: number,    // B队本局得分
 *       caseText: string,  // 积分说明
 *       recordedBy: string,// 记录者openid
 *       createdAt: date,
 *     }
 *   ],
 *   createdAt: date,
 *   updatedAt: date,
 *   startedAt: date,
 *   endedAt: date,
 * }
 */

// 数据库权限配置（在云开发控制台设置）：
// users集合：仅创建者可读写（安全规则）
// games集合：所有登录用户可读，创建者或参与者可写

// ================================
// 积分规则说明
// ================================
/**
 * 队伍划分：
 *   A队 = position 0 和 position 2 的玩家
 *   B队 = position 1 和 position 3 的玩家
 *
 * 积分规则（三种情况互斥）：
 *
 * 情况1 - 300分局：第一名和第二名在同一队
 *   获胜队 += 300，失败队 += 0
 *
 * 情况2 - 200分局：第一名和第三名在同一队
 *   获胜队 += 200，失败队 += 0
 *
 * 情况3 - 100分局：第一名和第四名在同一队（队友包揽首末）
 *   获胜队 += 100，失败队 += 0
 *
 * 注意：没有第一名的那一队不得分
 *
 * 判断逻辑（in submitRound云函数）：
 *   1. 确定第一名属于哪队（teamA = {position 0,2}，teamB = {position 1,3}）
 *   2. 若第一名和第二名同队 → 300分
 *   3. 否则检查第四名：若第一名和第四名同队 → 100分
 *   4. 其他情况（第一名和第三名同队） → 200分
 */

// ================================
// 数据库索引配置
// ================================
/**
 * users集合索引：
 *   - openid（唯一索引）
 *
 * games集合索引：
 *   - code（唯一索引）
 *   - hostOpenid（普通索引）
 *   - status + createdAt（复合索引，用于列表查询）
 *   - players.openid（数组索引，用于查找参与者的牌局）
 *   - createdAt（普通索引，用于时间范围查询）
 */

// ================================
// 初始化示例数据（用于测试）
// ================================
const sampleData = {
  users: [
    {
      openid: 'test_openid_1',
      nickname: '大王',
      avatarUrl: '',
      totalScore: 1500,
      totalGames: 10,
      wins: 6,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ],
  games: [
    {
      name: '示例牌局',
      code: 'ABC123',
      hostOpenid: 'test_openid_1',
      targetRounds: 10,
      currentRound: 3,
      status: 'finished',
      players: [
        { openid: 'test_openid_1', nickname: '大王', team: 'A', position: 0, isHost: true, score: 600 },
        { openid: 'test_openid_2', nickname: '二王', team: 'B', position: 1, isHost: false, score: 0 },
        { openid: 'test_openid_3', nickname: '三王', team: 'A', position: 2, isHost: false, score: 600 },
        { openid: 'test_openid_4', nickname: '四王', team: 'B', position: 3, isHost: false, score: 0 },
      ],
      teamAScore: 600,
      teamBScore: 0,
      rounds: [
        { roundNumber: 1, ranks: [0, 2, 1, 3], scoreA: 200, scoreB: 0, caseText: '一、三名同队（200分局）' },
        { roundNumber: 2, ranks: [0, 2, 3, 1], scoreA: 300, scoreB: 0, caseText: '一、二名同队（300分局）' },
        { roundNumber: 3, ranks: [1, 3, 0, 2], scoreA: 0, scoreB: 100, caseText: '一、四名同队（100分局）' },
      ],
    }
  ]
};

module.exports = sampleData;
