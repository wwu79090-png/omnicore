# OmniCore Marketplace Low-Code Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the OmniCore plugin marketplace and desktop editor into a monetizable plugin platform plus low-code authoring suite compatible with `plugin.json`, `EventSheet.json`, `BehaviorTree.json`, `UI_Layout.json`, and `config/data.json`.

**Architecture:** Keep marketplace installation in Node CLI modules under `src/package` and `scripts/omni.js`, while marketplace publishing stays static-site/CI driven under `website` and `.github`. Extend `packages/omnicore-editor/src/editor-app.js` without replacing the existing dock workbench, using the current flow graph, tilemap, database, and IPC conventions.

**Tech Stack:** JavaScript ESM/CJS, Vitest, jsdom, Node filesystem/child_process APIs, static HTML, GitHub Actions YAML, Electron preload IPC.

---

### Task 1: Plugin Protocol and Installer

**Files:**
- Create: `src/package/PluginInstaller.js`
- Modify: `src/package/PackageManager.js`
- Modify: `scripts/omni.js`
- Test: `tests/plugin-installer-platform.test.js`

- [ ] **Step 1: Write failing CLI/installer tests**

```js
it('installs a free npm plugin into addons and updates package dependencies', async () => {
  const installer = new PluginInstaller({ root, downloader: fakeDownloader, unzipper: fakeUnzipper, packageManager: fakeNpm });
  const result = await installer.install('omni-particles', { source: 'npm:@omnicore/omni-particles' });
  expect(result.addonPath).toBe(path.join(root, 'addons', 'omni-particles'));
  expect(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies)
    .toMatchObject({ '@omnicore/omni-particles': 'latest' });
});

it('requires payment and decrypts paid plugin bundles before install', async () => {
  const installer = new PluginInstaller({ root, payment: fakePayment, decryptor: fakeDecryptor, downloader: paidDownloader, unzipper: fakeUnzipper });
  const result = await installer.install('premium-ai', { source: 'git:https://example.com/premium-ai.git' });
  expect(fakePayment.requests[0]).toMatchObject({ plugin: 'premium-ai', amountCents: 4900 });
  expect(fakeDecryptor.calls[0].licenseKey).toBe('paid-license');
  expect(result.manifest.isPaid).toBe(true);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/plugin-installer-platform.test.js`
Expected: FAIL because `PluginInstaller` is missing.

- [ ] **Step 3: Implement installer**

Create `PluginInstaller` with `validateManifest(manifest)`, `install(name, options)`, `auditBundle(files)`, `resolveSource(name, options)`, and package dependency writing. Default install path is `/addons/<plugin-name>`, free plugins download from npm or git, paid plugins call `payment.requestPayment()` and then `decryptor.decrypt()`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/plugin-installer-platform.test.js`
Expected: PASS with no warning output.

### Task 2: Marketplace Publishing and Tutorials

**Files:**
- Create: `scripts/generate-marketplace-site.js`
- Create: `.github/workflows/marketplace-review.yml`
- Modify: `.github/ISSUE_TEMPLATE/plugin_submission.yml`
- Modify: `website/plugins/index.html`
- Create: `website/marketplace/index.html`
- Create: `website/marketplace/omni-particles/index.html`
- Create: `website/tutorials/index.html`
- Test: `tests/marketplace-platform.test.js`

- [ ] **Step 1: Write failing marketplace tests**

```js
it('renders marketplace detail pages, install commands, paid metadata, and tutorials', () => {
  const index = readFileSync('website/marketplace/index.html', 'utf8');
  const detail = readFileSync('website/marketplace/omni-particles/index.html', 'utf8');
  const tutorials = readFileSync('website/tutorials/index.html', 'utf8');
  expect(index).toContain('omni install omni-particles');
  expect(index).toContain('isPaid: true');
  expect(detail).toContain('data-plugin-detail="omni-particles"');
  expect(tutorials.match(/class="tutorial-card"/g)).toHaveLength(10);
  expect(tutorials).toContain('认证讲师');
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/marketplace-platform.test.js`
Expected: FAIL because generated marketplace/tutorial pages and review workflow are missing.

- [ ] **Step 3: Implement static site and workflow**

Add a static marketplace page, one plugin detail page, a tutorials page with 10 tutorial cards, issue-form fields for source/license/isPaid/audit notes, and a GitHub Actions workflow that runs install/audit tests and marketplace generation.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/marketplace-platform.test.js`
Expected: PASS with no warning output.

### Task 3: Low-Code Editor Suite

**Files:**
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `packages/omnicore-editor/electron.main.cjs`
- Modify: `packages/omnicore-editor/preload.cjs`
- Test: `tests/lowcode-editor-suite.test.js`

- [ ] **Step 1: Write failing low-code editor tests**

```js
it('exports graph, UI layout, rule-tile tilemaps, and config/data.json database edits', async () => {
  const app = createEditorApp(root, { state: createEditorState({ database: { tables: { enemies: { slime: { id: 'slime', hp: 10 } } } } }) });
  app.EditorAPI.createNPCProximityRecipe({ npcId: 'slime', animation: 'talk', dialog: 'Hello' });
  app.EditorAPI.addUIButton({ id: 'start', text: '开始', x: 64, y: 80 });
  app.EditorAPI.applyRuleTileAt(4, 2);
  app.EditorAPI.updateDatabaseCell('enemies', 'slime', 'hp', 20);
  expect(app.exportFlowGraphEventSheet().events[0].actions).toEqual(expect.arrayContaining([expect.objectContaining({ op: 'playAnimation' })]));
  expect(app.exportBehaviorTreeJson()).toMatchObject({ type: 'selector' });
  expect(app.exportUILayoutJson().elements.map((item) => item.text)).toEqual(expect.arrayContaining(['开始']));
  expect(app.exportDataJson().enemies.slime.hp).toBe(20);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/lowcode-editor-suite.test.js`
Expected: FAIL because `EditorAPI` low-code helpers and exports are missing.

- [ ] **Step 3: Implement editor exports and UI**

Extend the dock panel list with `graph-editor`, `ui-editor`, and `database`; wire `EditorAPI.createNPCProximityRecipe`, `addUIButton`, `exportUILayoutJson`, `exportBehaviorTreeJson`, `applyRuleTileAt`, `updateDatabaseCell`, and `exportDataJson`. Persist database edits through `saveDataConfig({ path: 'config/data.json' })`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/lowcode-editor-suite.test.js`
Expected: PASS with no warning output.

### Task 4: Regression Verification

**Files:**
- Test: `tests/plugin-installer-platform.test.js`
- Test: `tests/marketplace-platform.test.js`
- Test: `tests/lowcode-editor-suite.test.js`
- Test: `tests/desktop-editor-workflow.test.js`
- Test: `tests/editor-maturity-ui.test.js`
- Test: `tests/plugin-marketplace-page.test.js`
- Test: `tests/marketplace-ci-mvp.test.js`

- [ ] **Step 1: Run focused regression suite**

Run: `npm test -- tests/plugin-installer-platform.test.js tests/marketplace-platform.test.js tests/lowcode-editor-suite.test.js tests/desktop-editor-workflow.test.js tests/editor-maturity-ui.test.js tests/plugin-marketplace-page.test.js tests/marketplace-ci-mvp.test.js`
Expected: PASS with no errors or warnings.

- [ ] **Step 2: Run build and static checks**

Run: `npm run build`
Expected: PASS with no build warnings.

Run: `git diff --check`
Expected: no output.
