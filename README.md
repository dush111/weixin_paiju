# 转蛋积分 - 微信小程序

> 掼蛋纸牌游戏循环积分记分工具

## 功能概览

| 页面 | 功能 |
|------|------|
| 登录页 | 微信授权一键登录 |
| 首页 | 用户信息、今日战绩、快捷入口、最近记录 |
| 新建牌局 | 创建房间、二维码/口令邀请、等待4人到场 |
| 等待室 | 扫码加入、实时显示玩家到场状态 |
| 记分页 | 选择名次、积分预览、实时同步、历史记录 |
| 我的牌局 | 历史记录列表、筛选、分页 |
| 年度战绩 | 年度积分、名次分布、月度趋势图、战友排行 |
| 更改昵称 | 修改显示名称 |
| 牌局详情 | 最终比分、玩家积分、逐局记录 |

---

## 积分规则

```
A队 = 位置0（玩家1）+ 位置2（玩家3）
B队 = 位置1（玩家2）+ 位置3（玩家4）

┌─────────────────────────────────────────┐
│ 情况          │ 说明              │ 得分 │
├─────────────────────────────────────────┤
│ 一、二名同队  │ 同队包揽前两名    │ +300 │
│ 一、三名同队  │ 第一第三在同队    │ +200 │
│ 一、四名同队  │ 队友包揽首末      │ +100 │
└─────────────────────────────────────────┘

没有第一名的那一队不得分。
```

---

## 项目结构

```
转蛋积分/
├── app.js                    # 应用入口
├── app.json                  # 全局配置
├── app.wxss                  # 全局样式
├── project.config.json       # 项目配置
├── sitemap.json
│
├── pages/
│   ├── login/               # 登录页
│   ├── home/                # 首页（tabBar）
│   ├── create-game/         # 新建牌局
│   ├── waiting-room/        # 等待室（受邀者）
│   ├── scoring/             # 记分页
│   ├── game-detail/         # 牌局详情
│   ├── my-games/            # 我的牌局（tabBar）
│   ├── annual-stats/        # 年度战绩（tabBar）
│   └── nickname/            # 更改昵称
│
├── cloudfunctions/           # 云函数（共11个）
│   ├── userLogin/           # 微信登录
│   ├── createGame/          # 创建牌局
│   ├── joinGame/            # 加入牌局
│   ├── getGamePlayers/      # 获取玩家列表（轮询）
│   ├── getGameInfo/         # 获取牌局基础信息
│   ├── startGame/           # 开始牌局
│   ├── getGameScore/        # 获取实时积分
│   ├── submitRound/         # 提交单局积分（核心）
│   ├── getMyGames/          # 获取历史牌局
│   ├── getGameDetail/       # 牌局详情
│   ├── getAnnualStats/      # 年度统计
│   ├── getHomeData/         # 首页数据
│   ├── updateNickname/      # 更新昵称
│   ├── cancelGame/          # 取消牌局
│   └── endGame/             # 结束牌局
│
└── database/
    └── init.js              # 数据库结构说明及示例数据
```

---

## 数据库设计

### `users` 集合

| 字段 | 类型 | 说明 |
|------|------|------|
| openid | string | 微信openid（唯一索引）|
| nickname | string | 显示昵称 |
| avatarUrl | string | 头像URL |
| totalScore | number | 累计积分 |
| totalGames | number | 总场次 |
| wins | number | 胜场数 |

### `games` 集合

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 牌局名称 |
| code | string | 6位邀请口令（唯一）|
| status | string | waiting/playing/finished/cancelled |
| players | array | 4名玩家信息（含队伍、位置、积分）|
| teamAScore | number | A队总积分 |
| teamBScore | number | B队总积分 |
| rounds | array | 逐局记录 |

---

## 部署步骤

### 1. 注册小程序

1. 前往 [微信公众平台](https://mp.weixin.qq.com) 注册小程序
2. 将 `project.config.json` 中的 `appid` 替换为你的 AppID

### 2. 开通云开发

1. 微信开发者工具中点击「云开发」
2. 创建云环境，记录**环境ID**
3. 将 `app.js` 中的 `cloudEnvId` 替换为实际环境ID

### 3. 创建数据库集合

在云开发控制台 → 数据库，创建以下集合：
- `users`（权限：仅创建者可读写）
- `games`（权限：所有用户可读，仅创建者可写）

**创建索引：**
- `users`：openid 字段，唯一索引
- `games`：code 字段（唯一），players.openid（数组），createdAt，status

### 4. 部署云函数

在微信开发者工具中，右键每个云函数目录 → 「上传并部署」

### 5. 配置 TabBar 图标

在 `assets/icons/` 目录下放置以下图标文件（推荐 81x81px PNG）：
- `home.png` / `home-active.png`
- `game.png` / `game-active.png`  
- `stats.png` / `stats-active.png`

---

## 前后端交互设计

```
前端 (小程序)          云函数               数据库
    │                     │                    │
    │── wx.cloud.callFunction ──►              │
    │                     │                    │
    │  登录流程：          │                    │
    │  userLogin    ──────►  查/创建 users ─►  │
    │                     │                    │
    │  新建牌局：          │                    │
    │  createGame   ──────►  写入 games   ─►   │
    │                     │                    │
    │  加入牌局：          │                    │
    │  joinGame     ──────►  更新 players ─►   │
    │                     │                    │
    │  轮询状态：          │                    │
    │  getGamePlayers─────►  读取 games   ◄─   │
    │  (每2秒)            │                    │
    │                     │                    │
    │  提交积分：          │                    │
    │  submitRound  ──────►  更新 rounds  ─►   │
    │                     │  更新 users   ─►   │
    │                     │                    │
```

---

## UI 设计规范

- **主题色**：深蓝黑背景 `#1a1a2e` + 红色强调 `#e94560`
- **辅助色**：金色 `#f5c518`（积分高亮）
- **字体**：系统字体 PingFang SC
- **圆角**：卡片 16-24rpx，按钮 50rpx（全圆）
- **阴影**：按钮带彩色阴影，增强层次感

---

## 注意事项

- 小程序基础库要求 `2.19.4+`
- 云开发需要在微信开发者工具中激活
- 生产环境需要将 `project.config.json` 中 `appid` 替换为真实 AppID
- 二维码生成需在云函数中调用 `wx.cloud.openapi.wxacode.getUnlimited`（需开通）
