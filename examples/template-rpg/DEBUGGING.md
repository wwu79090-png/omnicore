# RPG Debugging Guide

## 快速启动

```bash
npm install
npm run dev
```

进入页面后使用方向键移动角色，靠近 NPC 或道具时观察 Store 和对话状态变化。

## npm test 失败

该模板默认不内置测试脚本。如果你添加了 `npm test`，失败时按顺序检查：

1. 测试是否初始化了 OmniCore canvas。
2. 背包或对话状态是否在每个用例前重置。
3. `game.store` 写入是否使用了正确 key。
4. 异步场景切换是否 `await game.scene.push(...)`。

## 常见问题

NPC 对话不触发：确认角色与 NPC 的距离判断阈值，并检查按键是否被浏览器页面滚动抢占。

背包显示不更新：检查 Store key 是否和 UI 读取 key 一致。

页面空白：先修复浏览器 Console 的 import 错误或资源 404，再检查场景注册名称。
