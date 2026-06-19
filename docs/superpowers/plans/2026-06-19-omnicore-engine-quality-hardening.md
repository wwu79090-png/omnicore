# OmniCore Engine Quality Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen OmniCore's production code quality by making engine tooling directly runnable, reducing WebGPU render-frame allocation, and locking the changes with focused tests.

**Architecture:** Keep the changes incremental and API-compatible. CLI entrypoints live inside their existing script modules, while WebGPU buffer reuse stays internal to `WebGPURenderer` so the public API shape does not drift.

**Tech Stack:** Node.js ESM scripts, Vitest, WebGPU renderer module, existing OmniCore quality gates.

---

### Task 1: Add Quality Hardening Tests

**Files:**
- Create: `tests/engine-quality-hardening.test.js`
- Test: `tests/engine-quality-hardening.test.js`

- [ ] **Step 1: Write failing tests for CLI entrypoints and WebGPU buffer reuse**

```js
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { WebGPURenderer } from '../src/index.js';

describe('engine quality hardening', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('runs asset watch CLI once and writes a deterministic hot-update report', () => {
    temp = mkdtempSync(path.join(os.tmpdir(), 'omnicore-quality-assets-'));
    const report = path.join(temp, 'asset-report.json');
    execFileSync(process.execPath, [
      'scripts/asset-watch-server.js',
      '--source', temp,
      '--once',
      '--file', 'hero.png',
      '--out', report
    ], { cwd: process.cwd(), stdio: 'pipe' });
    const payload = JSON.parse(readFileSync(report, 'utf8'));
    expect(payload).toMatchObject({
      type: 'assets:hot-update',
      files: ['hero.png'],
      conversions: [{ file: 'hero.png', output: 'hero.webp' }]
    });
  });

  it('runs OTA patch CLI and emits added changed and removed file sets', () => {
    temp = mkdtempSync(path.join(os.tmpdir(), 'omnicore-quality-patch-'));
    const before = path.join(temp, 'before');
    const after = path.join(temp, 'after');
    const out = path.join(temp, 'release.patch');
    mkdirSync(before, { recursive: true });
    mkdirSync(after, { recursive: true });
    writeFileSync(path.join(before, 'old.json'), '{"v":1}');
    writeFileSync(path.join(before, 'same.json'), '{"v":1}');
    writeFileSync(path.join(after, 'same.json'), '{"v":1}');
    writeFileSync(path.join(after, 'new.json'), '{"v":1}');
    writeFileSync(path.join(after, 'changed.json'), '{"v":2}');
    writeFileSync(path.join(before, 'changed.json'), '{"v":1}');
    execFileSync(process.execPath, [
      'scripts/ota-patch.js',
      '--from', before,
      '--to', after,
      '--out', out
    ], { cwd: process.cwd(), stdio: 'pipe' });
    const patch = JSON.parse(readFileSync(out, 'utf8'));
    expect(patch.added).toEqual(['new.json']);
    expect(patch.changed).toEqual(['changed.json']);
    expect(patch.removed).toEqual(['old.json']);
    expect(existsSync(out)).toBe(true);
  });

  it('reuses WebGPU entity buffers and normalizes non-finite entity values', () => {
    const renderer = new WebGPURenderer();
    const first = renderer.mapEntityBuffer([{ x: 1, y: 2, width: 3, height: 4 }]);
    const second = renderer.mapEntityBuffer([{ x: Number.POSITIVE_INFINITY, y: Number.NaN, width: 5, height: 6, alpha: Number.NaN }]);
    expect(second.buffer).toBe(first.buffer);
    expect(Array.from(second.float32.slice(0, 6))).toEqual([0, 0, 5, 6, 0, 1]);
    const expanded = renderer.mapEntityBuffer([
      { x: 1, y: 2 },
      { x: 3, y: 4 }
    ]);
    expect(expanded.bytes).toBeGreaterThan(first.bytes);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/engine-quality-hardening.test.js`

Expected: FAIL because the scripts do not implement `--once`/`--from`/`--to` CLI behavior and `WebGPURenderer.mapEntityBuffer()` allocates a new buffer each call.

### Task 2: Implement Script CLI Entrypoints

**Files:**
- Modify: `scripts/asset-watch-server.js`
- Modify: `scripts/ota-patch.js`

- [ ] **Step 1: Add `isCli()` detection and argument parsing**

Use `pathToFileURL(path.resolve(process.argv[1])).href` compared with `import.meta.url`, matching existing script patterns in the repository.

- [ ] **Step 2: Implement asset watch `--once` mode**

`node scripts/asset-watch-server.js --source source-assets --once --file hero.png --out report.json` should record the provided file, flush immediately, write the JSON report, print it, and exit 0.

- [ ] **Step 3: Implement OTA patch CLI**

`node scripts/ota-patch.js --from dist/old --to dist/new --out dist/update.patch` should call `createPatch`, write the patch file, print the JSON patch, and exit 0.

### Task 3: Reuse WebGPU Entity Buffers

**Files:**
- Modify: `src/renderer/WebGPURenderer.js`

- [ ] **Step 1: Add reusable buffer capacity tracking**

Store capacity in `this.entityBufferCapacityBytes`. Reallocate only when the next frame needs more bytes than the current buffer can hold.

- [ ] **Step 2: Normalize non-finite values**

Use a small helper that returns a fallback when numeric conversion produces `NaN`, `Infinity`, or `-Infinity`.

- [ ] **Step 3: Update `destroy()`**

Reset the buffer capacity field so destroyed renderers release reuse metadata.

### Task 4: Verify Quality Gates

**Files:**
- Test: `tests/engine-quality-hardening.test.js`
- Test: existing Vitest suite and benchmark/visual scripts

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/engine-quality-hardening.test.js tests/omnicore-2d-performance-crown.test.js tests/benchmark-threshold.test.js`

Expected: PASS.

- [ ] **Step 2: Run full suite**

Run: `npm test`

Expected: 49+ test files pass.

- [ ] **Step 3: Run performance and visual gates**

Run: `npm run benchmark:ci`

Expected: PASS, no performance regression report blockers.

Run: `npm run test:visual`

Expected: PASS with threshold `0.001`.
