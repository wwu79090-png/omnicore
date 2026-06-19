# OmniCore Editor Marketplace Publishing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready plugin marketplace backend surface, advanced editor tooling, and multi-platform publishing pipeline for OmniCore.

**Architecture:** Extend existing MarketplaceServer and static website pages for plugin browsing, review, install, and update metadata. Extend the Electron editor state/UI with focused dock panels and EditorAPI methods for search/replace, resource picking, physics debugging, prefab hot-edit save prompts, and build settings. Add a Node mobile shell generator that emits iOS Swift and Android Kotlin WebView projects from the existing web build.

**Tech Stack:** JavaScript ESM, Vitest, Electron renderer DOM UI, Node.js filesystem scripts, static HTML docs.

---

### Task 1: Marketplace Backend and Storefront

**Files:**
- Modify: `src/marketplace/MarketplaceServer.js`
- Modify: `website/marketplace/index.html`
- Modify: `website/marketplace/omni-particles/index.html`
- Test: `tests/marketplace-backend-platform.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import MarketplaceServer from '../src/marketplace/MarketplaceServer.js';

describe('marketplace backend platform', () => {
  it('indexes approved plugins with media, engine versions, install jobs, and updates', () => {
    const market = new MarketplaceServer();
    market.submitPlugin({
      name: 'omni-particles',
      displayName: 'Omni Particles',
      version: '1.0.0',
      developerId: 'particle-studio',
      publisher: 'Particle Studio',
      packageName: '@omnicore/omni-particles',
      main: 'src/index.js',
      author: 'Particle Studio',
      license: 'MIT',
      engineVersion: '>=0.1.0',
      media: {
        screenshots: ['/marketplace/omni-particles/screen.png'],
        videos: ['/marketplace/omni-particles/demo.mp4']
      }
    });
    market.reviewPlugin('omni-particles', { reviewerId: 'market-bot', approved: true });
    market.publishPluginUpdate('omni-particles', { version: '1.1.0', changelog: 'Adds GPU burst emitters.' });

    expect(market.searchPlugins('particles')[0]).toMatchObject({
      name: 'omni-particles',
      publisher: 'Particle Studio',
      version: '1.1.0',
      engineVersion: '>=0.1.0'
    });
    expect(market.createInstallJob('omni-particles')).toMatchObject({
      plugin: 'omni-particles',
      command: 'omni install omni-particles',
      addonDir: 'addons/omni-particles',
      status: 'queued'
    });
    expect(market.getAvailableUpdates([{ name: 'omni-particles', version: '1.0.0' }])).toEqual([
      expect.objectContaining({ name: 'omni-particles', latestVersion: '1.1.0' })
    ]);
  });

  it('renders complete marketplace cards with publisher, engine support, media, and update affordances', () => {
    const html = readFileSync('website/marketplace/index.html', 'utf8');
    expect(html).toContain('data-marketplace-search');
    expect(html).toContain('发布者');
    expect(html).toContain('支持引擎版本');
    expect(html).toContain('截图预览');
    expect(html).toContain('视频预览');
    expect(html).toContain('自动更新');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/marketplace-backend-platform.test.js`
Expected: FAIL because `searchPlugins`, `publishPluginUpdate`, `createInstallJob`, and `getAvailableUpdates` are missing.

- [ ] **Step 3: Implement backend and pages**

Add MarketplaceServer methods that only expose approved plugins, preserve media metadata, generate `omni install` commands, and compute semver-like update availability. Update the static marketplace HTML to show search, publisher, version, engine support, screenshot/video preview labels, install commands, and automatic updates.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/marketplace-backend-platform.test.js`
Expected: PASS.

### Task 2: Deep Editor Toolchain

**Files:**
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Test: `tests/editor-deep-toolchain.test.js`

- [ ] **Step 1: Write the failing test**

```js
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';

let createEditorApp;
let createEditorState;

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
  ({ createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href));
});

describe('editor deep toolchain', () => {
  it('searches and replaces project files from Ctrl+Shift+F', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        projectFiles: {
          'src/npc.js': 'const name = "Slime";',
          'scenes/level.json': '{"enemy":"Slime"}'
        },
        dockLayout: { left: ['hierarchy'], center: ['scene-view'], right: ['inspector'], bottom: ['global-search'] }
      })
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true }));
    const results = app.EditorAPI.searchProject('Slime');
    expect(root.querySelector('[data-panel="global-search"]')?.textContent).toContain('Global Search');
    expect(results).toHaveLength(2);
    expect(app.EditorAPI.replaceProject('Slime', 'Blob').changedFiles).toEqual(['src/npc.js', 'scenes/level.json']);
    expect(app.getState().projectFiles['src/npc.js']).toContain('Blob');
    app.destroy();
  });

  it('opens a thumbnail resource picker from sprite fields and deep links selected assets', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: { entities: [{ id: 'hero', name: 'Hero', sprite: 'old.png', x: 0, y: 0 }] },
        selectedEntityId: 'hero',
        assets: [
          { path: 'assets/hero.png', type: 'image', thumbnail: 'thumb-hero.png' },
          { path: 'assets/slime.png', type: 'image', thumbnail: 'thumb-slime.png' }
        ]
      })
    });
    app.EditorAPI.openResourcePicker('sprite', { query: 'slime' });
    expect(root.querySelector('[data-resource-picker]')?.textContent).toContain('assets/slime.png');
    app.EditorAPI.selectResourceForField('sprite', 'assets/slime.png');
    expect(app.getState().scene.entities[0].sprite).toBe('assets/slime.png');
    app.destroy();
  });

  it('renders Physics View wireframes and prompts to save paused prefab hot edits', () => {
    const root = document.createElement('main');
    const confirm = vi.fn(() => true);
    window.confirm = confirm;
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        playState: { mode: 'paused' },
        scene: {
          entities: [{
            id: 'slime',
            prefabId: 'slime-variant',
            physics: { shape: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 8, y: 16 }] }
          }]
        },
        prefabs: [{ id: 'slime-variant', extends: 'slime-base', overrides: { hp: 10 } }],
        dockLayout: { left: ['hierarchy'], center: ['physics-view'], right: ['prefabs'], bottom: ['build-settings'] }
      })
    });
    app.EditorAPI.openPhysicsView();
    expect(root.querySelector('[data-panel="physics-view"]')?.textContent).toContain('Matter');
    expect(root.querySelector('[data-physics-wireframe="slime"]')).not.toBeNull();
    app.EditorAPI.editPrefabVariantRuntime('slime-variant', { hp: 20 });
    app.EditorAPI.exitPrefabHotEdit();
    expect(root.querySelector('[data-prefab-save-prompt]')?.textContent).toContain('slime-variant');
    app.EditorAPI.savePrefabHotEdit();
    expect(app.getState().prefabs[0].overrides.hp).toBe(20);
    app.destroy();
  });

  it('configures multi-platform build settings with strategy defaults', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        dockLayout: { left: ['hierarchy'], center: ['scene-view'], right: ['build-settings'], bottom: ['tilemap'] }
      })
    });
    app.EditorAPI.setBuildTarget('steam', true);
    app.EditorAPI.setBuildTarget('itch', true);
    const config = app.EditorAPI.exportBuildSettings();
    expect(root.querySelector('[data-panel="build-settings"]')?.textContent).toContain('Build Settings');
    expect(config.targets.steam).toMatchObject({ enabled: true, compression: 'store', iconSize: 256 });
    expect(config.targets.itch).toMatchObject({ enabled: true, compression: 'brotli', configStrategy: 'portable' });
    app.destroy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/editor-deep-toolchain.test.js`
Expected: FAIL because the new panels and EditorAPI methods are not yet implemented.

- [ ] **Step 3: Implement editor features**

Add panels `global-search`, `physics-view`, and `build-settings`. Add state fields `projectFiles`, `globalSearch`, `resourcePicker`, `physicsView`, `prefabHotEdit`, and `buildSettings`. Add EditorAPI methods for project search/replace, resource picker selection, Physics View activation, prefab hot edit save prompt, and build settings export.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/editor-deep-toolchain.test.js`
Expected: PASS.

### Task 3: Publishing Docs and Mobile Shell Generator

**Files:**
- Create: `scripts/generate-mobile-shells.js`
- Modify: `package.json`
- Create: `docs/publishing/steam-itch.md`
- Create: `website/publishing/steam-itch.html`
- Test: `tests/publishing-mobile-pipeline.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateMobileShells } from '../scripts/generate-mobile-shells.js';

const roots = [];

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

describe('publishing and mobile pipeline', () => {
  it('generates iOS Swift and Android Kotlin WebView shell projects', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omnicore-mobile-shells-'));
    roots.push(root);
    const result = generateMobileShells({ root, appName: 'OmniDemo', webDist: 'dist' });
    expect(existsSync(result.ios.appSwift)).toBe(true);
    expect(readFileSync(result.ios.appSwift, 'utf8')).toContain('WKWebView');
    expect(readFileSync(result.ios.appSwift, 'utf8')).toContain('dist/index.html');
    expect(existsSync(result.android.mainActivity)).toBe(true);
    expect(readFileSync(result.android.mainActivity, 'utf8')).toContain('WebView');
    expect(readFileSync(result.android.mainActivity, 'utf8')).toContain('file:///android_asset/index.html');
  });

  it('documents Steam and Itch.io publishing steps for Windows and Linux', () => {
    const markdown = readFileSync('docs/publishing/steam-itch.md', 'utf8');
    const html = readFileSync('website/publishing/steam-itch.html', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(markdown).toContain('Steam Windows');
    expect(markdown).toContain('Steam Linux');
    expect(markdown).toContain('Itch.io Windows');
    expect(markdown).toContain('Itch.io Linux');
    expect(html).toContain('Steam/Itch.io 发布教程');
    expect(packageJson.scripts['build:mobile']).toBe('node scripts/generate-mobile-shells.js');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/publishing-mobile-pipeline.test.js`
Expected: FAIL because the generator and docs are missing.

- [ ] **Step 3: Implement generator and docs**

Create a deterministic shell generator that writes `dist/mobile/ios/OmniDemo/App.swift`, `dist/mobile/ios/OmniDemo/Info.plist`, `dist/mobile/android/app/src/main/java/dev/omnicore/omnidemo/MainActivity.kt`, `AndroidManifest.xml`, and Gradle files. Add `npm run build:mobile`. Write Steam/Itch docs with Windows and Linux commands.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/publishing-mobile-pipeline.test.js`
Expected: PASS.

### Verification

- [ ] Run `npm test -- tests/marketplace-backend-platform.test.js tests/editor-deep-toolchain.test.js tests/publishing-mobile-pipeline.test.js`.
- [ ] Run relevant previous regressions: `npm test -- tests/marketplace-platform.test.js tests/lowcode-editor-suite.test.js tests/omnicore-full-stack-phase2.test.js`.
- [ ] Run `npm run marketplace:validate`.
- [ ] Run `npm --prefix packages/omnicore-editor run build`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
