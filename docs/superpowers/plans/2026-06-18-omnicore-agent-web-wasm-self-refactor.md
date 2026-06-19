# OmniCore Agent Web WASM Self Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build debug-only developer telemetry, docs intelligence, plugin recommendation, WASM compute acceleration, experimental WebTransport, internal Addon resource contracts, and adaptive runtime quality control on top of OmniCore's current Microkernel architecture.

**Architecture:** Keep `OmniCore.Game` backward compatible and attach new behavior through debug extensions, optional managers, and internal Microkernel negotiation. Runtime telemetry is created only when `debug: true`; release paths keep direct method calls and avoid collection overhead. WASM and WebTransport use feature detection and JS/WebSocket fallbacks so existing APIs continue to work.

**Tech Stack:** ES modules, Vitest, Vite, DOM debug overlays, WebAssembly.instantiate, optional browser WebTransport API, existing Store/EventBus/Kernel/PixiRenderer/ChunkManager systems.

---

### Task 1: Debug Telemetry Dashboard

**Files:**
- Create: `src/debug/TelemetryCollector.js`
- Create: `src/debug/TelemetryDashboard.js`
- Modify: `src/index.js`
- Test: `tests/intelligent-runtime-systems.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('collects API usage only in debug mode and renders trends plus heatmap', async () => {
  const collector = new TelemetryCollector({ debug: true, clock: () => 100 });
  collector.recordApi('Store.set', { duration: 3, configPath: 'state.score' });
  collector.recordApi('Store.set', { duration: 7, configPath: 'state.score' });
  collector.recordError('Store.set', new Error('bad config'), { configPath: 'state.score' });
  const dashboard = new TelemetryDashboard({ debug: true, collector });
  dashboard.attach(document.body);
  dashboard.refresh();
  expect(document.querySelector('[data-omnicore-telemetry-dashboard]')?.textContent).toContain('Store.set');
  expect(collector.snapshot().apiUsage['Store.set'].count).toBe(2);
  expect(collector.snapshot().errors[0].configPath).toBe('state.score');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/intelligent-runtime-systems.test.js`
Expected: FAIL because `TelemetryCollector` and `TelemetryDashboard` do not exist.

- [ ] **Step 3: Implement minimal telemetry**

Create a collector with `recordApi`, `recordError`, `wrapMethod`, `snapshot`, and `exportInsights`; create a DOM dashboard with FPS trend text bars and API heatmap rows. Attach it from `Game._attachRuntimeExtensions()` only when `this.config.debug` is true.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/intelligent-runtime-systems.test.js`
Expected: PASS for telemetry behavior.

### Task 2: Docs Intelligence

**Files:**
- Modify: `scripts/docs.js`
- Create: `src/debug/DeveloperUsageReport.js`
- Create: `src/debug/ErrorDiagnostics.js`
- Create: `src/debug/TutorialGuide.js`
- Modify: `src/index.js`
- Test: `tests/intelligent-runtime-systems.test.js`
- Test: `tests/dx-experience.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('sorts docs homepage by telemetry frequency and emits tutorial gaps', () => {
  writeFileSync('docs/release-notes/telemetry-insights.json', JSON.stringify({
    apiUsage: { 'Kernel.use': { count: 9 }, 'Renderer.drawRect': { count: 4 } }
  }));
  execFileSync(process.execPath, ['scripts/docs.js'], { cwd: process.cwd() });
  const api = readFileSync('docs/api.md', 'utf8');
  const gaps = readFileSync('docs/tutorial-gaps.md', 'utf8');
  expect(api.indexOf('Kernel.use')).toBeLessThan(api.indexOf('Renderer.drawRect'));
  expect(gaps).toContain('教程缺失区');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/intelligent-runtime-systems.test.js tests/dx-experience.test.js`
Expected: FAIL because docs do not read telemetry and DX helper modules are absent.

- [ ] **Step 3: Implement docs integration**

Read `docs/release-notes/telemetry-insights.json` if present, prepend a "高频 API" section to `docs/api.md`, and write `docs/tutorial-gaps.md` for high-frequency APIs missing from current docs. Implement DX helper modules used by existing tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/intelligent-runtime-systems.test.js tests/dx-experience.test.js`
Expected: PASS for docs ordering and DX helpers.

### Task 3: Entity Plugin Recommendation

**Files:**
- Create: `src/editor/PluginRecommendationEngine.js`
- Modify: `src/editor/EditorPlugin.js`
- Modify: `src/editor/EditorPanel.js`
- Modify: `src/index.js`
- Test: `tests/intelligent-runtime-systems.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('recommends plugins from entity attributes and displays editor entry points', () => {
  const engine = new PluginRecommendationEngine();
  const entity = { id: 'enemy', health: 10, velocity: { x: 1, y: 0 } };
  expect(engine.recommend(entity).map((item) => item.plugin)).toEqual(expect.arrayContaining(['ParticleOnHit', 'PhysicsBody']));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/intelligent-runtime-systems.test.js`
Expected: FAIL because recommendation engine does not exist.

- [ ] **Step 3: Implement rules and editor UI**

Use built-in rules only: `health` recommends `ParticleOnHit`, `velocity` recommends `PhysicsBody`, `inventory` recommends `InventoryPanel`, and `dialogue` recommends `DialogueTree`. Render buttons in the editor property panel and sync `editor:pluginRecommendations` to Store.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/intelligent-runtime-systems.test.js`
Expected: PASS for recommendation behavior.

### Task 4: WASM Compute Runtime

**Files:**
- Create: `src/wasm/WasmLoader.js`
- Create: `src/wasm/kernels/omnicore_compute.wasm.js`
- Create: `src/compute/Pathfinding.js`
- Create: `src/compute/DamageFormula.js`
- Create: `src/compute/ComputeRuntime.js`
- Create: `scripts/build-wasm.js`
- Modify: `src/worker/WorkerManager.js`
- Modify: `src/index.js`
- Test: `tests/intelligent-runtime-systems.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('uses WebAssembly.instantiate for damage and A* heuristic with JS fallback', async () => {
  const loader = new WasmLoader({ instantiate: async () => ({ instance: { exports: { damage: () => 42, manhattan: () => 2 } } }) });
  const runtime = new ComputeRuntime({ wasmLoader: loader });
  await runtime.init();
  expect(runtime.damage({ base: 10, attack: 5, defense: 3 })).toBe(42);
  expect(loader.loaded).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/intelligent-runtime-systems.test.js`
Expected: FAIL because WASM runtime files do not exist.

- [ ] **Step 3: Implement loader and compute facade**

Create `WasmLoader.instantiate(bytesOrUrl)`, embed a small generated kernel as byte array, implement `ComputeRuntime.init()`, `findPath()`, and `damage()` with WASM exports when available and JS fallback otherwise. Register worker built-in tasks through the same compute helpers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/intelligent-runtime-systems.test.js tests/performance-systems.test.js`
Expected: PASS for WASM and existing worker pathfinding.

### Task 5: Experimental WebTransport Network Layer

**Files:**
- Create: `src/net/RealtimeConnection.js`
- Create: `src/net/WebTransportConnection.js`
- Modify: `src/net/NetManager.js`
- Modify: `src/index.js`
- Test: `tests/intelligent-runtime-systems.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('creates unstable WebTransport connections behind the existing Net abstraction', async () => {
  const net = new NetManager({ WebTransportClass: FakeWebTransport });
  const connection = await net.connect('https://example.test/game', { transport: 'webtransport' });
  expect(connection.transport).toBe('webtransport');
  expect(connection.unstable).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/intelligent-runtime-systems.test.js`
Expected: FAIL because `NetManager.connect` does not exist.

- [ ] **Step 3: Implement abstraction**

Add `NetManager.connect(url, options)` with `websocket` default and `webtransport` experimental mode. Implement sequence IDs, ack tracking, retry count, `send`, `on`, `close`, and feature detection errors in OmniCore format.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/intelligent-runtime-systems.test.js`
Expected: PASS for WebTransport behavior.

### Task 6: Internal Addon Resource Contracts

**Files:**
- Modify: `src/microkernel/Kernel.js`
- Test: `tests/microkernel/kernel.test.js`
- Test: `tests/intelligent-runtime-systems.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('negotiates addon resource contracts internally and lowers physics sampling when renderer is busy', () => {
  const physics = { contract: { requestAnimationFrame: { priority: 'high', samplingRate: 60 } } };
  const renderer = { negotiateAddonContract: () => ({ status: 'busy', samplingRateScale: 0.5 }) };
  const kernel = new Kernel();
  kernel.addon('physics', physics).attachRenderer(renderer).use('physics');
  expect(physics.samplingRate).toBe(30);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/intelligent-runtime-systems.test.js tests/microkernel/kernel.test.js`
Expected: FAIL because Kernel does not negotiate Addon contracts.

- [ ] **Step 3: Implement private negotiation**

After `addon.init`, inspect `addon.contract` or `addon.resourceContract`, ask attached renderers through `negotiateAddonContract`, store result on `addon.__omnicoreContract`, call `addon.onContractUpdate`, and reduce `samplingRate` only for busy responses. Do not add new public APIs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/intelligent-runtime-systems.test.js tests/microkernel/kernel.test.js`
Expected: PASS for contract negotiation and existing kernel behavior.

### Task 7: Device Profile And Adaptive Quality

**Files:**
- Create: `src/optimization/DeviceProfiler.js`
- Create: `src/optimization/AdaptiveQualityManager.js`
- Modify: `src/optimization/ViewportCulling.js`
- Modify: `src/renderer/PixiRenderer.js`
- Modify: `src/core/OmniCore.js`
- Modify: `src/index.js`
- Test: `tests/intelligent-runtime-systems.test.js`
- Test: `tests/deep-engine-bindings.test.js`

- [ ] **Step 1: Write the failing test**

```js
it('profiles weak devices and only degrades rendering plus particle quality', async () => {
  const renderer = { enableBloom: true, particleLimit: 1000, setQualityProfile: vi.fn() };
  const manager = new AdaptiveQualityManager({ renderer, culling: new ViewportCulling(), particleScale: 0.4 });
  const result = manager.apply({ tier: 'low', gpuScore: 1, cpuScore: 1 });
  expect(result.applied).toContain('disableBloom');
  expect(renderer.enableBloom).toBe(false);
  expect(renderer.particleLimit).toBe(400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/intelligent-runtime-systems.test.js tests/deep-engine-bindings.test.js`
Expected: FAIL because adaptive profiling classes do not exist.

- [ ] **Step 3: Implement profiler and quality manager**

Run a configurable 5 second benchmark by default from `Game.init()` when `adaptiveQuality` is enabled, classify low/mid/high, and apply only renderer Bloom, particle limit, and visible tile chunk cap. Tests use `durationMs: 0` to avoid waiting.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/intelligent-runtime-systems.test.js tests/deep-engine-bindings.test.js`
Expected: PASS for adaptive quality and existing mobile tuning.

### Final Verification

- [ ] Run: `npm test`
- [ ] Run: `npm run lint`
- [ ] Run: `npm run docs`
- [ ] Run: `npm run build`
- [ ] Run: `npm run benchmark:ci` if benchmark runtime remains stable after build.

Expected: All commands pass. If unrelated pre-existing tests fail, record exact failures and fix if they are adjacent to this work.
