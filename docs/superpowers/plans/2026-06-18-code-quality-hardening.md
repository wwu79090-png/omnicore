# Code Quality Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve OmniCore quality without changing public APIs by hardening scripts, resource loading, HMR socket lifecycle, and input click semantics.

**Architecture:** Keep changes narrow and covered by regression tests. Extract shared script command execution into a small testable helper, normalize Loader asset keys internally, make ResourcesAddon own its HMR socket lifecycle, and prevent duplicate click events from pointer tap sequences.

**Tech Stack:** Node.js ESM, Vitest, Vite, browser DOM APIs.

---

### Task 1: Test Script Command Execution

**Files:**
- Create: `scripts/lib/run-command.js`
- Modify: `scripts/security-check.js`
- Test: `tests/scripts.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, expect, it, vi } from 'vitest';
import { createCommandRunner, resolvePackageCommand } from '../scripts/lib/run-command.js';

describe('script command helpers', () => {
  it('runs npm package commands through a shell on Windows', async () => {
    const execFileImpl = vi.fn((cmd, args, options, callback) => {
      callback(null, 'ok', '');
    });
    const runCommand = createCommandRunner({ platform: 'win32', cwd: 'C:/repo', execFileImpl });

    const result = await runCommand(resolvePackageCommand('npm', 'win32'), ['audit', '--json']);

    expect(result.ok).toBe(true);
    expect(execFileImpl).toHaveBeenCalledWith('npm.cmd', ['audit', '--json'], expect.objectContaining({ shell: true }), expect.any(Function));
  });

  it('captures non-zero command output without throwing', async () => {
    const execFileImpl = vi.fn((cmd, args, options, callback) => {
      const error = new Error('failed');
      error.code = 1;
      error.stdout = '{"error":true}';
      error.stderr = 'audit failed';
      callback(error, error.stdout, error.stderr);
    });
    const runCommand = createCommandRunner({ platform: 'linux', cwd: '/repo', execFileImpl });

    await expect(runCommand('npm', ['audit'])).resolves.toEqual({
      ok: false,
      stdout: '{"error":true}',
      stderr: 'audit failed',
      code: 1
    });
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/scripts.test.js`
Expected: FAIL because `scripts/lib/run-command.js` does not exist.

- [ ] **Step 3: Implement helper and wire security-check**

Create `scripts/lib/run-command.js` exporting `resolvePackageCommand`, `createCommandRunner`, and `runCommand`.

- [ ] **Step 4: Verify tests pass**

Run: `npm test -- tests/scripts.test.js`
Expected: PASS.

### Task 2: Normalize Loader Keys

**Files:**
- Modify: `src/loader/Loader.js`
- Test: `tests/omnicore.test.js`

- [ ] **Step 1: Write failing test**

```js
it('uses url as the output and cache key for keyless bundle items', async () => {
  let calls = 0;
  const loader = new Loader({
    fetcher: async () => {
      calls += 1;
      return { ok: true, json: async () => ({ loaded: true }) };
    }
  });

  const bundle = await loader.loadBundle([
    { url: '/config.json', type: 'json' },
    { url: '/config.json', type: 'json' }
  ]);

  expect(bundle['/config.json']).toEqual({ loaded: true });
  expect(bundle.undefined).toBeUndefined();
  expect(calls).toBe(1);
});
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- tests/omnicore.test.js -t "uses url as the output"`
Expected: FAIL because output is written to `undefined`.

- [ ] **Step 3: Implement normalized key handling**

Use `item.key || item.url` consistently for output and cache access.

- [ ] **Step 4: Verify test passes**

Run: `npm test -- tests/omnicore.test.js -t "uses url as the output"`
Expected: PASS.

### Task 3: Harden HMR Resources Addon

**Files:**
- Modify: `src/lean/addons/Resources.js`
- Test: `tests/lean-runtime.test.js`

- [ ] **Step 1: Write failing test**

```js
it('replaces HMR sockets and reports malformed payloads without throwing', async () => {
  const { ResourcesAddon } = await import('../src/lean/addons/Resources.js');
  const emitted = [];
  const sockets = [];
  class FakeSocket {
    constructor(url) {
      this.url = url;
      this.close = vi.fn();
      this.listeners = new Map();
      sockets.push(this);
    }
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }
    message(data) {
      this.listeners.get('message')?.({ data });
    }
  }

  const resources = new ResourcesAddon();
  resources.mount({ bus: { emit: (event, payload) => emitted.push([event, payload]) } });
  const first = resources.connectHMR('ws://one', FakeSocket);
  const second = resources.connectHMR('ws://two', FakeSocket);

  expect(first.close).toHaveBeenCalledTimes(1);
  second.message('{"type":"reload"}');
  expect(() => second.message('not json')).not.toThrow();
  expect(emitted[0]).toEqual(['resources:hmr', { type: 'reload' }]);
  expect(emitted[1][0]).toBe('resources:hmr:error');
});
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- tests/lean-runtime.test.js -t "replaces HMR sockets"`
Expected: FAIL because previous sockets are not closed and malformed JSON throws.

- [ ] **Step 3: Implement socket replacement and guarded parsing**

Close the previous socket before opening a new one; catch `JSON.parse` failures and emit `resources:hmr:error`.

- [ ] **Step 4: Verify test passes**

Run: `npm test -- tests/lean-runtime.test.js -t "replaces HMR sockets"`
Expected: PASS.

### Task 4: Prevent Duplicate Input Clicks

**Files:**
- Modify: `src/input/InputManager.js`
- Test: `tests/omnicore.test.js`

- [ ] **Step 1: Write failing test**

```js
it('emits one click for a pointer tap followed by native click', () => {
  const canvas = document.createElement('canvas');
  const input = new InputManager({ target: canvas });
  const click = vi.fn();
  input.pointer.on('click', click);

  canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 1, clientY: 2 }));
  canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 1, clientY: 2 }));
  canvas.dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 2 }));

  expect(click).toHaveBeenCalledTimes(1);
  input.destroy();
});
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- tests/omnicore.test.js -t "emits one click"`
Expected: FAIL because both `pointerup` and native `click` emit click.

- [ ] **Step 3: Implement click deduplication**

Emit `up` on `pointerup` and reserve `click` for native click events.

- [ ] **Step 4: Verify test passes**

Run: `npm test -- tests/omnicore.test.js -t "emits one click"`
Expected: PASS.

### Final Verification

- [ ] Run `npm test`
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Run `npm run health`
- [ ] Run `npm run security-check -- --dry-run`
