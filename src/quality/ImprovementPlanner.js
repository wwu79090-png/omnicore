const DEFAULT_GENERATED_AT = '1970-01-01T00:00:00.000Z';

const IMPROVEMENT_PHASES = [
  {
    id: 'phase-0-quality-intelligence',
    label: '质量智能底座',
    goal: 'Make every future engine weakness visible, ranked, and actionable before release.'
  },
  {
    id: 'phase-1-runtime-performance',
    label: '运行时性能极限',
    goal: 'Push 2D runtime throughput, hot-path visibility, batching, culling, and worker ownership.'
  },
  {
    id: 'phase-2-developer-experience',
    label: '开发者体验与迁移',
    goal: 'Reduce the cost of moving from Phaser, Construct, Cocos, and Pixi-only stacks.'
  },
  {
    id: 'phase-3-editor-production',
    label: '编辑器生产化',
    goal: 'Move the editor from useful tooling to daily production workflow.'
  },
  {
    id: 'phase-4-ecosystem-platform',
    label: '生态、插件与平台发布',
    goal: 'Make plugins, templates, marketplace, and platform exports trustworthy.'
  },
  {
    id: 'phase-5-release-trust',
    label: '发布可信度与安全',
    goal: 'Improve security, governance, compatibility, visual proof, and long-term maintenance.'
  }
];

const IMPROVEMENT_OPPORTUNITIES = [
  {
    id: 'runtime-frame-profiler-hotspots',
    phase: 'phase-0-quality-intelligence',
    priority: 'P0',
    area: '运行时诊断',
    improvement: 'FrameProfiler 输出 p95、最慢帧、热 section 和修复建议',
    evidence: ['src/debug/FrameProfiler.js', 'tests/engine-improvement-planner.test.js'],
    actions: ['add profiler.summarize()', 'add profiler.recommend()', 'surface hot sections in debug panels'],
    command: 'npm test -- tests/engine-improvement-planner.test.js'
  },
  {
    id: 'market-benchmark-trend-parity',
    phase: 'phase-0-quality-intelligence',
    priority: 'P0',
    area: '性能趋势',
    improvement: '用历史趋势捕获 FPS 下滑、draw call 上涨、内存上涨和帧耗时回归',
    evidence: ['src/quality/EngineQualityHarness.js', 'scripts/benchmark-threshold.js'],
    actions: ['add trend regression check', 'wire trend output into quality gate', 'document benchmark history'],
    command: 'npm test -- tests/engine-quality-harness.test.js tests/benchmark-threshold.test.js'
  },
  {
    id: 'improvement-backlog-ci',
    phase: 'phase-0-quality-intelligence',
    priority: 'P0',
    area: '持续改进',
    improvement: '把所有提升点固化成机器可读 backlog，并写入质量报告和 doctor',
    evidence: ['src/quality/ImprovementPlanner.js', 'scripts/engine-improvements.js'],
    actions: ['generate json backlog', 'generate markdown plan', 'include top next actions in reports'],
    command: 'node scripts/engine-improvements.js --out dist/engine-improvements.json'
  },
  {
    id: 'golden-scene-visual-regression',
    phase: 'phase-5-release-trust',
    priority: 'P0',
    area: '视觉回归',
    improvement: '建立 10 个 golden scenes 和 0.1%-0.5% 像素阈值，覆盖编辑器、tilemap、UI、粒子和动画',
    evidence: ['tests/e2e', 'scripts/compare-screenshots.js'],
    actions: ['add golden scene manifest', 'capture baseline screenshots', 'gate visual drift in CI'],
    command: 'npm run test:visual'
  },
  {
    id: 'plugin-sandbox-signing',
    phase: 'phase-4-ecosystem-platform',
    priority: 'P0',
    area: '插件安全',
    improvement: '插件 manifest 权限、签名/sha256、危险脚本拦截和付费包密钥保护',
    evidence: ['src/package/PluginInstaller.js', 'scripts/validate-marketplace-index.js'],
    actions: ['validate permissions', 'verify sha256/signature metadata', 'block lifecycle scripts by default'],
    command: 'npm test -- tests/plugin-installer-platform.test.js tests/plugin-marketplace-page.test.js'
  },
  {
    id: 'migration-codemod-parity',
    phase: 'phase-2-developer-experience',
    priority: 'P0',
    area: '迁移生态',
    improvement: 'Phaser/Construct/Cocos 迁移分析器输出风险、API 对照和可执行 dry-run 报告',
    evidence: ['scripts/omni-migrate.js', 'scripts/migration-helper.js', 'docs/migration'],
    actions: ['detect source engine patterns', 'emit OmniCore API replacements', 'write migration risk report'],
    command: 'npm test -- tests/market-adoption-readiness.test.js'
  },
  {
    id: 'webgpu-webgl-canvas-contract',
    phase: 'phase-1-runtime-performance',
    priority: 'P0',
    area: '渲染后端',
    improvement: 'WebGPU -> WebGL -> Canvas fallback contract 固化为测试和公开诊断',
    evidence: ['src/renderer/WebGPURenderer.js', 'src/renderer/RendererManager.js'],
    actions: ['assert fallback order', 'expose backend selection reason', 'test headless fallback'],
    command: 'npm test -- tests/omnicore-2d-extreme-runtime.test.js'
  },
  {
    id: 'pixi-lifecycle-parity',
    phase: 'phase-1-runtime-performance',
    priority: 'P0',
    area: 'Pixi 兼容',
    improvement: '验证 Pixi Application.init、canvas 绑定、texture/context destroy 和失败 fallback 生命周期',
    evidence: ['src/renderer/PixiRenderer.js', 'src/renderer/PixiTextureLifecycle.js'],
    actions: ['add lifecycle parity tests', 'assert texture ref-count release', 'document Pixi handoff boundaries'],
    command: 'npm test -- tests/pixi-lifecycle-parity.test.js'
  },
  {
    id: 'create-app-e2e-proof',
    phase: 'phase-2-developer-experience',
    priority: 'P0',
    area: '首次脚手架',
    improvement: 'create-omnicore-app 生成项目后完成 install/build/run 的端到端闭环',
    evidence: ['scripts/create-omnicore-app.mjs', 'create-omnicore-plugin-sdk'],
    actions: ['create temp project', 'verify package scripts', 'run generated build smoke'],
    command: 'npm test -- tests/create-app-e2e.test.js'
  },
  {
    id: 'phaser-pixi-parity-harness',
    phase: 'phase-1-runtime-performance',
    priority: 'P0',
    area: '市场对标',
    improvement: '同场景同设备对比 OmniCore、Phaser 3.80.1、PixiJS 的 FPS、draw calls、资源生命周期',
    evidence: ['tests/benchmark', 'scripts/benchmark-core-systems.js'],
    actions: ['build parity scene fixture', 'record third-party versions', 'publish comparison artifact'],
    command: 'npm test -- tests/benchmark/phaser-pixi-parity.test.js && npm run benchmark'
  },
  {
    id: 'editor-live-sync-security',
    phase: 'phase-3-editor-production',
    priority: 'P0',
    area: '编辑器安全',
    improvement: 'Live sync WebSocket 增加 origin、鉴权、大消息、分片和畸形帧防护测试',
    evidence: ['packages/omnicore-editor/src/live-sync-server.js', 'packages/omnicore-editor/src/live-sync-protocol.js'],
    actions: ['add origin allowlist', 'reject oversized frames', 'test malformed frame handling'],
    command: 'npm test -- tests/editor-live-sync-security.test.js'
  },
  {
    id: 'platform-export-artifacts',
    phase: 'phase-4-ecosystem-platform',
    priority: 'P0',
    area: '平台发布',
    improvement: 'Web/移动/微信/桌面导出产物完整性和失败诊断统一验证',
    evidence: ['scripts/export-platform.js', 'scripts/generate-mobile-shells.js', 'scripts/build-wechat.js'],
    actions: ['assert artifact manifests', 'capture platform-specific failure reasons', 'link budget reports'],
    command: 'npm test -- tests/platform-export-artifacts.test.js'
  },
  {
    id: 'worker-render-ownership',
    phase: 'phase-1-runtime-performance',
    priority: 'P0',
    area: '多线程渲染',
    improvement: 'OffscreenCanvas worker 提交帧命令并携带 pipelineOwner 元数据',
    evidence: ['src/renderer/RenderWorkerBridge.js', 'src/renderer/OffscreenCanvasRenderer.js'],
    actions: ['normalize worker command schema', 'track queue latency', 'fallback when OffscreenCanvas missing'],
    command: 'npm test -- tests/omnicore-2d-extreme-runtime.test.js'
  },
  {
    id: 'phaser-compat-layer',
    phase: 'phase-2-developer-experience',
    priority: 'P1',
    area: '渐进迁移',
    improvement: '提供 Phaser Scene、add.sprite、physics、input 的兼容层，允许项目逐步替换',
    evidence: ['src/compat/phaser', 'docs/migration/from-phaser.md'],
    actions: ['add compatibility facade', 'map lifecycle callbacks', 'warn on unsupported Phaser APIs'],
    command: 'npm test -- tests/phaser-compat-layer.test.js'
  },
  {
    id: 'pixi-ecosystem-bridge',
    phase: 'phase-2-developer-experience',
    priority: 'P1',
    area: 'Pixi 生态借势',
    improvement: '把 Pixi filters、spine、display object 常用能力封装成 OmniCore 风格 API',
    evidence: ['src/renderer/Filters.js', 'src/animation/SkeletalAnimation.js'],
    actions: ['add filter presets', 'normalize spine runtime adapter', 'test display object interop'],
    command: 'npm test -- tests/pixi-ecosystem-bridge.test.js'
  },
  {
    id: 'asset-toolchain-matrix',
    phase: 'phase-2-developer-experience',
    priority: 'P1',
    area: '资产导入',
    improvement: 'Tiled、Aseprite、TexturePacker、Spine 主流资源工具导入矩阵和失败诊断',
    evidence: ['scripts/import-assets.js', 'scripts/asset-importer.js'],
    actions: ['add import matrix fixtures', 'report unsupported fields', 'document source tool mapping'],
    command: 'npm test -- tests/asset-toolchain-matrix.test.js'
  },
  {
    id: 'cross-browser-rendering-parity',
    phase: 'phase-5-release-trust',
    priority: 'P1',
    area: '跨浏览器',
    improvement: 'Chrome/Firefox/WebKit 渲染一致性、worker fallback 和资源加载门禁',
    evidence: ['playwright.config.js', 'tests/e2e'],
    actions: ['add rendering parity spec', 'compare screenshots per browser', 'capture console errors'],
    command: 'npm run test:e2e -- tests/e2e/rendering-parity.spec.js'
  },
  {
    id: 'bundle-size-tree-shaking',
    phase: 'phase-2-developer-experience',
    priority: 'P1',
    area: '包体',
    improvement: 'lean/full 入口 tree-shaking 和包体预算，降低 Web 首屏加载成本',
    evidence: ['src/index.js', 'src/lean/index.js', 'vite.config.js'],
    actions: ['measure lean bundle', 'gate full bundle growth', 'document import patterns'],
    command: 'npm test -- tests/bundle-size-budget.test.js && npm run build'
  },
  {
    id: 'typescript-public-types',
    phase: 'phase-2-developer-experience',
    priority: 'P2',
    area: '类型体验',
    improvement: '生成或维护 public API .d.ts，并用类型测试保护团队项目采用体验',
    evidence: ['typedoc.json', 'docs/api-typedoc'],
    actions: ['emit public declarations', 'test common imports', 'link TypeDoc symbols'],
    command: 'npm test -- tests/types-public-api.test.js && npm run docs:typedoc'
  },
  {
    id: 'api-semver-break-report',
    phase: 'phase-5-release-trust',
    priority: 'P2',
    area: 'API 版本',
    improvement: '基于 contract snapshot 输出 semver 破坏性变更报告',
    evidence: ['scripts/contract/snapshot-api-contract.js', 'tests/contract/golden/omnicore-core-api.json'],
    actions: ['diff removed exports', 'classify semver impact', 'require migration note for breaking changes'],
    command: 'npm test -- tests/contract/api-semver.test.js'
  },
  {
    id: 'input-device-matrix',
    phase: 'phase-4-ecosystem-platform',
    priority: 'P2',
    area: '输入设备',
    improvement: '键鼠、触摸、手柄、文本输入和 IME 行为统一测试矩阵',
    evidence: ['src/input/InputManager.js', 'src/input/InputSequence.js', 'src/ui/UITextInput.js'],
    actions: ['add input fixture events', 'normalize gesture/gamepad mapping', 'test focus and IME paths'],
    command: 'npm test -- tests/input-device-matrix.test.js'
  },
  {
    id: 'audio-mobile-lifecycle',
    phase: 'phase-4-ecosystem-platform',
    priority: 'P2',
    area: '移动音频',
    improvement: '移动端音频解锁、暂停恢复、混音组和延迟诊断',
    evidence: ['src/audio/AudioManager.js', 'src/audio/AudioEditor.js'],
    actions: ['add unlock state machine', 'track resume failures', 'test mixer group volume'],
    command: 'npm test -- tests/audio-mobile-lifecycle.test.js'
  },
  {
    id: 'hotfix-rollout-safety',
    phase: 'phase-5-release-trust',
    priority: 'P2',
    area: '热更新',
    improvement: 'Hotfix 签名、版本回滚、灰度失败回退和审计日志',
    evidence: ['src/hotfix/HotfixManager.js', 'scripts/ota-patch.js'],
    actions: ['verify patch signature', 'add rollback manifest', 'test failed rollout recovery'],
    command: 'npm test -- tests/hotfix-rollout.test.js'
  },
  {
    id: 'playground-shareable-sandbox',
    phase: 'phase-2-developer-experience',
    priority: 'P2',
    area: '在线试用',
    improvement: 'Playground 增加分享链接、示例选择、错误面板和运行沙箱限制',
    evidence: ['website/playground/index.html'],
    actions: ['serialize example state', 'show runtime errors', 'limit unsafe browser APIs'],
    command: 'npm run test:e2e -- tests/e2e/playground.spec.js'
  },
  {
    id: 'template-e2e-zero-console',
    phase: 'phase-2-developer-experience',
    priority: 'P2',
    area: '示例模板',
    improvement: '所有模板可构建、截图非空、无 console error/warn、无资源 404',
    evidence: ['examples', 'tests/e2e'],
    actions: ['add template manifest', 'run browser smoke per template', 'fail on console warnings'],
    command: 'npm run test:e2e -- tests/e2e/templates-smoke.spec.js'
  },
  {
    id: 'plugin-template-matrix',
    phase: 'phase-4-ecosystem-platform',
    priority: 'P3',
    area: '插件模板',
    improvement: '提供 renderer、editor panel、asset importer、platform adapter 四类插件模板',
    evidence: ['create-omnicore-plugin-sdk', 'examples/plugins'],
    actions: ['generate four template kinds', 'test template install/build', 'document plugin author path'],
    command: 'npm test -- tests/plugin-template-matrix.test.js'
  },
  {
    id: 'troubleshooting-knowledge-base',
    phase: 'phase-2-developer-experience',
    priority: 'P3',
    area: '故障知识库',
    improvement: '资源 404、WebGL 不可用、移动音频失败、危险插件权限等失败样例库',
    evidence: ['docs/troubleshooting', 'src/debug/ErrorDiagnostics.js'],
    actions: ['add failure catalog', 'link diagnostics to docs', 'test knowledge-base lookup'],
    command: 'npm test -- tests/knowledge-base-console.test.js'
  },
  {
    id: 'competitive-dashboard',
    phase: 'phase-5-release-trust',
    priority: 'P3',
    area: '竞争仪表盘',
    improvement: '网站自动展示性能、包体、平台、插件数量、案例状态和市场对标趋势',
    evidence: ['website/qa.html', 'docs/market-benchmark-report.md'],
    actions: ['generate benchmark dashboard', 'link quality report fields', 'publish latest artifacts'],
    command: 'npm run benchmark && npm run docs:build'
  },
  {
    id: 'batching-material-atlas-diagnostics',
    phase: 'phase-1-runtime-performance',
    priority: 'P0',
    area: '批处理',
    improvement: '按 texture/material/blend 分组，输出 batch break reason，指导合图和材质优化',
    evidence: ['src/renderer/WebGPURenderer.js', 'src/renderer/PixiBatchAdapter.js'],
    actions: ['collect batch-break stats', 'warn on material churn', 'export atlas suggestions'],
    command: 'npm run benchmark:ci'
  },
  {
    id: 'scene-logic-sleep-wake-scale',
    phase: 'phase-1-runtime-performance',
    priority: 'P0',
    area: '场景逻辑',
    improvement: '远距离实体 sleep/wake、offscreen logic 警告和长帧自动降级联动',
    evidence: ['src/optimization/SleepWakeSystem.js', 'src/optimization/ViewportCulling.js'],
    actions: ['add distance policy presets', 'log offscreen active entities', 'feed adaptive quality manager'],
    command: 'npm test -- tests/performance-systems.test.js tests/performance-refactor.test.js'
  },
  {
    id: 'eventsheet-compiled-ast-cache',
    phase: 'phase-1-runtime-performance',
    priority: 'P1',
    area: '事件系统',
    improvement: 'EventSheet 条件 AST、缓存编译和安全执行策略，减少每帧解释成本',
    evidence: ['src/data/EventSheet.js', 'src/visualgraph/VisualEventGraph.js'],
    actions: ['expose condition AST', 'cache compiled predicates', 'reject unsafe expressions'],
    command: 'npm test -- tests/core-expansion.test.js tests/advanced-capabilities.test.js'
  },
  {
    id: 'tilemap-binary-collision-bake',
    phase: 'phase-1-runtime-performance',
    priority: 'P1',
    area: 'Tilemap/物理',
    improvement: '静态 tile collision 合并为二进制 polygon/rect buffer，减少加载和碰撞同步成本',
    evidence: ['src/tilemap/Tilemap.js', 'scripts/bake-tilemap-collisions.js'],
    actions: ['add binary serializer', 'add collision merge stats', 'verify physics adapter input'],
    command: 'npm test -- tests/render-chunk-physics-optimization.test.js tests/physics-backends.test.js'
  },
  {
    id: 'physics-backend-capability-matrix',
    phase: 'phase-1-runtime-performance',
    priority: 'P1',
    area: '物理后端',
    improvement: 'Matter/Rapier/Box2D-WASM 能力矩阵和 fallback reason，避免用户误选后端',
    evidence: ['src/physics/backends', 'docs/platforms'],
    actions: ['emit capability report', 'test unsupported features', 'document backend choice'],
    command: 'npm test -- tests/physics-backends.test.js'
  },
  {
    id: 'asset-hmr-incremental-sub200',
    phase: 'phase-2-developer-experience',
    priority: 'P1',
    area: '资源管线',
    improvement: '资源监听增量构建、变更计数、目标 200ms 内热推送和失败恢复',
    evidence: ['scripts/asset-watch-server.js', 'src/assets/ResourceHMRClient.js'],
    actions: ['add incremental report', 'record rebuild latency', 'retry failed asset update'],
    command: 'npm test -- tests/build-asset-pipeline.test.js tests/asset-pipeline-industrial.test.js'
  },
  {
    id: 'template-debugging-zero-warning',
    phase: 'phase-2-developer-experience',
    priority: 'P1',
    area: '模板体验',
    improvement: '所有官方模板包含调试手册、console warn/error 检查和资源 404 门禁',
    evidence: ['examples/template-platformer', 'examples/template-rpg', 'examples/template-interactive'],
    actions: ['add template smoke script', 'assert no console warnings', 'document common fixes'],
    command: 'npm test -- tests/build-game-demo-script.test.js'
  },
  {
    id: 'typed-api-contract-lifecycle',
    phase: 'phase-5-release-trust',
    priority: 'P1',
    area: 'API 稳定',
    improvement: '公开 API 分层、deprecated removeIn 门禁、contract golden 与迁移建议联动',
    evidence: ['tests/contract', 'docs/api/public-api-policy.md', 'scripts/audit-deprecated.js'],
    actions: ['gate missing removeIn', 'map deprecated to migration docs', 'fail unmanaged public surface growth'],
    command: 'npm run test:contract && npm run audit:deprecated'
  },
  {
    id: 'editor-live-play-risk-gate',
    phase: 'phase-3-editor-production',
    priority: 'P1',
    area: '编辑器 Live Play',
    improvement: '编辑器改动和运行时 play mode 双向同步风险门禁，保留 console warning 可见',
    evidence: ['packages/omnicore-editor/src/live-sync-protocol.js', 'src/editor/PlaySession.js'],
    actions: ['track sync latency', 'reject invalid patch path', 'surface runtime errors in editor panel'],
    command: 'npm test -- tests/live-edit-play-mode.test.js tests/editor-runtime-parity.test.js'
  },
  {
    id: 'editor-scene-entity-linking',
    phase: 'phase-3-editor-production',
    priority: 'P1',
    area: '编辑器场景联动',
    improvement: '场景树、Inspector、运行时实体高亮和 prefab 溯源保持一致',
    evidence: ['packages/omnicore-editor/src/editor-app.js', 'src/debug/LiveInspector.js'],
    actions: ['add entity highlight protocol', 'persist inspector patch provenance', 'test prefab roundtrip'],
    command: 'npm test -- tests/godot-style-editor-linking.test.js tests/editor-runtime-parity.test.js'
  },
  {
    id: 'lowcode-export-roundtrip',
    phase: 'phase-3-editor-production',
    priority: 'P1',
    area: '低代码',
    improvement: 'EventSheet/BehaviorTree/UI_Layout/config-data 全量导入导出 roundtrip',
    evidence: ['packages/omnicore-editor/src/editor-app.js', 'src/visualgraph/VisualEventGraph.js'],
    actions: ['add roundtrip fixtures', 'diff exported json', 'validate schema versions'],
    command: 'npm test -- tests/lowcode-editor-suite.test.js'
  },
  {
    id: 'mobile-wechat-package-budget',
    phase: 'phase-4-ecosystem-platform',
    priority: 'P1',
    area: '平台发布',
    improvement: '微信 4MB 包体、移动壳、平台资源变体和 debug proxy 做成统一 package budget',
    evidence: ['scripts/build-wechat.js', 'scripts/generate-mobile-shells.js'],
    actions: ['merge package budget report', 'include asset variant sizes', 'block oversized debug artifacts'],
    command: 'npm run build:wechat && npm run build:mobile && npm run performance:budget'
  },
  {
    id: 'real-device-lab-matrix',
    phase: 'phase-5-release-trust',
    priority: 'P1',
    area: '真实设备',
    improvement: 'iPhone/Android/低端机矩阵记录 FPS、内存、热状态、渲染后端和版本漂移',
    evidence: ['docs/performance/device-baselines.json', 'scripts/update-device-baseline.js'],
    actions: ['add device trend schema', 'compare latest device runs', 'publish SVG trend'],
    command: 'npm run benchmark:device-baseline'
  },
  {
    id: 'crash-error-fingerprint',
    phase: 'phase-5-release-trust',
    priority: 'P1',
    area: '错误诊断',
    improvement: 'CrashReporter/ErrorDiagnostics 给出错误指纹、源码位置、用户动作和恢复建议',
    evidence: ['src/debug/CrashReporter.js', 'src/debug/ErrorDiagnostics.js'],
    actions: ['hash stack traces', 'group repeated errors', 'surface recovery commands'],
    command: 'npm test -- tests/runtime-hardening.test.js'
  },
  {
    id: 'network-save-cloud-contract',
    phase: 'phase-4-ecosystem-platform',
    priority: 'P2',
    area: '网络/存档',
    improvement: '云存档、网络房间和离线回退契约，提供平台差异说明',
    evidence: ['src/net', 'src/addons/SaveCloud.js'],
    actions: ['add save conflict strategy', 'test reconnect backoff', 'document provider adapters'],
    command: 'npm test -- tests/advanced-capabilities.test.js'
  },
  {
    id: 'audio-memory-streaming',
    phase: 'phase-1-runtime-performance',
    priority: 'P2',
    area: '音频',
    improvement: '音频资源 residency、流式加载、静音策略和移动端解锁诊断',
    evidence: ['src/audio/AudioManager.js', 'src/audio/AudioEditor.js'],
    actions: ['track decoded audio memory', 'add mobile unlock warnings', 'stream large tracks'],
    command: 'npm test -- tests/audio*'
  },
  {
    id: 'ui-layout-accessibility',
    phase: 'phase-3-editor-production',
    priority: 'P2',
    area: 'UI 系统',
    improvement: 'UI layout 约束、焦点、键盘/手柄导航和可访问性元数据',
    evidence: ['src/ui', 'packages/omnicore-editor/src/editor-app.js'],
    actions: ['add focus manager', 'validate touch target size', 'export ui accessibility report'],
    command: 'npm test -- tests/lowcode-editor-suite.test.js'
  },
  {
    id: 'deterministic-replay-diagnostics',
    phase: 'phase-5-release-trust',
    priority: 'P2',
    area: '可复现调试',
    improvement: '输入、随机种子、时间步和存档快照可回放，定位偶现 bug',
    evidence: ['src/quality/EngineQualityHarness.js', 'src/input/InputSequence.js', 'src/core/Snapshot.js'],
    actions: ['record input timeline', 'attach seed to crash report', 'export replay fixture'],
    command: 'npm test -- tests/engine-quality-harness.test.js tests/runtime-hardening.test.js'
  },
  {
    id: 'ai-assisted-authoring-guardrails',
    phase: 'phase-3-editor-production',
    priority: 'P2',
    area: 'AI 辅助创作',
    improvement: 'AI 导入/命令服务加 schema、权限、dry-run diff 和回滚点',
    evidence: ['src/ai/AICommandService.js', 'src/importer/AIImporter.js'],
    actions: ['validate generated patches', 'show diff before apply', 'sandbox AI commands'],
    command: 'npm test -- tests/advanced-capabilities.test.js'
  },
  {
    id: 'docs-search-command-palette',
    phase: 'phase-2-developer-experience',
    priority: 'P2',
    area: '文档检索',
    improvement: 'API quick panel、教程、迁移文档和 CLI help 统一可搜索',
    evidence: ['src/debug/ApiQuickPanel.js', 'src/help/HelpRegistry.js', 'docs/api-typedoc'],
    actions: ['index help entries', 'link deprecated API to replacement', 'add command palette docs search'],
    command: 'npm run docs:typedoc'
  },
  {
    id: 'release-automation-announcement',
    phase: 'phase-5-release-trust',
    priority: 'P2',
    area: '发布自动化',
    improvement: 'release notes、changelog、docs、doctor、startup announcement 和部署证据统一生成',
    evidence: ['scripts/deploy.js', 'scripts/update-changelog.js', 'docs/release-notes'],
    actions: ['merge release checklist', 'write announcement pages', 'include verification transcript'],
    command: 'npm run release:dry'
  },
  {
    id: 'dependency-forensics-supply-chain',
    phase: 'phase-5-release-trust',
    priority: 'P2',
    area: '供应链安全',
    improvement: '依赖风险锁、deprecated audit、license、install script 和 maintainer 风险统一评分',
    evidence: ['scripts/dependency-forensics.js', 'scripts/security-check.js'],
    actions: ['add license matrix', 'gate install scripts', 'track deprecated transitive deps'],
    command: 'npm run dependency:forensics && npm run security-check'
  },
  {
    id: 'wasm-core-physics-packaging',
    phase: 'phase-1-runtime-performance',
    priority: 'P2',
    area: 'WASM',
    improvement: 'WASM core、Box2D/Rapier 后端加载路径、缓存策略和失败 fallback 做成可诊断包',
    evidence: ['src/wasm/WasmLoader.js', 'packages/omnicore-core-wasm'],
    actions: ['add wasm integrity report', 'cache compiled module', 'fallback to JS backend with reason'],
    command: 'npm run build:wasm && npm test -- tests/physics-backends.test.js'
  },
  {
    id: 'electron-desktop-editor-packaging',
    phase: 'phase-3-editor-production',
    priority: 'P2',
    area: '桌面编辑器',
    improvement: 'Electron 打包、工作区恢复、崩溃保存、IPC 权限和自动更新预留',
    evidence: ['packages/omnicore-editor/electron.main.cjs', 'packages/omnicore-editor/workspace.cjs'],
    actions: ['add crash-save fixture', 'validate IPC channel allowlist', 'write package smoke test'],
    command: 'npm test -- tests/desktop-editor-workflow.test.js'
  },
  {
    id: 'community-plugin-review-ci',
    phase: 'phase-4-ecosystem-platform',
    priority: 'P3',
    area: '社区生态',
    improvement: '插件提交流程、CI 审核、教程认证、示例工程和市场详情页自动生成',
    evidence: ['.github/workflows/marketplace-review.yml', 'website/marketplace'],
    actions: ['add submission schema', 'generate detail page', 'publish review result badge'],
    command: 'npm run marketplace:generate && npm run marketplace:validate'
  },
  {
    id: 'internationalization-localization-pipeline',
    phase: 'phase-4-ecosystem-platform',
    priority: 'P3',
    area: '国际化',
    improvement: 'I18n/Localization 与编辑器文案、插件市场和游戏资源变体统一',
    evidence: ['src/data/I18n.js', 'src/data/Localization.js'],
    actions: ['extract strings', 'validate missing keys', 'support platform locale packs'],
    command: 'npm test -- tests/advanced-capabilities.test.js'
  },
  {
    id: 'governance-lts-compatibility',
    phase: 'phase-5-release-trust',
    priority: 'P3',
    area: '治理/LTS',
    improvement: 'LTS、治理、兼容表、API lifecycle、案例证据和安全历史集中展示',
    evidence: ['GOVERNANCE.md', 'LTS.md', 'docs/security/security.md'],
    actions: ['add compatibility matrix', 'link every release gate', 'publish maintenance health report'],
    command: 'npm run governance:triage'
  }
];

export function buildEngineImprovementPlan({
  generatedAt = new Date().toISOString(),
  opportunities = IMPROVEMENT_OPPORTUNITIES
} = {}) {
  const normalized = opportunities
    .map((item, index) => ({
      rank: index + 1,
      ...item,
      evidence: [...(item.evidence || [])],
      actions: [...(item.actions || [])]
    }))
    .sort((left, right) => priorityWeight(left.priority) - priorityWeight(right.priority) || left.rank - right.rank);
  const phases = IMPROVEMENT_PHASES.map((phase) => {
    const phaseItems = normalized.filter((item) => item.phase === phase.id);
    return {
      ...phase,
      opportunityCount: phaseItems.length,
      p0Count: phaseItems.filter((item) => item.priority === 'P0').length,
      opportunityIds: phaseItems.map((item) => item.id)
    };
  });
  const nextActions = normalized.slice(0, 12).map((item) => ({
    id: item.id,
    priority: item.priority,
    command: item.command,
    reason: item.improvement
  }));
  return {
    generatedAt: generatedAt || DEFAULT_GENERATED_AT,
    summary: {
      totalOpportunities: normalized.length,
      phaseCount: phases.length,
      p0Count: normalized.filter((item) => item.priority === 'P0').length,
      p1Count: normalized.filter((item) => item.priority === 'P1').length,
      p2Count: normalized.filter((item) => item.priority === 'P2').length,
      p3Count: normalized.filter((item) => item.priority === 'P3').length
    },
    phases,
    opportunities: normalized,
    nextActions
  };
}

export function formatEngineImprovementMarkdown(plan = buildEngineImprovementPlan()) {
  const lines = [
    '# OmniCore Engine Improvement Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    `Total opportunities: ${plan.summary.totalOpportunities}`,
    `P0/P1/P2/P3: ${plan.summary.p0Count}/${plan.summary.p1Count}/${plan.summary.p2Count}/${plan.summary.p3Count}`,
    '',
    '## Phases'
  ];

  for (const phase of plan.phases) {
    lines.push(`- ${phase.label}: ${phase.goal} (${phase.opportunityCount} items)`);
  }

  lines.push(
    '',
    '## Prioritized Backlog',
    '',
    '| Priority | Area | Improvement | Evidence | First Action |',
    '| --- | --- | --- | --- | --- |'
  );
  for (const item of plan.opportunities) {
    lines.push(`| ${item.priority} | ${item.area} | ${item.id}: ${item.improvement} | ${item.evidence.join('<br>')} | ${item.actions[0] || ''} |`);
  }

  lines.push('', '## Next Actions');
  for (const action of plan.nextActions) {
    lines.push(`- ${action.priority} ${action.id}: ${action.command}`);
  }

  return `${lines.join('\n')}\n`;
}

function priorityWeight(priority) {
  if (priority === 'P0') return 0;
  if (priority === 'P1') return 1;
  if (priority === 'P2') return 2;
  return 3;
}

export default {
  buildEngineImprovementPlan,
  formatEngineImprovementMarkdown
};
