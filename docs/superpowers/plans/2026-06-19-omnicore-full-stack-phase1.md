# OmniCore Full Stack Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen OmniCore's renderer, scene-signal, AI navigation, asset platform, and dependency-forensics contracts as the first verifiable slice of the full engine roadmap.

**Architecture:** Keep the existing plug-in-first runtime and toolchain. Add narrow contracts to current modules instead of introducing parallel engine subsystems: renderer batches become typed-buffer manifests, Node/Entity get Godot-style signal connections, Light2D serializes color-temperature previews, tilemap baking emits navmesh assets, and platform packaging writes dead-resource reports plus rewritten asset URLs.

**Tech Stack:** JavaScript ESM, Vitest, Vite, Node.js build scripts, WebGPU/WebGL/Canvas renderer abstractions.

---

## File Structure

- Modify: `src/renderer/StaticBatchCompiler.js` - emit typed vertex buffer metadata from static sprite groups.
- Modify: `src/renderer/WebGPURenderer.js` - preserve precompiled static batch commands when rendering a scene.
- Modify: `src/lighting/Light2D.js` - support Kelvin color temperature and preview serialization.
- Modify: `src/node/Node.js` - add `connect()` for signal-to-handler and signal-to-signal links.
- Modify: `src/core/Entity.js` - ensure plain entities receive `connect()` when they do not inherit from `Node`.
- Modify: `src/visualgraph/VisualEventGraph.js` - export EventSheet JSON strings for editor file saves.
- Modify: `scripts/bake-tilemap-collisions.js` - emit `.navmesh.json` beside collision bake outputs.
- Modify: `scripts/build-platform-assets.js` - accept `--platform`, rewrite asset URLs with a platform public path, and write `unused-resources.txt`.
- Modify: `scripts/dependency-forensics.js` - support config-driven denied hosts and stricter installer host checks.
- Test: `tests/omnicore-full-stack-phase1.test.js` - lock this phase's user-facing contracts.

### Task 1: Phase Test Contract

**Files:**
- Create: `tests/omnicore-full-stack-phase1.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import OmniCore, { Entity, Light2D, Node, StaticBatchCompiler, Tilemap, VisualEventGraph, WebGPURenderer } from '../src/index.js';

describe('OmniCore full stack phase 1', () => {
  // Full test body is kept in the test file so it can be run independently.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/omnicore-full-stack-phase1.test.js`

Expected: FAIL because typed static buffers, `Node.connect`, EventSheet JSON string export, navmesh file bake, platform URL rewriting, and denied-host forensics are not implemented yet.

### Task 2: Renderer and Lighting Contracts

**Files:**
- Modify: `src/renderer/StaticBatchCompiler.js`
- Modify: `src/renderer/WebGPURenderer.js`
- Modify: `src/lighting/Light2D.js`
- Test: `tests/omnicore-full-stack-phase1.test.js`

- [ ] **Step 1: Implement typed static batch output**

```js
const manifest = StaticBatchCompiler.compileScene(scene);
expect(manifest.batches[0].vertexBuffer).toMatchObject({
  format: 'float32',
  strideFloats: 8,
  vertexCount: 4
});
expect(Array.from(manifest.batches[0].vertexBuffer.data.slice(0, 4))).toEqual([0, 0, 0, 0]);
```

- [ ] **Step 2: Preserve static batches during WebGPU render**

```js
renderer.renderScene({ staticBatches: manifest.batches, children: [dynamicSprite] });
expect(renderer.lastInstructions[0]).toMatchObject({ op: 'static-batch' });
```

- [ ] **Step 3: Add Light2D color-temperature preview serialization**

```js
const light = Light2D.point({ colorTemperature: 3200, intensity: 0.75 });
expect(light.preview()).toMatchObject({ colorTemperature: 3200, resolvedColor: '#ffc18c' });
expect(light.toDrawCommand().resolvedColor).toBe('#ffc18c');
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/omnicore-full-stack-phase1.test.js`

Expected: renderer and lighting assertions pass.

### Task 3: Scene Signals and Flow Graph Export

**Files:**
- Modify: `src/node/Node.js`
- Modify: `src/core/Entity.js`
- Modify: `src/visualgraph/VisualEventGraph.js`
- Test: `tests/omnicore-full-stack-phase1.test.js`

- [ ] **Step 1: Add `connect()` to Node**

```js
const source = new Node({ name: 'source' });
const target = new Node({ name: 'target' });
const seen = [];
source.connect('ready', target, 'accept');
target.on('accept', (payload) => seen.push(payload));
source.emit('ready', { ok: true });
expect(seen).toEqual([{ ok: true }]);
```

- [ ] **Step 2: Add `connect()` to plain Entity ergonomics**

```js
const entity = Entity.create('Actor');
const target = { accept(payload) { this.payload = payload; } };
entity.connect('hit', target, 'accept');
entity.emit('hit', { damage: 3 });
expect(target.payload).toEqual({ damage: 3 });
```

- [ ] **Step 3: Add EventSheet JSON string export**

```js
const graph = new VisualEventGraph({ debug: false });
graph.addNode({ id: 'start', type: 'event', data: { when: { op: 'scene:start' } } });
expect(JSON.parse(graph.exportEventSheetJSON()).format).toBe('OmniCore.EventSheet');
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/omnicore-full-stack-phase1.test.js`

Expected: scene signal and EventSheet assertions pass.

### Task 4: Build-Time Navigation and Asset Platform Gates

**Files:**
- Modify: `scripts/bake-tilemap-collisions.js`
- Modify: `scripts/build-platform-assets.js`
- Modify: `scripts/dependency-forensics.js`
- Test: `tests/omnicore-full-stack-phase1.test.js`

- [ ] **Step 1: Bake navmesh files with collision output**

```js
const report = bakeTilemapCollisionFiles({ source, outDir });
expect(report.navmeshes).toBe(1);
expect(existsSync(path.join(outDir, 'level.navmesh.json'))).toBe(true);
```

- [ ] **Step 2: Support `--platform` and dead-resource reports**

```js
execFileSync(process.execPath, ['scripts/build-platform-assets.js', '--platform', 'wechat', '--assets', assets, '--manifest', manifest, '--out', out]);
expect(readFileSync(path.join(out, 'unused-resources.txt'), 'utf8')).toContain('unused.png');
expect(JSON.parse(readFileSync(path.join(out, 'assets.manifest.json'), 'utf8')).images[0].url).toBe('wechat/hero.png');
```

- [ ] **Step 3: Block denied dependency hosts**

```js
writeFileSync(path.join(root, 'config/dependency-forensics.json'), JSON.stringify({ deniedHosts: ['github.com'] }));
const result = spawnSync(process.execPath, ['scripts/dependency-forensics.js', '--root', root]);
expect(result.status).toBe(1);
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/omnicore-full-stack-phase1.test.js`

Expected: build pipeline and forensics assertions pass.

### Task 5: Verification

**Files:**
- Verify: `tests/omnicore-full-stack-phase1.test.js`
- Verify: related pre-existing tests for renderer, 2D systems, asset pipeline, and forensics.

- [ ] **Step 1: Run focused new suite**

Run: `npm test -- tests/omnicore-full-stack-phase1.test.js`

Expected: PASS with no warnings.

- [ ] **Step 2: Run regression suites**

Run: `npm test -- tests/renderer-backends-mvp.test.js tests/advanced-2d-systems.test.js tests/asset-pipeline-industrial.test.js tests/succession-forensics-sandbox.test.js`

Expected: PASS with no warnings.

- [ ] **Step 3: Inspect git diff**

Run: `git diff -- docs/superpowers/plans/2026-06-19-omnicore-full-stack-phase1.md tests/omnicore-full-stack-phase1.test.js src/renderer/StaticBatchCompiler.js src/renderer/WebGPURenderer.js src/lighting/Light2D.js src/node/Node.js src/core/Entity.js src/visualgraph/VisualEventGraph.js scripts/bake-tilemap-collisions.js scripts/build-platform-assets.js scripts/dependency-forensics.js`

Expected: Diff only contains this phase's scoped changes.
