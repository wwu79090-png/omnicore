# OmniCore Foundation Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the P0-P2 engine foundation gaps with testable API governance, runtime lifecycle hardening, product save/audio/UI systems, plugin permissions, deterministic replay, asset manifest, editor protocol, multiplayer session, templates, and handbook docs.

**Architecture:** Keep changes additive and focused. Existing modules stay the runtime source of truth; new foundation modules provide explicit contracts, adapters, and CI gates around them. One acceptance test file locks the user-facing closure surface.

**Tech Stack:** ESM JavaScript, Vitest, PowerShell-friendly Node scripts, GitHub Actions, existing OmniCore runtime modules.

---

### Task 1: P0 Runtime Foundation

**Files:**
- Create: `src/core/ApiSurface.js`
- Create: `src/core/RuntimeErrorBoundary.js`
- Create: `src/assets/ResourceOwnershipGraph.js`
- Create: `src/scene/SceneLifecycle.js`
- Modify: `src/core/OmniError.js`
- Modify: `src/scene/Scene.js`
- Modify: `src/scene/SceneManager.js`
- Modify: `src/input/InputManager.js`
- Modify: `src/index.js`
- Test: `tests/foundation-closure.test.js`

- [ ] Add machine-readable API tiers with public/experimental/internal classification and breaking-change diff helpers.
- [ ] Add `OmniCoreErrorBoundary` for categorised recoverable/fatal errors, fallback values, event emission, and scene-safe recovery.
- [ ] Add resource ownership tracking and wire `Scene` to release owned resources on destroy.
- [ ] Add lifecycle metadata, async cancellation signal, and destroyed-scene callback guards.
- [ ] Extend `InputManager` with action maps for keyboard/pointer/touch/gamepad plus modal focus scopes.

### Task 2: P1 Product Runtime Foundation

**Files:**
- Create: `src/ui/UIFocusManager.js`
- Create: `src/core/PluginPermissionSandbox.js`
- Create: `src/core/DeterministicReplay.js`
- Modify: `src/net/NetManager.js`
- Modify: `src/audio/AudioManager.js`
- Modify: `src/index.js`
- Test: `tests/foundation-closure.test.js`

- [ ] Add multi-slot atomic saves with schema validation, backups, rollback, cloud adapter hooks, and optional encryption.
- [ ] Add standard audio buses, persisted mixer state, and streaming BGM descriptors.
- [ ] Add focus/modal manager with shortcut gating, ARIA metadata, safe-area and anchor helpers.
- [ ] Add plugin capability enforcement for store/events/assets/net/payment/ad/editor/file/storage scopes.
- [ ] Add seedable RNG, fixed-step replay recorder, input playback, and replay hashes.

### Task 3: P2 Ecosystem Foundation

**Files:**
- Create: `src/assets/AssetManifestGraph.js`
- Create: `src/editor/EditorProtocol.js`
- Create: `src/net/MultiplayerSession.js`
- Create: `docs/engine-handbook.md`
- Create: `examples/templates/rpg/README.md`
- Create: `examples/templates/platformer/README.md`
- Create: `examples/templates/visual-novel/README.md`
- Create: `examples/templates/card-battle/README.md`
- Create: `examples/templates/html-ui-migration/README.md`
- Create: `examples/templates/wechat-minigame/README.md`
- Modify: `src/index.js`
- Test: `tests/foundation-closure.test.js`

- [ ] Add canonical asset graph with hashes, dependency edges, platform variants, dead resources, and cache keys.
- [ ] Add versioned editor/runtime protocol negotiation, transaction commit/rollback, and command validation.
- [ ] Add multiplayer session baseline with room join, reconnect policy, state diffing, prediction/rollback hooks.
- [ ] Add production template entry points for the missing project families.
- [ ] Add a single engine handbook index linking quick start, architecture, migration, API, platform, plugins, troubleshooting, performance, privacy, and telemetry.

### Task 4: CI And Verification

**Files:**
- Create: `docs/api/api-surface.json`
- Create: `scripts/audit-api-surface.js`
- Modify: `package.json`
- Modify: `.github/workflows/pr-quality.yml`
- Test: `tests/foundation-closure.test.js`

- [ ] Add `npm run audit:api-surface` and run it in PR quality CI.
- [ ] Run focused foundation tests.
- [ ] Run contract tests for public API stability.
- [ ] Run lint for touched source, scripts, and tests.
