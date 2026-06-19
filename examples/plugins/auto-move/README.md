# auto-move 插件示例

该插件演示如何把实体行为封装成可安装插件。

## 功能

- 接收 `target` 精灵。
- 使用 `game.loop.subscribe()` 每帧移动实体。
- 到达边界后自动反向。

## 运行

```bash
npm run dev
```

打开 `examples/plugins/auto-move/demo.html`。
