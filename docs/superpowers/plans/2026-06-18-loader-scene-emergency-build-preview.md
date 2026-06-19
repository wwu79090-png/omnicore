# Loader Scene Emergency Build Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing-resource recovery, scene transition blocking UI, debug emergency error overlay, and a local build-preview command for OmniCore.

**Architecture:** Keep changes inside existing runtime boundaries. `Loader` owns path fallback and missing placeholders, `SceneManager` coordinates loading barriers with `Game`'s pre-created overlay root, `EmergencyOverlay` is a debug-only DOM component listening to EventBus events, and `scripts/build-game-demo.js` orchestrates local build/copy/build/preview.

**Tech Stack:** ESM JavaScript, Vitest, jsdom DOM tests, Node child_process/fs/http utilities.

---

### Task 1: Loader Path Resolver And Placeholder

**Files:**
- Modify: `src/loader/Loader.js`
- Test: `tests/resilience-and-tools.test.js`

- [ ] **Step 1: Write failing tests**

```js
it('tries fallback paths after an asset URL fails', async () => {
  const calls = [];
  const loader = new Loader({
    fetcher: async (url) => {
      calls.push(url);
      return { ok: url === './textures/player.png', text: async () => 'ok' };
    }
  });
  const bundle = await loader.loadBundle([{ key: 'player', url: '/bad/player.png', type: 'text' }]);
  expect(calls).toEqual(['/bad/player.png', 'public/assets/textures/player.png', './textures/player.png']);
  expect(bundle.player).toBe('ok');
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/resilience-and-tools.test.js`

- [ ] **Step 3: Implement minimal code**

Add `pathResolver`, fallback URL iteration, console error `"资源丢失，请检查路径配置"`, and a `ResourceMissing` object with `alpha: 0.5`, red color, and rectangle dimensions.

- [ ] **Step 4: Verify**

Run: `npm test -- tests/resilience-and-tools.test.js`

### Task 2: Scene Loading Barrier

**Files:**
- Modify: `src/core/OmniCore.js`
- Modify: `src/scene/SceneManager.js`
- Test: `tests/resilience-and-tools.test.js`

- [ ] **Step 1: Write failing tests**

```js
it('creates a top transition layer on Game init and blocks scene loading until loader finishes', async () => {
  const game = await new OmniCore.Game({ renderer: 'canvas', autoStart: false, autoAttach: false }).init();
  const layer = game.transitionLayer.root;
  expect(layer.style.zIndex).toBe('2147483647');
  game.loader.loadBundle = vi.fn(async () => ({ ok: true }));
  await game.scene.load('boot', { bundle: [{ key: 'boot', url: '/boot.json', type: 'json' }] });
  expect(game.loader.loadBundle).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/resilience-and-tools.test.js`

- [ ] **Step 3: Implement minimal code**

Create a persistent transition layer during `Game.init()`, expose `show/hide`, and add `SceneManager.load()` that shows the layer, awaits `loader.loadBundle()`, then switches scenes and fades the layer.

- [ ] **Step 4: Verify**

Run: `npm test -- tests/resilience-and-tools.test.js`

### Task 3: Debug Emergency Overlay

**Files:**
- Create: `src/debug/EmergencyOverlay.js`
- Modify: `src/core/OmniCore.js`
- Modify: `src/index.js`
- Test: `tests/resilience-and-tools.test.js`

- [ ] **Step 1: Write failing tests**

```js
it('shows debug fatal errors with line number and manual buttons', async () => {
  const game = await new OmniCore.Game({ renderer: 'canvas', autoStart: false, autoAttach: false, debug: true }).init();
  game.events.emit('error', { message: 'Store中的hp字段未初始化。请检查配置或重置Store。', line: 34 });
  expect(document.querySelector('[data-omnicore-emergency]').textContent)
    .toContain('[OmniCore 致命错误] 第34行');
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/resilience-and-tools.test.js`

- [ ] **Step 3: Implement minimal code**

Build a DOM overlay that subscribes to `error`, `warning`, `engine:error`, and `engine:warning`, formats source and line, adds `继续运行` and `关闭` buttons, and only attaches in debug mode.

- [ ] **Step 4: Verify**

Run: `npm test -- tests/resilience-and-tools.test.js`

### Task 4: Local Build Preview Script

**Files:**
- Create: `scripts/build-game-demo.js`
- Test: `tests/build-game-demo-script.test.js`

- [ ] **Step 1: Write failing tests**

```js
it('runs engine build, copies package, builds target, and starts preview', async () => {
  const actions = [];
  await runBuildGameDemo({ targetProject: '/game', run: async (...args) => actions.push(args), copyPackage: async () => actions.push(['copy']), startServer: async () => ({ url: 'http://127.0.0.1:4173/' }) });
  expect(actions.map((item) => item[0])).toEqual(['npm', 'copy', 'npm']);
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/build-game-demo-script.test.js`

- [ ] **Step 3: Implement minimal code**

Use one CLI argument, run `npm run build`, copy engine files into `node_modules/omnicore`, run target `npm run build`, and serve target `dist` with an HTTP server while printing the preview URL.

- [ ] **Step 4: Verify**

Run: `npm test -- tests/build-game-demo-script.test.js`

### Final Verification

- [ ] `npm test -- tests/resilience-and-tools.test.js tests/build-game-demo-script.test.js`
- [ ] `npm test -- tests/runtime-hardening.test.js tests/reactive-refactor.test.js tests/omnicore.test.js`
- [ ] `npx eslint -c .eslintrc.json --no-eslintrc src/loader/Loader.js src/scene/SceneManager.js src/core/OmniCore.js src/debug/EmergencyOverlay.js scripts/build-game-demo.js tests/resilience-and-tools.test.js tests/build-game-demo-script.test.js`
