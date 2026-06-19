# Interactive Debugging Guide

## 快速启动

```bash
npm install
npm run dev
```

点击场景中的互动对象，观察 EventSheet、BehaviorTree 和 Store 中的剧情文本变化。

## npm test 失败

该模板默认不内置测试脚本。如果你添加了 `npm test`，失败时按顺序检查：

1. 点击事件是否提供了正确的 `x/y` 坐标。
2. EventSheet 初始状态是否在每个测试前重置。
3. BehaviorTree action 是否返回 `true`。
4. `game.store` 断言是否等待事件处理结束。

## 常见问题

点击没有反应：确认点击坐标落在互动对象矩形范围内。

剧情文本重复：在每次测试或重新进入场景前重置 `story.flag` 和 `story.line`。

页面空白：运行 `npm run dev` 后打开 Console，优先修复模块导入和资源 404。
