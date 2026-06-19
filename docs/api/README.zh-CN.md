# OmniCore API 中文速查

本文档是 OmniCore API 的中文入口，聚焦稳定的 2D Runtime 接口。

## 核心约定

- `OmniCore.Game(config)`：创建游戏实例。
- `EventBus.on(type, handler)` / `EventBus.emit(type, payload)`：模块间通信。
- `Store.set(key, value)` / `Store.get(key)` / `Store.watch(key, handler)`：响应式数据流。
- `Store.derive(name, deps, computeFn)`：基于依赖图定义派生状态。
- `OmniCore.Task.start(generator)` / `OmniCore.Task.wait(ms)`：独立定时器协程任务。
- `OmniCore.Query.inRadius(x, y, radius, filter)`：32x32 网格空间半径查询。
- `Input.bind(action, keys)`：将 `Ctrl+K` 等组合键映射为 `action:xxx` 事件。
- `Renderer.drawRect(x, y, width, height, color)`：统一渲染后端绘制矩形。
- `Renderer.drawText(text, x, y, options)`：统一渲染后端绘制文本。

## 调试接口

- `OmniCore.EditorOverlay`：`debug: true` 或 `editor: true` 时可挂载的运行时编辑浮层。
- `OmniCore.DebugConsole`：通过 WebSocket 转发移动端日志。
- `OmniCore.Genealogy()`：输出当前构建水印、时间戳和来源证明。

## 扩展接口

- `addon.init(context)`：插件初始化。
- `addon.destroy()`：插件销毁。
- `OmniCore.install(name, options)`：按插件市场协议安装第三方 Addon。
