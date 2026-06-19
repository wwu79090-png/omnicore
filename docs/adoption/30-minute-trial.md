# OmniCore 30 分钟试用清单

这份清单用于让 Phaser、Construct、Cocos 或纯 Web 游戏开发者快速判断 OmniCore 是否值得继续投入。

## 0 到 10 分钟：跑通模板

```bash
npx create-omnicore-app omni-trial --template platformer
cd omni-trial
npm install
npm run dev
```

检查：

- 页面不是白屏。
- 角色能左右移动和 jump。
- 浏览器没有红色 console error/warn。
- Network 面板没有资源 404。

## 10 到 20 分钟：验证工程质量

```bash
npm test
npm run build
```

检查：

- `npm test` 通过。
- `npm run build` 通过。
- 构建产物能在本地 HTTP 服务下打开。
- 终端没有 warning 被忽略；如果是第三方或环境噪声，需要记录证据。

## 20 到 30 分钟：验证迁移价值

任选一个入口：

- Phaser 用户：按 `docs/migration/from-phaser.md` 迁移一个 Scene。
- Construct 用户：按 `docs/migration/from-construct.md` 迁移一组 Event Sheet。
- Cocos 用户：按 `docs/migration/from-cocos.md` 迁移一个 Component 或 Prefab。

最小验收：

- 一个场景能进入、更新、退出。
- 一个玩家输入能改变实体状态。
- 一个资源加载失败能显示明确错误或占位。
- 一个发布命令能生成可检查产物。

## 继续采用的判断

适合继续：

- 项目是 2D 或有限 2.5D。
- 目标平台是 Web、小游戏、桌面工具或轻量发布。
- 团队愿意用 JavaScript、测试和 CI 管理核心逻辑。

暂缓采用：

- 需要完整 3D 物理、3D 动画、主机发布或大型资产生态。
- 团队依赖成熟可视化编辑器完成全部生产。
- 当前项目已经用 Unity、Unreal、Godot 或 Cocos 稳定上线。
