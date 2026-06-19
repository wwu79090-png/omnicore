# Platformer Debugging Guide

## 快速启动

```bash
npm install
npm run dev
```

打开 Vite 地址后，按 `ArrowLeft`、`ArrowRight` 移动，按 `Space` 或 `ArrowUp` jump。

## npm test 失败

该模板默认不内置测试脚本。如果你添加了 `npm test`，失败时按顺序检查：

1. 终端里的第一个 stack trace。
2. `src/main.js` 是否仍能被浏览器加载。
3. 测试环境是否模拟了键盘事件。
4. 断言是否等待了重力更新后的下一帧。

## 常见问题

角色不能跳：确认画布已经获得焦点，并检查 `velocity.y === 0` 的落地判断。

角色穿过地面：先降低重力或速度，再确认地面 y 坐标和角色高度匹配。

页面空白：运行 `npm run dev` 后打开浏览器 Console，优先修复资源 404 和 import 路径错误。
