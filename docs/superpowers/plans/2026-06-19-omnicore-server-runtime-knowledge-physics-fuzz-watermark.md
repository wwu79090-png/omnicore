# OmniCore Server Runtime and DX Systems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a first verifiable slice for server-side OmniCore WASM logic, runtime knowledge warnings, physics backend switching, fuzz replay, and build watermark verification.

**Architecture:** Keep existing browser-facing JavaScript APIs compatible and add isolated packages/scripts around them. The WASM core exposes a small numeric C ABI for Store, EventBus, and ECS; JavaScript adapters load the module in Node.js and Worker-style runtimes. Runtime DX warnings use a precompiled JSON knowledge index for low overhead.

**Tech Stack:** JavaScript ESM, Vitest, WebAssembly, C header/source ABI, optional Emscripten, Cloudflare Worker module examples.

---

## File Structure

- Create `packages/omnicore-core-wasm/include/omnicore_core.h`: public C API declarations for Store, EventBus, and ECS.
- Create `packages/omnicore-core-wasm/src/omnicore_core.c`: C implementation for Emscripten builds.
- Create `packages/omnicore-core-wasm/src/generated-minimal-wasm.js`: dependency-free WASM binary generator used when `emcc` is unavailable.
- Create `packages/omnicore-core-wasm/build.js`: build script that prefers `emcc` and falls back to the minimal generator.
- Create `packages/omnicore-core-wasm/adapters/node.js`: Node.js loader and ergonomic wrapper.
- Create `packages/omnicore-core-wasm/adapters/cloudflare-worker.js`: Worker module integration example.
- Create `packages/omnicore-core-wasm/package.json`: package metadata and scripts.
- Create `.knowledge-base/schema.json`: knowledge entry schema.
- Create `.knowledge-base/patterns.json`: at least 100 seedable pattern entries.
- Create `scripts/extract-knowledge-from-issues.js`: GitHub Issue + local LLM extraction script.
- Create `src/debug/KnowledgeBaseDiagnostics.js`: low-overhead runtime matcher.
- Modify `src/debug/ErrorDiagnostics.js`: integrate knowledge diagnostics before legacy fallbacks.
- Create `src/physics/backends/PhysicsBackend.js`: backend contract and state serializer helpers.
- Create `src/physics/backends/MatterBackend.js`: Matter-compatible adapter.
- Create `src/physics/backends/RapierBackend.js`: Rapier-compatible adapter.
- Create `src/physics/backends/Box2DWasmBackend.js`: Box2D.wasm-compatible adapter.
- Create `src/physics/backends/index.js`: backend registry.
- Modify `src/physics/PhysicsWorld.js`: add `setBackend`, state migration, and unified body APIs.
- Create `scripts/ai-fuzz-test.js`: offline fuzz runner and replay entry point.
- Create `scripts/lib/crash-replay.js`: `.crash-replay` serializer/parser/runner.
- Create `scripts/watermark-build.js`: build watermark injector.
- Create `scripts/verify-watermark.js`: offline verifier CLI.
- Create `website/watermark-verify/index.html`: offline verification website.
- Create `tests/server-runtime-wasm.test.js`: Node WASM ABI tests.
- Create `tests/knowledge-base-console.test.js`: runtime warning tests.
- Create `tests/physics-backends.test.js`: backend switching tests.
- Create `tests/ai-fuzz-replay.test.js`: fuzz replay tests.
- Create `tests/watermark-verification.test.js`: watermark tests.
- Create `docs/server-runtime-compatibility-report.md`: environment and compatibility report.

### Task 1: WASM Core ABI

**Files:**
- Create: `packages/omnicore-core-wasm/include/omnicore_core.h`
- Create: `packages/omnicore-core-wasm/src/omnicore_core.c`
- Create: `packages/omnicore-core-wasm/src/generated-minimal-wasm.js`
- Create: `packages/omnicore-core-wasm/build.js`
- Create: `packages/omnicore-core-wasm/adapters/node.js`
- Create: `packages/omnicore-core-wasm/adapters/cloudflare-worker.js`
- Create: `tests/server-runtime-wasm.test.js`

- [x] **Step 1: Write the failing Node ABI test**

```js
import { describe, expect, it } from 'vitest';
import { createOmniCoreWasm } from '../packages/omnicore-core-wasm/adapters/node.js';

describe('OmniCore core WASM ABI', () => {
  it('runs Store, EventBus, and ECS operations without browser globals', async () => {
    const runtime = await createOmniCoreWasm();
    const store = runtime.createStore();
    store.setI32(7, 42);
    expect(store.getI32(7, 0)).toBe(42);

    const bus = runtime.createEventBus();
    expect(bus.emit(3, 99)).toBe(1);
    expect(bus.pending()).toBe(1);
    expect(bus.drain()).toBe(1);

    const world = runtime.createWorld({ capacity: 16 });
    const entity = world.createEntity();
    world.addPosition(entity, 1, 2);
    world.addVelocity(entity, 4, -2);
    world.stepMovement(0.5);
    expect(world.position(entity)).toEqual({ x: 3, y: 1 });
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/server-runtime-wasm.test.js`
Expected: FAIL because `packages/omnicore-core-wasm/adapters/node.js` does not exist.

- [x] **Step 3: Implement the C ABI, generator, build script, and adapters**

Implement numeric APIs with exported functions named `omni_store_*`, `omni_eventbus_*`, and `omni_ecs_*`. The build script runs `emcc -O3 -sSTANDALONE_WASM=1 -sEXPORTED_FUNCTIONS=[...] -o dist/omnicore_core.wasm src/omnicore_core.c` when available, otherwise emits the generated minimal WASM bytes for local tests.

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/server-runtime-wasm.test.js`
Expected: PASS with no warnings.

### Task 2: Runtime Knowledge Diagnostics

**Files:**
- Create: `.knowledge-base/schema.json`
- Create: `.knowledge-base/patterns.json`
- Create: `scripts/extract-knowledge-from-issues.js`
- Create: `src/debug/KnowledgeBaseDiagnostics.js`
- Modify: `src/debug/ErrorDiagnostics.js`
- Create: `tests/knowledge-base-console.test.js`

- [x] **Step 1: Write the failing diagnostics test**

```js
import { describe, expect, it } from 'vitest';
import ErrorDiagnostics from '../src/debug/ErrorDiagnostics.js';

describe('knowledge-base runtime diagnostics', () => {
  it('matches known error patterns with solution and line reference hints', () => {
    const diagnostic = ErrorDiagnostics.analyze('Store set type mismatch at src/game.js:12');
    expect(diagnostic.title).toContain('Store');
    expect(diagnostic.solution).toContain('保持状态类型稳定');
    expect(diagnostic.reference).toContain('src/game.js:12');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/knowledge-base-console.test.js`
Expected: FAIL because knowledge diagnostics are not integrated.

- [x] **Step 3: Implement schema, seed patterns, issue extraction, and matcher**

Load `.knowledge-base/patterns.json` once at module initialization, compile safe regexes, and return a formatted warning object containing `title`, `message`, `solution`, `docs`, `intent`, and `reference`.

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/knowledge-base-console.test.js`
Expected: PASS with no warnings.

### Task 3: Physics Backend Switching

**Files:**
- Create: `src/physics/backends/PhysicsBackend.js`
- Create: `src/physics/backends/MatterBackend.js`
- Create: `src/physics/backends/RapierBackend.js`
- Create: `src/physics/backends/Box2DWasmBackend.js`
- Create: `src/physics/backends/index.js`
- Modify: `src/physics/PhysicsWorld.js`
- Create: `tests/physics-backends.test.js`

- [x] **Step 1: Write the failing backend migration test**

```js
import { describe, expect, it } from 'vitest';
import PhysicsWorld from '../src/physics/PhysicsWorld.js';

describe('PhysicsWorld multi-backend switching', () => {
  it('migrates body state across backend switches', async () => {
    const world = new PhysicsWorld();
    await world.setBackend('matter', { module: createFakeBackendModule('matter') });
    const body = world.createRigidBody({ id: 'hero', x: 2, y: 3, vx: 4, vy: 5, width: 10, height: 12 });
    await world.setBackend('rapier', { module: createFakeBackendModule('rapier') });
    expect(world.backendName).toBe('rapier');
    expect(world.getRigidBody('hero')).toMatchObject({ id: 'hero', x: 2, y: 3, vx: 4, vy: 5 });
    expect(body.id).toBe('hero');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/physics-backends.test.js`
Expected: FAIL because `setBackend` does not exist.

- [x] **Step 3: Implement registry, adapters, and state migration**

Add backend contract methods `init`, `serialize`, `restore`, `createRigidBody`, `getRigidBody`, `removeRigidBody`, `step`, `raycast`, and `destroy`. Keep existing Matter facade methods working by delegating only when the new backend API is used.

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/physics-backends.test.js`
Expected: PASS with no warnings.

### Task 4: Fuzz Replay

**Files:**
- Create: `scripts/ai-fuzz-test.js`
- Create: `scripts/lib/crash-replay.js`
- Create: `tests/ai-fuzz-replay.test.js`

- [x] **Step 1: Write the failing replay test**

```js
import { describe, expect, it } from 'vitest';
import { parseCrashReplay, serializeCrashReplay } from '../scripts/lib/crash-replay.js';

describe('AI fuzz crash replay format', () => {
  it('round-trips deterministic operation sequences', () => {
    const replay = serializeCrashReplay({
      seed: 123,
      operations: [{ type: 'click', x: 10, y: 20 }, { type: 'scene', name: 'battle' }],
      error: { message: 'deadlock detected' }
    });
    const parsed = parseCrashReplay(replay);
    expect(parsed.seed).toBe(123);
    expect(parsed.operations).toHaveLength(2);
    expect(parsed.error.message).toBe('deadlock detected');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/ai-fuzz-replay.test.js`
Expected: FAIL because replay helpers do not exist.

- [x] **Step 3: Implement replay helpers and offline fuzz CLI**

The CLI accepts `--iterations`, `--seed`, `--model`, `--replay`, and `--out`. If a local model endpoint or CLI is missing, it uses deterministic grammar-based operation generation and records the provider as `deterministic-local`.

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/ai-fuzz-replay.test.js`
Expected: PASS with no warnings.

### Task 5: Watermark Injection and Verification

**Files:**
- Create: `scripts/watermark-build.js`
- Create: `scripts/verify-watermark.js`
- Create: `website/watermark-verify/index.html`
- Create: `tests/watermark-verification.test.js`

- [x] **Step 1: Write the failing watermark test**

```js
import { describe, expect, it } from 'vitest';
import { injectWatermark, verifyWatermark } from '../scripts/watermark-build.js';

describe('OmniCore blind watermark', () => {
  it('passes official code and rejects tampered code', () => {
    const source = 'export function tick(x){ return x + 1; }';
    const marked = injectWatermark(source, { key: 'official-test' });
    expect(verifyWatermark(marked, { key: 'official-test' }).valid).toBe(true);
    expect(verifyWatermark(marked.replace('x + 1', 'x + 2'), { key: 'official-test' }).valid).toBe(false);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/watermark-verification.test.js`
Expected: FAIL because watermark scripts do not exist.

- [x] **Step 3: Implement injector, CLI verifier, and offline website**

Append a keyed, side-effect-neutral probe function plus signature metadata. The verifier recomputes the signature from canonicalized source and the key, then reports `official`, `tampered`, or `missing-watermark`.

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/watermark-verification.test.js`
Expected: PASS with no warnings.

### Task 6: Compatibility Report

**Files:**
- Create: `docs/server-runtime-compatibility-report.md`

- [x] **Step 1: Record environment facts**

Include detected toolchain state: `emcc` missing, `clang` missing, Git remote missing, Node available, `gh` available.

- [x] **Step 2: Record runnable verification**

Include exact test commands and results for the five focused tests.

- [x] **Step 3: Record remaining production blockers**

State that real Emscripten output requires installing `emsdk`; GitHub Issue extraction requires a configured repository remote or explicit `--repo owner/name`; 100 entries are seeded locally until issue extraction is run.

## Self-Review

- Spec coverage: Each requested subsystem has a task and a concrete test. True production Emscripten binary output and GitHub Issue extraction are represented as environment-dependent blockers instead of being claimed complete.
- Placeholder scan: No task uses TBD or open-ended implementation language; each task has files, test code, commands, and expected outputs.
- Type consistency: WASM Store/EventBus/ECS wrapper names, Physics backend names, diagnostic fields, replay fields, and watermark functions are consistent across tests and implementation notes.
