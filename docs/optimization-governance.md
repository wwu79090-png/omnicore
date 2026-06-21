# Optimization Governance

OmniCore 的优化闭环不只看单次 FPS，而是固定记录设备、帧预算、资源、包体、GC、合批和启动链路。

## Device Baseline

```bash
npm run performance:baseline -- --out docs/release-notes/device-performance-baseline.json
```

默认矩阵：

- Windows low-end integrated GPU
- Android mid-range WebView
- WeChat DevTools
- Chrome WebGPU

每个设备记录 `fps`、`p95FrameMs`、`memoryMb`、`drawCalls`、`gcEvents`、`packageBytes`，并要求附上 console error/warn 状态。

## Size Audit

```bash
npm run size:audit -- --out docs/release-notes/size-audit.json
```

审计桶：

- runtime
- editor
- examples
- docs
- assets
- npmTarball

## Performance Regression Gate

```bash
npm run performance:regression -- --baseline baseline.json --current current.json --out docs/release-notes/performance-regression-gate.json
```

默认阻断：

- FPS 下降超过 10%
- P95 frame time 上升超过 15%
- package bytes 上升超过 10%

## Runtime Dashboard

`createPerformanceDashboardSnapshot()` 把每帧拆成 `render`、`script`、`physics`、`assets`、`audio`、`gc` 六段，输出 frame budget 剩余量和瓶颈列表。

## Resource Waterfall

`createResourceWaterfall()` 记录资源开始、下载、解码、缓存命中和 fallback，帮助定位离线包、微信小游戏、字体和音频加载问题。

## Allocation Pressure

`createAllocationPressureReport()` 统计对象创建、复用和销毁，优先暴露每帧新建过多的 Sprite、Tween、Particle 或 Event 对象。

## Batch Diagnostics

`diagnoseBatchBreaks()` 解释 Draw Call 为什么没合批：texture、blendMode、shader、mask、material、layer。

## Startup Profile

`StartupProfiler` 用固定 mark 记录从 `new Game()` 到 first frame 的阶段耗时：JS 初始化、资源加载、字体加载、场景构建和首次渲染。
