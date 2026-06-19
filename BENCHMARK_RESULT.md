# OmniCore Benchmark Result

基准测试页位于 `tests/benchmark/benchmark.html`，可通过 Vite 或任意静态服务器打开。

## 项目

| 测试项 | 目标 | 输出字段 |
| --- | --- | --- |
| 1000 粒子渲染帧率 | 验证 Canvas/Pixi 降级后的基础绘制吞吐 | `particles1000.fps` |
| 500 实体状态同步 | 验证 Store/Entity 脏检查数据更新成本 | `entitySync500.ms` |
| 降级切换耗时 | 验证销毁旧画布并创建新画布的最小成本 | `backendSwitch.ms` |

## 当前样例结果

样例结果会因设备、浏览器和电源模式变化。以下结果来自本仓库在 2026-06-18 的本地 Playwright/Chromium headless 采样：

```json
{
  "summary": {
    "particles1000AvgFps": 60.33,
    "entitySync500AvgMs": 1.23,
    "canvas1000SpriteFps": 61,
    "pixi1000SpriteFps": 58
  },
  "backendSwitchRunsMs": [0.3, 0.3, 0.1]
}
```

移动端 profile（Playwright iPhone 12 配置）：

```json
{
  "particles1000AvgFps": 60,
  "entitySync500AvgMs": 1.2,
  "backendSwitchAvgMs": 0.37
}
```

备注：Pixi 1000 Sprite 在 headless Chromium 中实测为 58 FPS，低于显示器实际 RAF 的 60 FPS 目标；Canvas 后端和内置粒子负载稳定达到 60 FPS 级别。发布前应在真实桌面浏览器和目标移动设备上重新采样。

## 2026-06-18 内核优化验证

本轮新增 ECS、固定容量内存池、Pixi 命令缓冲和 DebugRenderer 后，执行了以下自动化验证：

```bash
npm test -- tests/kernel-optimization.test.js
npm test -- tests/omnicore.test.js tests/performance-systems.test.js tests/renderer-backends-mvp.test.js tests/render-chunk-physics-optimization.test.js
npm test
npm run lint
npm run build
npm run benchmark:ci
```

`npm run benchmark:ci` 本地输出：

| 指标 | 当前 | 判定 |
| --- | ---: | --- |
| `particles1000AvgFps` | 60.33 | 通过 |
| `canvas1000SpriteFps` | 60 | 通过 |
| `pixi1000SpriteFps` | 60 | 通过 |
| `entitySync500AvgMs` | 1.4 | 通过 |
| `backendSwitchAvgMs` | 0.3 | 通过 |
| `pixiDrawCalls` | 1 | 通过 |

ECS 5000 粒子微基准：

```json
{
  "entities": 5000,
  "frames": 60,
  "elapsedMs": 209.8,
  "estimatedFps": 286,
  "runtimeAllocations": 0,
  "storage": {
    "positionBytes": 40000,
    "velocityBytes": 40000
  }
}
```

说明：对象池 10 分钟 Chrome DevTools 内存快照与“1000 Sprite 每帧 500 个 zIndex 变化”的真实浏览器长跑未在本次自动化命令中执行；当前仓库已有的 headless benchmark gate 验证 Pixi 1000 Sprite 为 60 FPS、1 draw call，新增单元测试验证命令缓冲按图集优先、zIndex 次级排序并复用命令槽。

## 运行方式

```bash
npm run benchmark
```

脚本会启动临时 Vite 服务，打开 `tests/benchmark/benchmark.html`，并将结果写入终端。手动运行时页面会将结果写入 `window.__OMNICORE_BENCHMARK_RESULT__` 并显示在 `<pre>` 中。
