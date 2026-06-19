# OmniCore 市场对标报告

## 评分口径

本报告用于把 OmniCore 与常见 HTML5 / WebGL 游戏引擎做同一维度对标。评分不依赖新增运行时依赖，优先引用仓库内可重复执行的测试和 benchmark 输出。

| 维度 | 权重 | 当前目标 | 证据来源 |
| --- | ---: | ---: | --- |
| 2D 渲染性能 | 20 | 80 | `pixi1000SpriteFps`, `pixiDrawCalls` |
| 复杂场景压力 | 20 | 75 | `complexScene1200*` |
| 事件/逻辑系统 | 15 | 78 | nested AND/OR EventSheet + `VisualEventGraph.toEventTree()` |
| Worker/异步任务 | 10 | 72 | `WorkerManager` real Worker + watchdog |
| Tilemap/物理集成 | 15 | 70 | Tiled JSON + Matter-compatible body adapter |
| 生态工具 | 20 | 75 | editor plugin cascade + visual event-tree debugger + templates |

加权目标分：75/100。

## 本次市场压力包

`npm run benchmark` 会生成 `complexStress`：

- `entities`: 1200 active entities.
- `dynamicMaterials`: 4 material keys.
- `materialSwitches`: dynamic material-key swaps during the run.
- `collisionPairs`: AABB collision-pair spikes across the hot cluster.
- `drawCallsPerFrame`: renderer batch pressure.
- `sceneDiff`: Pixi incremental diff statistics.

阈值脚本会归一化为：

- `complexScene1200Fps`
- `complexScene1200DrawCalls`
- `complexScene1200CollisionPairs`
- `complexScene1200MaterialSwitches`

旧基线缺少这些字段时不会阻断；更新基线后这些指标会纳入回归门禁。

## 对市场引擎的定位

OmniCore 当前适合“HTML5 2D 优先 + 可选 Pixi + 轻量编辑器插件 + 快速小游戏导出”的项目。和大型商业引擎相比，优势是包体和上手复杂度低；短板仍在完整 3D 场景、动画资产生态、成熟编辑器和平台级调试工具。

本次补齐后，生态工具分从 58 提升到 75 的依据是：

- 官方编辑器插件级联路径已文档化。
- 可视化事件树调试器能展示导出前逻辑结构。
- `3d-physics` 模板把 3D 装饰层和物理适配作为固定脚手架。
- 复杂压力包可重复测量 1200 实体、材质切换、碰撞激增和 draw-call。

## 发布前检查

1. 运行 `npm test`。
2. 运行 `npm run benchmark`。
3. 将 `summary.complexScene1200*` 复制到发布说明或更新基线。
4. 如果 `complexScene1200Fps` 下降超过阈值，先检查 Pixi diff、对象池复用率和动态材质批次。
