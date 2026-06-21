# OmniCore Engine Foundation Hardening

This document records the runtime foundations that should be treated as release gates for OmniCore projects.

## Scene Documents

Use `normalizeSceneDocument(sceneJson)` before loading editor-authored or migrated scenes. It converts legacy `objects`, `entities`, or `nodes` arrays into the canonical `omnicore.scene-document.v1` shape.

Recommended release check:

```js
import { assertValidSceneDocument, collectSceneDependencies, normalizeSceneDocument } from 'omnicore';

const document = normalizeSceneDocument(rawScene);
assertValidSceneDocument(document);
const dependencies = collectSceneDependencies(document);
```

Every runtime scene node should have a stable `id`, finite transform fields, and component entries with explicit `type`.

## Asset Pipeline Gate

Use `createAssetPipelineReport()` or `new AssetPipelineGate().assert()` after building an asset manifest. The gate checks:

- total package budget and per-type budgets
- missing content hashes
- missing referenced assets
- missing required assets
- asset dependency cycles
- largest files and largest directories
- dead resources reported by the manifest graph

Recommended CI check:

```js
import { AssetManifestGraph, AssetPipelineGate } from 'omnicore';

const manifest = AssetManifestGraph.fromAssets(assets, { references });
new AssetPipelineGate({
  manifest,
  budgets: {
    totalBytes: 4 * 1024 * 1024,
    byType: { image: 2 * 1024 * 1024 }
  },
  required: ['hero.png', 'zh.fnt']
}).assert();
```

## Deterministic Render Queue

Use `createDeterministicRenderQueue()` before visual regression capture or replay comparison. The queue sorts by render layer, `zIndex`, Y, X, and stable id, so the same logical scene produces the same render order even if objects were inserted in a different sequence.

Recommended visual regression input:

```js
import { createDeterministicRenderQueue, snapshotRenderQueue } from 'omnicore';

const queue = createDeterministicRenderQueue(scene.children, {
  layerOrder: ['background', 'world', 'ui']
});
const snapshot = snapshotRenderQueue(queue);
```

Persist the snapshot hash alongside golden screenshots when investigating render-order flicker.

## Prefab Validation

Use `PrefabManager.validate(prefabJson)` and `PrefabManager.collectDependencies(prefabJson)` before adding prefabs to bundles. Prefabs should avoid duplicate sibling names, anonymous children, and components without `type`.

Recommended import check:

```js
import { PrefabManager } from 'omnicore';

const report = PrefabManager.validate(prefabJson);
if (!report.ok) throw new Error(JSON.stringify(report.errors, null, 2));
const dependencies = PrefabManager.collectDependencies(prefabJson);
```

These dependencies can be merged into `AssetManifestGraph` references so bundles fail before runtime when a texture, audio clip, font, model, or nested prefab is missing.

## Release Gate CLI

Run the foundation gate before publishing:

```bash
npm run foundation:gate
```

The command writes `docs/release-notes/foundation-gate-report.json` and checks scene documents, prefab dependencies, the asset pipeline report, and deterministic render snapshots. `npm run production-ready -- --verify` also includes this gate in its default verification script list.

## Runtime Soak

Run a longer lifecycle stability pass locally before important releases:

```bash
npm run test:soak -- --iterations 600 --sprites 16 --resources 4 --tweens 4
```

The soak report is written to `docs/release-notes/runtime-soak-report.json`. It repeatedly creates and destroys scenes, sprites, tracked resources, timers, and tweens, then fails if children, listeners, or resource references remain after teardown.

## Visual Snapshots

`npm run test:visual` now records deterministic render queue snapshots for the core golden examples in `tests/visual/golden/examples.json`. Pixel diff and render-order stability must both pass for a visual example to pass.

## Reproduction Bundles

Use `CrashHandler.captureReproduction(error, context, options)` when a runtime failure should become a shareable bug report:

```js
const bundle = crashHandler.captureReproduction(error, { phase: 'render' }, {
  assetManifest,
  inputs: input.history
});
```

The bundle contains the crash report, normalized scene document, dependency list, asset manifest, recent inputs, render queue snapshot, store snapshot, metrics, and runtime device information.
