# OmniCore Flow Graph Monetization Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the first OmniCore parity gap against Unreal/Godot, Cocos/Unity, and RPG Maker by adding a desktop Flow Graph panel, payment/ad addon facades, and a visible plugin-market asset library entry.

**Architecture:** Keep visual logic authoring in the existing desktop editor and compile through `VisualEventGraph` into EventSheet JSON. Keep commercial SDK binding outside the core runtime by shipping `Payment`, `Ad`, and `WechatMiniGameMonetization` as official addons. Keep UGC discovery in the website plugin marketplace so the runtime does not bundle heavy art packs.

**Tech Stack:** JavaScript ESM, Vitest, jsdom editor tests, static HTML plugin marketplace, existing OmniCore official addon helper.

---

### Task 1: Flow Graph Event Nodes

**Files:**
- Modify: `src/visualgraph/VisualEventGraph.js`
- Test: `tests/editor-maturity-ui.test.js`

- [x] **Step 1: Write the failing test**

```js
const eventSheet = app.exportFlowGraphEventSheet();
expect(eventSheet.events[0]).toMatchObject({
  name: 'Game Start',
  when: { onStart: true },
  actions: [{ op: 'set', target: 'state.door', value: 'open' }]
});
expect(eventSheet.events[0].conditions[0].scope).toEqual({ doorId: 'north' });
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/editor-maturity-ui.test.js`
Expected: FAIL because `flow-graph` panel and `exportFlowGraphEventSheet()` do not exist.

- [x] **Step 3: Implement event-root compilation**

Add `_isEventNode()`, route event roots through `_buildEventRoot()`, and include `when` in `toEventSheet()` output while preserving existing condition-root behavior.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/editor-maturity-ui.test.js`
Expected: PASS with 2 tests.

### Task 2: Desktop Editor Flow Graph Panel

**Files:**
- Modify: `packages/omnicore-editor/src/editor-app.js`
- Modify: `packages/omnicore-editor/src/live-sync-protocol.js`
- Test: `tests/editor-maturity-ui.test.js`

- [x] **Step 1: Write the failing test**

```js
expect(root.querySelector('[data-panel="flow-graph"]')?.textContent).toContain('Flow Graph');
expect(root.querySelector('[data-flow-node-id="on-start"]')?.textContent).toContain('Game Start');
expect(root.querySelector('[data-flow-edge="on-start->has-key"]')?.textContent).toContain('Game Start -> Has Key');
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/editor-maturity-ui.test.js`
Expected: FAIL because the dock layout ignores `flow-graph`.

- [x] **Step 3: Implement the panel**

Add `flow-graph` to `PANEL_TITLES`, default dock layout, state normalization, panel rendering, `exportFlowGraphEventSheet()`, and `editor:flow-graph-export` transport emission.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/editor-maturity-ui.test.js`
Expected: PASS with 2 tests.

### Task 3: Payment, Ad, and WeChat Mini Game Addons

**Files:**
- Create: `src/addons/Payment.js`
- Create: `src/addons/Ad.js`
- Create: `src/addons/WechatMiniGameMonetization.js`
- Create: `src/addons/Payment.README.md`
- Create: `src/addons/Ad.README.md`
- Create: `src/addons/WechatMiniGameMonetization.README.md`
- Modify: `src/index.js`
- Modify: `tests/ecosystem.test.js`
- Modify: `tests/production-toolchain.test.js`

- [x] **Step 1: Write the failing test**

```js
await expect(payment.requestPayment({ orderId: 'order-1', amount: 6 })).resolves.toEqual({
  paid: true,
  orderId: 'order-1'
});
await expect(ad.showRewardedVideoAd('revive-video')).resolves.toEqual({
  completed: true,
  placementId: 'revive-video'
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ecosystem.test.js tests/production-toolchain.test.js`
Expected: FAIL because `src/addons/Payment.js` and related addon modules do not exist.

- [x] **Step 3: Implement the addons**

Create provider registries for `Payment` and `Ad`; create WeChat adapters for `wx.requestMidasPayment`, `wx.createRewardedVideoAd`, and `wx.createBannerAd`; export all three addons from `src/index.js`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/ecosystem.test.js tests/production-toolchain.test.js`
Expected: PASS with ecosystem and production addon tests.

### Task 4: Plugin Marketplace and Asset Library Entry

**Files:**
- Modify: `website/plugins/index.html`
- Create: `website/plugins/assets/wechat-monetization.svg`
- Modify: `tests/plugin-marketplace-page.test.js`
- Modify: `tests/official-plugin-scale.test.js`

- [x] **Step 1: Write the failing test**

```js
expect(page).toContain('WeChat Mini Game Monetization');
expect(page).toContain('npm install @omnicore/plugin-wechat-minigame-monetization');
expect(page).toContain('免费/商用 2D 素材库');
expect(page).toContain('starter-pixel-cc0.omni-asset');
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/plugin-marketplace-page.test.js tests/official-plugin-scale.test.js`
Expected: FAIL because the marketplace does not show WeChat monetization or the asset library.

- [x] **Step 3: Implement the marketplace entries**

Update the official count to 15, add the WeChat monetization plugin card, replace placeholder directory entries with `Payment`, `Ad`, and `WechatMiniGameMonetization`, and add CC0 `.omni-asset` starter pack cards.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/plugin-marketplace-page.test.js tests/official-plugin-scale.test.js`
Expected: PASS with 2 tests.

### Final Verification

- [x] Run `npm test -- tests/editor-maturity-ui.test.js tests/ecosystem.test.js tests/plugin-marketplace-page.test.js tests/official-plugin-scale.test.js tests/production-toolchain.test.js`.
- [x] Confirm expected result: 5 test files passed, 19 tests passed.
