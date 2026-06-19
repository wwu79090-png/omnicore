# OmniCore Market 90 Score Lift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise OmniCore's explicit market-position scores for Web 2D candidate, Phaser migration appeal, Pixi framework layer, and editor/low-code maturity to 90+ with executable evidence.

**Architecture:** Add a dedicated market-position scorecard separate from the existing overall quality score, then implement the missing evidence with focused compatibility/workflow helpers. Keep runtime changes additive: Phaser compatibility lives under `src/compat/phaser`, Pixi framework support under `src/renderer`, editor market workflow under `src/editor`, and scoring under `src/quality`.

**Tech Stack:** JavaScript ESM, Vitest, existing OmniCore scene/editor/renderer modules, Node quality scripts.

---

### Task 1: Dedicated Market-Position Scorecard

**Files:**
- Create: `src/quality/MarketPositioningScorecard.js`
- Modify: `scripts/generate-quality-report.js`
- Modify: `scripts/engine-doctor.js`
- Test: `tests/market-90-scorecard.test.js`

- [ ] **Step 1: Write failing tests** requiring `marketPositioningScorecard.overallScore >= 90` and all four dimensions `web2DEngineCandidate`, `phaserMigrationAppeal`, `pixiFrameworkLayer`, `editorLowCodeMaturity` to be `>= 90`.
- [ ] **Step 2: Run RED** with `npm test -- tests/market-90-scorecard.test.js`.
- [ ] **Step 3: Implement scorecard** with file/script/test evidence and explicit `target: 90`.
- [ ] **Step 4: Wire quality report and doctor** so the score appears in generated reports and blocks doctor if below target.
- [ ] **Step 5: Run GREEN** with `npm test -- tests/market-90-scorecard.test.js tests/quality-report.test.js tests/engine-doctor.test.js`.

### Task 2: Phaser Migration Appeal

**Files:**
- Create: `src/compat/phaser/PhaserCompat.js`
- Modify: `src/index.js`
- Modify: `scripts/omni-migrate.js`
- Test: `tests/phaser-compat-layer.test.js`
- Test: `tests/migration-analysis.test.js`

- [ ] **Step 1: Write failing tests** for `createPhaserCompatScene`, `this.add.sprite`, `this.physics.add.sprite`, `this.physics.add.collider`, `this.input.keyboard.on`, and migration analysis detecting tweens/input/loader.
- [ ] **Step 2: Run RED** with `npm test -- tests/phaser-compat-layer.test.js tests/migration-analysis.test.js`.
- [ ] **Step 3: Implement additive compatibility facade** that maps common Phaser idioms to OmniCore `Scene`, `Sprite`, physics metadata, and input binding records.
- [ ] **Step 4: Extend migration analyzer** to detect Phaser tweens, input, loader assets, and sprite factory usage.
- [ ] **Step 5: Run GREEN** with the same focused tests.

### Task 3: Pixi Framework Layer

**Files:**
- Create: `src/renderer/PixiFrameworkBridge.js`
- Modify: `src/index.js`
- Test: `tests/pixi-framework-layer.test.js`

- [ ] **Step 1: Write failing tests** for Pixi-style display object mounting, filter preset collection, texture lifecycle cleanup, and framework adoption plan output.
- [ ] **Step 2: Run RED** with `npm test -- tests/pixi-framework-layer.test.js`.
- [ ] **Step 3: Implement bridge** that adapts Pixi display objects into OmniCore scene children, tracks filters, tracks textures with `PixiTextureLifecycle`, and emits a Pixi-to-OmniCore framework plan.
- [ ] **Step 4: Export bridge** from public entry without changing default contract shape unexpectedly.
- [ ] **Step 5: Run GREEN** with focused tests and API contract snapshot test.

### Task 4: Editor And Low-Code Maturity

**Files:**
- Create: `src/editor/EditorMarketReadiness.js`
- Modify: `src/index.js`
- Test: `tests/editor-market-readiness.test.js`

- [ ] **Step 1: Write failing tests** proving the editor workflow report covers project open/save, autosave recovery, undo/redo, low-code exports, authoring bundle, profiler hotspots, and platform build settings.
- [ ] **Step 2: Run RED** with `npm test -- tests/editor-market-readiness.test.js`.
- [ ] **Step 3: Implement report builder** that consumes an editor app instance or exported bundle and returns score, gaps, evidence, and next actions.
- [ ] **Step 4: Export helper** so marketplace/doctor/tests can use it.
- [ ] **Step 5: Run GREEN** with focused editor tests.

### Task 5: Web 2D Candidate Evidence

**Files:**
- Create: `docs/market-positioning/web-2d-engine-candidate.md`
- Create: `website/market-positioning/index.html`
- Test: `tests/web2d-market-position.test.js`

- [ ] **Step 1: Write failing tests** requiring public positioning docs to include 2D runtime, Web/微信 publishing, benchmark, quality gate, migration, and plugin-security evidence.
- [ ] **Step 2: Run RED** with `npm test -- tests/web2d-market-position.test.js`.
- [ ] **Step 3: Add docs/site page** using existing quality evidence and the new scorecard dimensions.
- [ ] **Step 4: Run GREEN** with focused tests.

### Task 6: Verification

**Files:**
- Test: focused new tests
- Test: `npm test`
- Lint: `npm run lint`
- Build: `npm run build`
- Quality: `npm run doctor`, `npm run quality:gate`

- [ ] **Step 1: Run focused suite** for market score, Phaser, Pixi, editor, and Web2D docs.
- [ ] **Step 2: Run full test suite** with `npm test`.
- [ ] **Step 3: Run lint/build/doctor/quality gate** and fix every error or warning.
- [ ] **Step 4: Clean generated timestamp-only noise while keeping real report evidence.
