# OmniCore Migration Painkiller Input Storage Checkpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove three migration blockers: HTML overlay input conflicts, legacy localStorage save migration, and debug checkpoint snapshots.

**Architecture:** Extend existing runtime boundaries instead of adding a parallel subsystem. `InputManager` owns overlay event consumption and keyboard ignore tags, `StorageManager.importLegacy()` reads and maps legacy JSON into an injected `Store`, and `Store.snapshot(name)` / `Store.loadSnapshot(name)` persist named debug checkpoints through the existing storage adapter.

**Tech Stack:** JavaScript ES modules, Vitest/jsdom, existing `InputManager`, `StorageManager`, and `Store`.

---

### Task 1: HTML Overlay And Keyboard Input Guard

**Files:**
- Modify: `src/input/InputManager.js`
- Modify: `src/core/OmniCore.js`
- Test: `tests/migration-painkillers.test.js`

- [ ] **Step 1: Write failing tests** proving `input.pointer.enableEventPropagation(domElement)` switches overlay pointer events to `auto`, stops pointer/click/wheel propagation, restores previous style on cleanup, and `ignoreTags` prevents `INPUT` / `TEXTAREA` keyboard events from entering OmniCore.
- [ ] **Step 2: Run RED** with `npm test -- tests/migration-painkillers.test.js`; expected failures are missing `enableEventPropagation` and ignored keyboard still being captured.
- [ ] **Step 3: Implement minimal input changes** by adding overlay binding cleanup to `PointerState`, default keyboard `ignoreTags: ['INPUT', 'TEXTAREA']`, and forwarding `config.input` from `Game` into `InputManager`.
- [ ] **Step 4: Run GREEN** with the focused test file.

### Task 2: Legacy localStorage Save Import

**Files:**
- Modify: `src/net/NetManager.js`
- Test: `tests/migration-painkillers.test.js`

- [ ] **Step 1: Write failing tests** for `StorageManager.importLegacy(localStorageKey, formatMap, { store })` reading legacy JSON, mapping nested paths and transform functions into `Store`, and returning an import report.
- [ ] **Step 2: Run RED** with the focused test file; expected failure is `importLegacy` missing.
- [ ] **Step 3: Implement importer** with dot-path readers, string/function/object mapping values, safe JSON parsing through existing `StorageManager.get`, and optional `removeLegacy` cleanup.
- [ ] **Step 4: Run GREEN** with the focused test file.

### Task 3: Debug Store Checkpoint Snapshots

**Files:**
- Modify: `src/store/Store.js`
- Modify: `src/core/OmniCore.js`
- Test: `tests/migration-painkillers.test.js`

- [ ] **Step 1: Write failing tests** for `store.snapshot('checkpoint')` and `store.loadSnapshot('checkpoint')` persisting/restoring named state only when the Store was created in debug mode.
- [ ] **Step 2: Run RED** with the focused test file; expected failure is `snapshot(name)` returning plain state without persisting and `loadSnapshot` missing.
- [ ] **Step 3: Implement checkpoint persistence** by adding `checkpointStorage`, `checkpointPrefix`, `loadSnapshot(name)`, and making `CoreGame` pass `debug` and `StorageManager` into `Store`.
- [ ] **Step 4: Run GREEN** and then run regression commands: `npm run lint`, `npm run test:contract`, and the focused tests.
