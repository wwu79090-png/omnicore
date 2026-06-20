# OmniCore 30 分钟完整游戏 Demo

这是一个可玩的微型 dodge / collect 游戏，用来证明 OmniCore 不只是“能跑”，也能支撑一个完整小游戏闭环。

- 目标：收集能量块，躲开红色故障块。
- 输入：`A/D`、方向键或底部左右按钮移动。
- 结束：碰到故障块后显示失败状态，点击 Restart 可重开。
- 限制：只使用 OmniCore 核心功能：`Game`、`Scene`、`Sprite`、输入、场景更新和简单 AABB 碰撞。

## 运行

```bash
npm run dev
```

打开 `examples/full-game-demo/index.html`。这个例子适合作为“30 分钟制作一个简化版游戏”的实战案例骨架，所有逻辑都在 `main.js` 中。
