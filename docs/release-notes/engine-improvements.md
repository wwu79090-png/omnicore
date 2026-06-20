# OmniCore Engine Improvement Plan

Generated: 2026-06-20T07:25:20.987Z
Total opportunities: 55
P0/P1/P2/P3: 15/17/17/6
Evidence completion: 4/55 complete (7%)

## Phases
- 质量智能底座: Make every future engine weakness visible, ranked, and actionable before release. (3 items)
- 运行时性能极限: Push 2D runtime throughput, hot-path visibility, batching, culling, and worker ownership. (11 items)
- 开发者体验与迁移: Reduce the cost of moving from Phaser, Construct, Cocos, and Pixi-only stacks. (13 items)
- 编辑器生产化: Move the editor from useful tooling to daily production workflow. (7 items)
- 生态、插件与平台发布: Make plugins, templates, marketplace, and platform exports trustworthy. (9 items)
- 发布可信度与安全: Improve security, governance, compatibility, visual proof, and long-term maintenance. (12 items)

## Prioritized Backlog

| Priority | Area | Improvement | Evidence | First Action |
| --- | --- | --- | --- | --- |
| P0 | 运行时诊断 | runtime-frame-profiler-hotspots: FrameProfiler 输出 p95、最慢帧、热 section 和修复建议 | src/debug/FrameProfiler.js<br>tests/engine-improvement-planner.test.js | add profiler.summarize() |
| P0 | 性能趋势 | market-benchmark-trend-parity: 用历史趋势捕获 FPS 下滑、draw call 上涨、内存上涨和帧耗时回归 | src/quality/EngineQualityHarness.js<br>scripts/benchmark-threshold.js | add trend regression check |
| P0 | 持续改进 | improvement-backlog-ci: 把所有提升点固化成机器可读 backlog，并写入质量报告和 doctor | src/quality/ImprovementPlanner.js<br>scripts/engine-improvements.js | generate json backlog |
| P0 | 视觉回归 | golden-scene-visual-regression: 建立 10 个 golden scenes 和 0.1%-0.5% 像素阈值，覆盖编辑器、tilemap、UI、粒子和动画 | tests/e2e<br>scripts/compare-screenshots.js | add golden scene manifest |
| P0 | 插件安全 | plugin-sandbox-signing: 插件 manifest 权限、签名/sha256、危险脚本拦截和付费包密钥保护 | src/package/PluginInstaller.js<br>scripts/validate-marketplace-index.js | validate permissions |
| P0 | 迁移生态 | migration-codemod-parity: Phaser/Construct/Cocos 迁移分析器输出风险、API 对照和可执行 dry-run 报告 | scripts/omni-migrate.js<br>scripts/migration-helper.js<br>docs/migration | detect source engine patterns |
| P0 | 渲染后端 | webgpu-webgl-canvas-contract: WebGPU -> WebGL -> Canvas fallback contract 固化为测试和公开诊断 | src/renderer/WebGPURenderer.js<br>src/renderer/RendererManager.js | assert fallback order |
| P0 | Pixi 兼容 | pixi-lifecycle-parity: 验证 Pixi Application.init、canvas 绑定、texture/context destroy 和失败 fallback 生命周期 | src/renderer/PixiRenderer.js<br>src/renderer/PixiTextureLifecycle.js | add lifecycle parity tests |
| P0 | 首次脚手架 | create-app-e2e-proof: create-omnicore-app 生成项目后完成 install/build/run 的端到端闭环 | scripts/create-omnicore-app.mjs<br>create-omnicore-plugin-sdk | create temp project |
| P0 | 市场对标 | phaser-pixi-parity-harness: 同场景同设备对比 OmniCore、Phaser 3.80.1、PixiJS 的 FPS、draw calls、资源生命周期 | tests/benchmark<br>scripts/benchmark-core-systems.js | build parity scene fixture |
| P0 | 编辑器安全 | editor-live-sync-security: Live sync WebSocket 增加 origin、鉴权、大消息、分片和畸形帧防护测试 | packages/omnicore-editor/src/live-sync-server.js<br>packages/omnicore-editor/src/live-sync-protocol.js | add origin allowlist |
| P0 | 平台发布 | platform-export-artifacts: Web/移动/微信/桌面导出产物完整性和失败诊断统一验证 | scripts/export-platform.js<br>scripts/generate-mobile-shells.js<br>scripts/build-wechat.js | assert artifact manifests |
| P0 | 多线程渲染 | worker-render-ownership: OffscreenCanvas worker 提交帧命令并携带 pipelineOwner 元数据 | src/renderer/RenderWorkerBridge.js<br>src/renderer/OffscreenCanvasRenderer.js | normalize worker command schema |
| P0 | 批处理 | batching-material-atlas-diagnostics: 按 texture/material/blend 分组，输出 batch break reason，指导合图和材质优化 | src/renderer/WebGPURenderer.js<br>src/renderer/PixiBatchAdapter.js | collect batch-break stats |
| P0 | 场景逻辑 | scene-logic-sleep-wake-scale: 远距离实体 sleep/wake、offscreen logic 警告和长帧自动降级联动 | src/optimization/SleepWakeSystem.js<br>src/optimization/ViewportCulling.js | add distance policy presets |
| P1 | 渐进迁移 | phaser-compat-layer: 提供 Phaser Scene、add.sprite、physics、input 的兼容层，允许项目逐步替换 | src/compat/phaser<br>docs/migration/from-phaser.md | add compatibility facade |
| P1 | Pixi 生态借势 | pixi-ecosystem-bridge: 把 Pixi filters、spine、display object 常用能力封装成 OmniCore 风格 API | src/renderer/Filters.js<br>src/animation/SkeletalAnimation.js | add filter presets |
| P1 | 资产导入 | asset-toolchain-matrix: Tiled、Aseprite、TexturePacker、Spine 主流资源工具导入矩阵和失败诊断 | scripts/import-assets.js<br>scripts/asset-importer.js | add import matrix fixtures |
| P1 | 跨浏览器 | cross-browser-rendering-parity: Chrome/Firefox/WebKit 渲染一致性、worker fallback 和资源加载门禁 | playwright.config.js<br>tests/e2e | add rendering parity spec |
| P1 | 包体 | bundle-size-tree-shaking: lean/full 入口 tree-shaking 和包体预算，降低 Web 首屏加载成本 | src/index.js<br>src/lean/index.js<br>vite.config.js | measure lean bundle |
| P1 | 事件系统 | eventsheet-compiled-ast-cache: EventSheet 条件 AST、缓存编译和安全执行策略，减少每帧解释成本 | src/data/EventSheet.js<br>src/visualgraph/VisualEventGraph.js | expose condition AST |
| P1 | Tilemap/物理 | tilemap-binary-collision-bake: 静态 tile collision 合并为二进制 polygon/rect buffer，减少加载和碰撞同步成本 | src/tilemap/Tilemap.js<br>scripts/bake-tilemap-collisions.js | add binary serializer |
| P1 | 物理后端 | physics-backend-capability-matrix: Matter/Rapier/Box2D-WASM 能力矩阵和 fallback reason，避免用户误选后端 | src/physics/backends<br>docs/platforms | emit capability report |
| P1 | 资源管线 | asset-hmr-incremental-sub200: 资源监听增量构建、变更计数、目标 200ms 内热推送和失败恢复 | scripts/asset-watch-server.js<br>src/assets/ResourceHMRClient.js | add incremental report |
| P1 | 模板体验 | template-debugging-zero-warning: 所有官方模板包含调试手册、console warn/error 检查和资源 404 门禁 | examples/template-platformer<br>examples/template-rpg<br>examples/template-interactive | add template smoke script |
| P1 | API 稳定 | typed-api-contract-lifecycle: 公开 API 分层、deprecated removeIn 门禁、contract golden 与迁移建议联动 | tests/contract<br>docs/api/public-api-policy.md<br>scripts/audit-deprecated.js | gate missing removeIn |
| P1 | 编辑器 Live Play | editor-live-play-risk-gate: 编辑器改动和运行时 play mode 双向同步风险门禁，保留 console warning 可见 | packages/omnicore-editor/src/live-sync-protocol.js<br>src/editor/PlaySession.js | track sync latency |
| P1 | 编辑器场景联动 | editor-scene-entity-linking: 场景树、Inspector、运行时实体高亮和 prefab 溯源保持一致 | packages/omnicore-editor/src/editor-app.js<br>src/debug/LiveInspector.js | add entity highlight protocol |
| P1 | 低代码 | lowcode-export-roundtrip: EventSheet/BehaviorTree/UI_Layout/config-data 全量导入导出 roundtrip | packages/omnicore-editor/src/editor-app.js<br>src/visualgraph/VisualEventGraph.js | add roundtrip fixtures |
| P1 | 平台发布 | mobile-wechat-package-budget: 微信 4MB 包体、移动壳、平台资源变体和 debug proxy 做成统一 package budget | scripts/build-wechat.js<br>scripts/generate-mobile-shells.js | merge package budget report |
| P1 | 真实设备 | real-device-lab-matrix: iPhone/Android/低端机矩阵记录 FPS、内存、热状态、渲染后端和版本漂移 | docs/performance/device-baselines.json<br>scripts/update-device-baseline.js | add device trend schema |
| P1 | 错误诊断 | crash-error-fingerprint: CrashReporter/ErrorDiagnostics 给出错误指纹、源码位置、用户动作和恢复建议 | src/debug/CrashReporter.js<br>src/debug/ErrorDiagnostics.js | hash stack traces |
| P2 | 类型体验 | typescript-public-types: 生成或维护 public API .d.ts，并用类型测试保护团队项目采用体验 | typedoc.json<br>docs/api-typedoc | emit public declarations |
| P2 | API 版本 | api-semver-break-report: 基于 contract snapshot 输出 semver 破坏性变更报告 | scripts/contract/snapshot-api-contract.js<br>tests/contract/golden/omnicore-core-api.json | diff removed exports |
| P2 | 输入设备 | input-device-matrix: 键鼠、触摸、手柄、文本输入和 IME 行为统一测试矩阵 | src/input/InputManager.js<br>src/input/InputSequence.js<br>src/ui/UITextInput.js | add input fixture events |
| P2 | 移动音频 | audio-mobile-lifecycle: 移动端音频解锁、暂停恢复、混音组和延迟诊断 | src/audio/AudioManager.js<br>src/audio/AudioEditor.js | add unlock state machine |
| P2 | 热更新 | hotfix-rollout-safety: Hotfix 签名、版本回滚、灰度失败回退和审计日志 | src/hotfix/HotfixManager.js<br>scripts/ota-patch.js | verify patch signature |
| P2 | 在线试用 | playground-shareable-sandbox: Playground 增加分享链接、示例选择、错误面板和运行沙箱限制 | website/playground/index.html | serialize example state |
| P2 | 示例模板 | template-e2e-zero-console: 所有模板可构建、截图非空、无 console error/warn、无资源 404 | examples<br>tests/e2e | add template manifest |
| P2 | 网络/存档 | network-save-cloud-contract: 云存档、网络房间和离线回退契约，提供平台差异说明 | src/net<br>src/addons/SaveCloud.js | add save conflict strategy |
| P2 | 音频 | audio-memory-streaming: 音频资源 residency、流式加载、静音策略和移动端解锁诊断 | src/audio/AudioManager.js<br>src/audio/AudioEditor.js | track decoded audio memory |
| P2 | UI 系统 | ui-layout-accessibility: UI layout 约束、焦点、键盘/手柄导航和可访问性元数据 | src/ui<br>packages/omnicore-editor/src/editor-app.js | add focus manager |
| P2 | 可复现调试 | deterministic-replay-diagnostics: 输入、随机种子、时间步和存档快照可回放，定位偶现 bug | src/quality/EngineQualityHarness.js<br>src/input/InputSequence.js<br>src/core/Snapshot.js | record input timeline |
| P2 | AI 辅助创作 | ai-assisted-authoring-guardrails: AI 导入/命令服务加 schema、权限、dry-run diff 和回滚点 | src/ai/AICommandService.js<br>src/importer/AIImporter.js | validate generated patches |
| P2 | 文档检索 | docs-search-command-palette: API quick panel、教程、迁移文档和 CLI help 统一可搜索 | src/debug/ApiQuickPanel.js<br>src/help/HelpRegistry.js<br>docs/api-typedoc | index help entries |
| P2 | 发布自动化 | release-automation-announcement: release notes、changelog、docs、doctor、startup announcement 和部署证据统一生成 | scripts/deploy.js<br>scripts/update-changelog.js<br>docs/release-notes | merge release checklist |
| P2 | 供应链安全 | dependency-forensics-supply-chain: 依赖风险锁、deprecated audit、license、install script 和 maintainer 风险统一评分 | scripts/dependency-forensics.js<br>scripts/security-check.js | add license matrix |
| P2 | WASM | wasm-core-physics-packaging: WASM core、Box2D/Rapier 后端加载路径、缓存策略和失败 fallback 做成可诊断包 | src/wasm/WasmLoader.js<br>packages/omnicore-core-wasm | add wasm integrity report |
| P2 | 桌面编辑器 | electron-desktop-editor-packaging: Electron 打包、工作区恢复、崩溃保存、IPC 权限和自动更新预留 | packages/omnicore-editor/electron.main.cjs<br>packages/omnicore-editor/workspace.cjs | add crash-save fixture |
| P3 | 插件模板 | plugin-template-matrix: 提供 renderer、editor panel、asset importer、platform adapter 四类插件模板 | create-omnicore-plugin-sdk<br>examples/plugins | generate four template kinds |
| P3 | 故障知识库 | troubleshooting-knowledge-base: 资源 404、WebGL 不可用、移动音频失败、危险插件权限等失败样例库 | docs/troubleshooting<br>src/debug/ErrorDiagnostics.js | add failure catalog |
| P3 | 竞争仪表盘 | competitive-dashboard: 网站自动展示性能、包体、平台、插件数量、案例状态和市场对标趋势 | website/qa.html<br>docs/market-benchmark-report.md | generate benchmark dashboard |
| P3 | 社区生态 | community-plugin-review-ci: 插件提交流程、CI 审核、教程认证、示例工程和市场详情页自动生成 | .github/workflows/marketplace-review.yml<br>website/marketplace | add submission schema |
| P3 | 国际化 | internationalization-localization-pipeline: I18n/Localization 与编辑器文案、插件市场和游戏资源变体统一 | src/data/I18n.js<br>src/data/Localization.js | extract strings |
| P3 | 治理/LTS | governance-lts-compatibility: LTS、治理、兼容表、API lifecycle、案例证据和安全历史集中展示 | GOVERNANCE.md<br>LTS.md<br>docs/security/security.md | add compatibility matrix |

## Next Actions
- P0 golden-scene-visual-regression: npm run test:visual
- P0 migration-codemod-parity: npm test -- tests/market-adoption-readiness.test.js
- P0 webgpu-webgl-canvas-contract: npm test -- tests/omnicore-2d-extreme-runtime.test.js
- P0 pixi-lifecycle-parity: npm test -- tests/pixi-lifecycle-parity.test.js
- P0 create-app-e2e-proof: npm test -- tests/create-app-e2e.test.js
- P0 phaser-pixi-parity-harness: npm test -- tests/benchmark/phaser-pixi-parity.test.js && npm run benchmark
- P0 editor-live-sync-security: npm test -- tests/editor-live-sync-security.test.js
- P0 platform-export-artifacts: npm test -- tests/platform-export-artifacts.test.js
- P0 worker-render-ownership: npm test -- tests/omnicore-2d-extreme-runtime.test.js
- P0 batching-material-atlas-diagnostics: npm run benchmark:ci
- P0 scene-logic-sleep-wake-scale: npm test -- tests/performance-systems.test.js tests/performance-refactor.test.js
- P1 phaser-compat-layer: npm test -- tests/phaser-compat-layer.test.js
