# OmniCore Industrialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the editor, asset pipeline, 2.5D runtime, benchmark gate, examples, and official plugin surface required for a no-code 5-minute OmniCore production workflow.

**Architecture:** Keep the existing runtime/editor split. Extend the standalone editor state machine and UI, reuse the current asset importer and platform packager, unlock only 2.5D decorative interaction APIs in `Dimension3D`, and validate the chain with Vitest plus script smoke tests.

**Tech Stack:** JavaScript ES modules, Vitest, Vite, PixiJS-facing runtime APIs, Three.js decorative layer, GitHub Actions.

---

### Task 1: Industrial Acceptance Tests

**Files:**
- Create: `tests/industrialization-complete.test.js`

- [ ] **Step 1: Add failing tests for the five target areas**

```js
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('OmniCore industrialization complete chain', () => {
  let temp = null;
  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
    document.body.innerHTML = '';
  });

  it('lets non-coders select, edit, transform, paint tilemaps, and instantiate prefabs', async () => {
    const { createEditorApp, createEditorState } = await import('../packages/omnicore-editor/src/editor-app.js');
    const root = document.createElement('main');
    document.body.appendChild(root);
    const messages = [];
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: { entities: [{ id: 'hero', name: 'Hero', type: 'sprite', x: 10, y: 20, width: 32, height: 32 }] },
        prefabs: [{ id: 'crate', name: 'Crate', type: 'sprite', width: 24, height: 24, texture: 'crate.png' }],
        tilemap: { width: 4, height: 3, tileWidth: 16, tileHeight: 16, data: [], collisions: [] }
      }),
      transport: { send: (message) => messages.push(JSON.parse(message)) }
    });

    root.querySelector('[data-editor-entity-id="hero"]').click();
    const xInput = root.querySelector('[data-inspector-field="x"]');
    xInput.value = '64';
    xInput.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector('[data-gizmo-mode="translate"]').click();
    root.querySelector('[data-scene-node-id="hero"]').dispatchEvent(new PointerEvent('pointerdown', { clientX: 64, clientY: 64, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 84, clientY: 94, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    root.querySelector('[data-tile-index="5"]').click();
    root.querySelector('[data-collision-mode]').click();
    root.querySelector('[data-tile-index="6"]').click();
    root.querySelector('[data-prefab-id="crate"]').dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }));
    root.querySelector('[data-scene-drop-zone]').dispatchEvent(new DragEvent('drop', { bubbles: true, clientX: 120, clientY: 80, dataTransfer: new DataTransfer() }));

    const exported = app.exportTiledJson();
    expect(app.getState().scene.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hero', x: 84, y: 94 }),
      expect.objectContaining({ prefabId: 'crate', x: 120, y: 80 })
    ]));
    expect(exported).toMatchObject({ type: 'map', width: 4, height: 3 });
    expect(exported.layers.some((layer) => layer.name === 'collision')).toBe(true);
    expect(messages.some((message) => message.type === 'editor:update-entity')).toBe(true);
  });

  it('imports source-assets into platform-ready assets with atlases and variants', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-import-complete-'));
    const source = path.join(temp, 'source-assets');
    const assets = path.join(temp, 'assets');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'hero.aseprite'), 'aseprite');
    writeFileSync(path.join(source, 'tile.png'), 'png');
    writeFileSync(path.join(source, 'theme.mp3'), 'mp3');

    execFileSync(process.execPath, [
      path.resolve('scripts/asset-importer.js'),
      '--source', source,
      '--out', assets,
      '--platforms', 'web,wechat,electron'
    ], { cwd: process.cwd(), encoding: 'utf8' });

    expect(existsSync(path.join(assets, 'spritesheets', 'hero.json'))).toBe(true);
    expect(existsSync(path.join(assets, 'textures', 'tile.webp'))).toBe(true);
    expect(existsSync(path.join(assets, 'audio', 'theme.ogg'))).toBe(true);
    expect(existsSync(path.join(assets, 'atlases', 'smart.atlas.json'))).toBe(true);
    expect(existsSync(path.join(assets, 'platforms', 'web', 'assets.manifest.json'))).toBe(true);
    expect(existsSync(path.join(assets, 'platforms', 'wechat', 'assets.manifest.json'))).toBe(true);
    expect(existsSync(path.join(assets, 'platforms', 'electron', 'assets.manifest.json'))).toBe(true);
  });

  it('provides limited 2.5D model loading, orbit controls, Character3D depth, and raycaster highlight', async () => {
    const { Dimension3D } = await import('../src/index.js');
    const scene = new Dimension3D.Scene({ width: 800, height: 400, controls: 'orbit' });
    const model = scene.addModel({ id: 'city', url: '/models/city.glb', position: { x: 0, y: 0, z: 0 }, bounds: { width: 3, height: 3, depth: 3 }, rotationSpeed: { y: 0.25 } });
    const hero = scene.addCharacter2D({ id: 'hero', sprite: { x: 390, y: 190, width: 32, height: 48 }, depth: 1, scale: 0.05 });
    const picked = scene.raycastFromScreen({ x: 400, y: 200 });

    expect(scene.controlsConfig).toMatchObject({ type: 'orbit' });
    expect(model.rotationSpeed).toMatchObject({ y: 0.25 });
    expect(hero.depthLayer).toBeGreaterThanOrEqual(0);
    expect(picked.hit).toBe(true);
    expect(picked.model).toMatchObject({ id: 'city', highlighted: true });
  });

  it('declares Android and iOS 1000-sprite benchmark gates and minigame precheck command', () => {
    const workflow = readFileSync('.github/workflows/benchmark.yml', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(workflow).toContain('Pixel 5');
    expect(workflow).toContain('iPhone 12');
    expect(workflow).toContain('OMNICORE_BENCHMARK_MIN_FPS: 45');
    expect(pkg.scripts.import).toContain('scripts/asset-importer.js');
    expect(pkg.scripts['test:wechat']).toBe('node scripts/test-wechat.js');
  });

  it('ships npm-create templates and five official plugin packages', () => {
    for (const template of ['template-platformer', 'template-rpg', 'template-interactive']) {
      expect(existsSync(path.join('examples', template, 'package.json'))).toBe(true);
      expect(readFileSync(path.join('examples', template, 'src', 'main.js'), 'utf8')).toMatch(/new OmniCore\.Game|await new Game/);
    }
    for (const plugin of ['CameraShake', 'Localization', 'ParticlePack', 'AudioMixer', 'AiPathfinding']) {
      expect(existsSync(path.join('examples', 'plugins', plugin, 'src', 'index.js'))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the tests and confirm failures are from missing behavior**

Run: `npm test -- tests/industrialization-complete.test.js`

Expected: FAIL on missing editor controls, missing png/webp import, missing platform outputs, missing raycaster API, missing workflow strings, missing plugin folders.

### Task 2: Implement Editor Complete State

**Files:**
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`

- [ ] **Step 1: Add editor state for prefabs, tile paint, collision mode, gizmo mode, and commands**
- [ ] **Step 2: Wire hierarchy selection, inspector input, gizmo drag, tile clicks, Tiled JSON export, and prefab drag/drop**
- [ ] **Step 3: Re-run `npm test -- tests/industrialization-complete.test.js tests/production-toolchain.test.js`**

### Task 3: Implement Asset Pipeline Complete Chain

**Files:**
- Modify: `package.json`
- Modify: `scripts/asset-importer.js`

- [ ] **Step 1: Add `npm run import` command using `source-assets` and `assets`**
- [ ] **Step 2: Convert `.png` to `.webp`, `.mp3` to `.ogg`, `.aseprite` to sheet JSON plus atlas frames**
- [ ] **Step 3: Emit `assets.manifest.json` and platform manifests under `assets/platforms/<target>`**
- [ ] **Step 4: Re-run `npm test -- tests/industrialization-complete.test.js tests/asset-pipeline-industrial.test.js`**

### Task 4: Implement 2.5D Interaction APIs

**Files:**
- Modify: `src/dimension3d/Dimension3D.js`

- [ ] **Step 1: Allow orbit controls in `Dimension3D` while keeping unsupported full 3D physics/collision blocked**
- [ ] **Step 2: Add `raycastFromScreen`, reusable highlight feedback, `Character3D.updateFromSprite`, and depth layer mapping**
- [ ] **Step 3: Re-run `npm test -- tests/industrialization-complete.test.js tests/industrialization-decoupled.test.js tests/dimension3d-game-loop.test.js`**

### Task 5: Implement CI, Examples, Plugins, and Docs

**Files:**
- Modify: `.github/workflows/benchmark.yml`
- Modify: `scripts/create-omnicore-app.mjs`
- Create/modify: `examples/template-interactive/*`
- Create: `examples/plugins/CameraShake/src/index.js`
- Create: `examples/plugins/Localization/src/index.js`
- Create: `examples/plugins/ParticlePack/src/index.js`
- Create: `examples/plugins/AudioMixer/src/index.js`
- Create: `examples/plugins/AiPathfinding/src/index.js`
- Modify: `website/plugins/index.html`

- [ ] **Step 1: Add matrix benchmark labels for Pixel 5 and iPhone 12 at 45 FPS**
- [ ] **Step 2: Add `interactive` create-app template and ensure platformer/rpg templates are runnable**
- [ ] **Step 3: Add the five official plugin example packages and marketplace entries**
- [ ] **Step 4: Run `npm test -- tests/industrialization-complete.test.js tests/ecosystem.test.js tests/industrialization-decoupled.test.js`**

### Task 6: Verification

**Files:**
- No production files unless tests reveal failures.

- [ ] **Step 1: Run targeted Vitest**

Run: `npm test -- tests/industrialization-complete.test.js tests/production-toolchain.test.js tests/asset-pipeline-industrial.test.js tests/industrialization-decoupled.test.js tests/ecosystem.test.js`

Expected: PASS.

- [ ] **Step 2: Run key scripts**

Run: `npm run test:wechat`

Expected: PASS and `dist/wechat-test` or the configured output contains compliance/performance reports.

Run: `node scripts/create-omnicore-app.mjs smoke-platformer --template platformer`

Expected: Project folder contains `package.json`, `index.html`, `src/main.js`, and default assets.

