# OmniCore 开发者体验手册

OmniCore 的开发体验目标是：小项目能直接开跑，大项目能持续维护，出现问题时能快速定位和回滚。

## 调试

- `debug: true` 会启用性能面板、Live Inspector、F1 API 速查面板和移动端日志转发入口。
- Live Inspector 显示当前场景实体树，点击实体后可以直接修改 `x`、`y`、`scaleX`、`scaleY`，画面同步刷新。
- 按 `F1` 弹出常用 API 速查，覆盖 `Game`、`Scene`、`Sprite`、`Store`、`Renderer`、`Backend` 等高频方法。

```js
await new OmniCore.Game({
  parent: '#game',
  debug: true,
  feedback: true
}).init();
```

## 性能分析

- PerformanceMonitor 显示 FPS、渲染耗时、实体数量和内存信息。
- Loop 内置防卡死检测：连续 3 帧更新耗时超过 120ms 时会停止循环并输出定位信息。
- Store 在开发模式下会嗅探类型变化，发现与初始类型不一致时输出黄色警告。

## 热更新

`HotReload` 可以在开发期监听资源和配置变更。建议只用于本地调试，生产构建关闭。

## 即时帮助

- `OmniCore.help('Game')` 会打印并返回 API 描述、参数、示例代码和返回值说明。
- `debug: true` 会启用 `TutorialGuide`，在页面上高亮带有 `data-omnicore-api` 的 API 位置。
- 开发者使用报告只在 `debug: true` 下记录 API 调用，游戏结束时写入 `globalThis.__OmniCore_DeveloperReport`。

## 错误诊断

`OmniCore.Console.analyzeError(error)` 会根据内置规则返回中文提示和文档链接。

### 对象未初始化

常见于 Scene、Entity 或 Renderer 尚未完成初始化时调用 `add`、`set`、`render`。

建议：确认 `await game.init()` 已完成，并在 Scene 生命周期内访问实体。

### 资源路径不可用

常见于 404、`Failed to load resource` 或 `asset-manifest.json` 路径不匹配。

建议：检查资源大小写、静态目录、manifest URL 和构建后的资源位置。

### WebGL 初始化失败

建议：将 `renderer` 设置为 `auto` 或 `canvas`，并检查设备/浏览器的 WebGL 支持。

### 场景未注册

建议：先执行 `game.scene.register(scene)`，再切换到对应场景。

### 运行时错误

建议：查看控制台堆栈、Live Inspector 和 Store 快照，优先定位最近修改的 Scene/资源/Store 数据。

## 在线试用

- `examples/playground.html`：官方示例库，每个示例都是独立 ES module，点击即可加载运行。
- `website/playground/index.html`：浏览器内在线 IDE，左侧编辑代码，右侧实时预览。

## 部署与迁移

```bash
npm run deploy -- --target vercel
omni-migrate --root src --report docs/release-notes/migration-report.json
```

`npm run deploy` 会执行构建、资源压缩和 CDN 上传流程。没有部署凭据时可使用 `--dry-run` 预览流程和分享链接字段。

`omni-migrate` 支持 v1.x 到 v2.x 的旧 API 重写规则，并输出 JSON 迁移报告。

```js
const game = await new OmniCore.Game({
  hotReload: { url: 'ws://localhost:35729' }
}).init();
```

## 真机日志

PC 端运行：

```bash
npm run log-server
```

手机端开启：

```js
new OmniCore.Game({
  debug: true,
  logForwarder: { url: 'ws://你的电脑IP:8787' }
});
```

控制台日志会通过 WebSocket 转发到 PC 终端。

## 备份保护

- `npm run snapshot -- --export snapshots/boss-room.json` 导出当前测试快照。
- `npm run snapshot -- --import snapshots/boss-room.json` 导入快照，便于快速跳转到指定测试场景。
- Storage 支持版本迁移脚本，读取旧版本存档时会先保留旧副本，再写入新结构。

## 发布前检查

```bash
npm run production-ready
npm run audit:assets
npm run dist:full
```

这些命令会分别输出上线审计报告、资源引用报告和完整离线包。
