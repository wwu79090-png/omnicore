# fps-monitor 插件示例

该插件演示最小插件结构：导出 `name`、`version` 和 `install({ game })`。

## 功能

- 在页面左上角显示 FPS。
- 通过 `game.loop.subscribe()` 统计帧率。
- 返回 `destroy()` 以便卸载。

## 运行

```bash
npm run dev
```

打开 `examples/plugins/fps-monitor/demo.html`。
