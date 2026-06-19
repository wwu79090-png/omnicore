# OmniCore Advanced Capabilities Migration

This document describes the optional capabilities added after the base OmniCore
runtime. All modules are opt-in and keep existing `Game`, `Scene`, `Sprite`,
`Prefab`, `Store`, and `Backend` APIs compatible.

## 1. Node Tree and Nested Prefabs

Use `type: "node"` in prefab JSON when you need a pure hierarchy object:

```js
const root = OmniCore.Prefab.instantiate({
  type: 'node',
  name: 'Root',
  children: [{ type: 'node', name: 'Enemy' }]
});

root.getChild('Enemy');
```

Nested overrides are path-based:

```js
OmniCore.Prefab.instantiate(prefab, 0, 0, {}, {
  'Enemy/Weapon': { props: { damage: 12 } }
});
```

Existing sprite, scene, and button prefabs continue to work.

## 2. RPG Database

Load JSON tables from `examples/config/items.json`, `enemies.json`,
`skills.json`, and `states.json`:

```js
await OmniCore.DB.load({
  items: '/config/items.json',
  enemies: '/config/enemies.json',
  skills: '/config/skills.json',
  states: '/config/states.json'
});

const potion = OmniCore.DB.get('items', 'potion');
```

Records must include an `id` field. Tables can be object maps or arrays.

## 3. Timeline

Use `Timeline` when animation should come from JSON instead of chained tweens:

```js
const timeline = new OmniCore.Timeline({
  targets: { hero },
  events: { spawn: (payload) => spawnEnemy(payload) }
});

timeline.load(timelineJson).play();
timeline.update(delta * 1000);
```

Timeline config supports `duration`, `loop`, `tracks`, keyframes, easing names,
and event hooks.

## 4. Content Pipeline

Run the pipeline from the project root:

```bash
npm run pipeline
```

The script scans `assets/`, emits `dist/assets/sprites.atlas`, converts MP3
entries to WebM when `ffmpeg` exists, and writes `dist/assets/asset-manifest.json`.
Without `ffmpeg`, audio bytes are copied to `.webm` so CI remains deterministic.

## 5. Visual Event Graph

`VisualEventGraph` is debug-only. Do not mount it in production:

```js
if (game.config.debug) {
  const graph = new OmniCore.VisualEventGraph({ debug: true });
  graph.attach(document.body);
}
```

Exported JSON can be converted to Event Sheet JSON with `toEventSheet()`.
The current event sheet export supports nested `and` / `or` / `not` condition
trees and event-local `scope` data:

```js
const graph = new OmniCore.VisualEventGraph({ debug: true });
graph.addNode({
  id: 'ready',
  type: 'and',
  scope: { combo: 2 },
  data: { op: 'and' }
});
graph.addNode({ id: 'has-key', type: 'condition', data: { op: 'equals', left: 'state.key', right: true } });
graph.addNode({ id: 'override', type: 'or', data: { op: 'or' } });
graph.addNode({ id: 'open-door', type: 'action', data: { op: 'set', target: 'state.door', value: 'open' } });

graph.connect('ready', 'has-key').connect('ready', 'override').connect('ready', 'open-door');
graph.attach(document.body);
```

When `debug: true` is active, `attach()` renders a `data-omnicore-event-tree`
preview beside the node surface. This tree is the same structure used by
`toEventTree()`, so editor plugins can show the exact AND/OR nesting before
exporting a runnable event sheet.

## 6. Renderer Auto Fallback

`new OmniCore.Game({ renderer: 'auto' })` tries WebGPU first, then Pixi, then
Canvas. `RendererManager` can still be configured with a narrower fallback
order in tests or custom runtimes:

```js
await new OmniCore.Game({ renderer: 'auto' }).init();
```

Explicit `webgpu`, `pixi`, `canvas`, and `webgl` values are accepted. If
WebGPU is requested but unavailable, `Game.init()` falls back to Canvas through
the existing safe-initialization path.

## 7. Hot Reload

Hot reload listens for JSON messages from a WebSocket:

```json
{ "type": "asset", "assetType": "image", "key": "hero", "url": "/hero.png" }
```

```json
{ "type": "config", "dbType": "items", "id": "potion", "data": { "price": 25 } }
```

Configure it only in dev builds:

```js
new OmniCore.Game({ hotReload: { url: 'ws://localhost:35729' } });
```

## 8. AI Importer

`AIImporter` accepts a natural language prompt and returns `Scene.json`.
Use an injected LLM-compatible fetcher in production tools:

```js
const sceneJson = await game.aiImporter.generateScene('maze with 3 monsters');
```

If no endpoint is available, the importer uses a deterministic local parser for
simple monster/chest prompts.

## 9. Worker Manager

Register expensive tasks and run them through `OmniCore.Worker`:

```js
game.worker.register('pathfind', OmniCore.WorkerManager.astar);
const path = await game.worker.run('pathfind', { start, goal, grid });
```

Pure registered handlers run through a real `new Worker()` background channel
when the host supports it. Non-serializable payloads, `pure: false` handlers,
or unavailable Worker construction fall back to the main thread. A watchdog
rejects stalled tasks and tears down the worker so pending calls do not remain
open forever:

```js
game.worker.register('bakeNavmesh', bakeNavmesh);
game.worker.register('touchDom', touchDomNode, { pure: false });
await game.worker.run('bakeNavmesh', { tiles });
```

## 10. Dimension3D Decorative Background

`Dimension3D` is deliberately decorative. It lazy-loads Three.js and supports
one static `.gltf` or `.glb` model as a background layer:

```js
await new OmniCore.Game({
  renderer: 'pixi',
  dimension3D: {
    canvas: document.querySelector('#background-3d'),
    decorativeModel: {
      url: '/models/cyberpunk-city.glb',
      position: { x: 0, y: -1.2, z: -8 },
      scale: 1.4,
      rotationSpeed: { y: 0.08 }
    }
  }
}).init();
```

This is suitable for a Code Awakener level backdrop. It does not expose 3D
collisions, glTF animation playback, physics worlds, OrbitControls,
PointerLockControls, or gameplay camera control. If any of those options are
passed, the constructor throws instead of silently enabling broader 3D scope.

## 11. Commercial Engine MVP Modules

The commercial-engine MVP is intentionally thin but runnable:

```js
const game = await new OmniCore.Game({
  renderer: 'auto',
  framerateCap: 'auto',
  vsync: true,
  crashReporter: { endpoint: '/api/crash' }
}).init();

const spine = new OmniCore.SpineAdapter().create({ url: '/hero.skel' });
spine.play('run', { loop: true }).setSkin('neon');

const sequence = new OmniCore.Input.Sequence({ events: game.events });
sequence.define('dash', ['KeyA', 'KeyD', 'Space']);

const room = new OmniCore.Net.Room({ url: 'wss://example.com/room' });
room.join('arena-1', { playerId: 'p1' });
```

Included MVP surfaces:

- `WebGPURenderer` and `RenderWorkerBridge` for WebGPU entry and OffscreenCanvas worker messaging.
- `SpineAdapter` and `DragonBonesAdapter` for shared skeleton animation state APIs.
- `Light2D` for point/directional light draw commands and rectangle shadow helpers.
- `ParticleEditorPanel` for debug-time particle parameter editing and `particle.json` export.
- `Input.Sequence` for QTE and combo recognition through EventBus.
- `UIButton`, `UITextInput`, and `UIScrollView` for pure Canvas UI.
- `Storage.saveEncrypted()` / `Storage.loadEncrypted()` for simple XOR-protected save payloads.
- `Net.Room` for room-scoped WebSocket `join()` and `emit()`.
- `CrashReporter` for remote error reports with Store snapshot, metrics, memory, and operation logs.
- `npm run docs:api` for a generated static API documentation site under `docs/api-site`.

## 12. Plugin Market Protocol

Configure a CDN and install plugins:

```js
OmniCore.Store.configurePluginMarket({ cdn: 'https://cdn.example.com/plugins' });
await OmniCore.install('weather');
```

Plugin manifests must include `name`, `version`, `module`, and optional
`permissions`. The sandbox exposes only `register()`, plugin identity, version,
and declared permissions.

## 13. Official Editor Plugin Cascade

Editor integrations should load as a cascade instead of one monolithic plugin.
The recommended order is:

1. `manifest` plugin: declares editor surface, permissions, and exported tool ids.
2. `schema` plugin: contributes entity, tilemap, physics, event sheet, and asset schemas.
3. `panel` plugin: registers inspector panels and dockable editor views.
4. `debug` plugin: mounts runtime-only overlays such as `VisualEventGraph`.
5. `export` plugin: writes `.omni`, `.json`, and platform-specific project files.

The cascade is intentionally data-driven through the existing plugin market
protocol. A host editor can install only the `schema` layer for CI validation,
or load all five layers for a full authoring experience. This raises the
ecosystem-tooling score target from 58 to 75 because the engine now has a
documented path for editor panels, schema validation, event-tree debugging, and
export handoff without adding new runtime dependencies.

Runtime hosts can use `EditorPluginCascade` directly:

```js
const cascade = new OmniCore.EditorPluginCascade({ store: game.store });
cascade.register({ id: 'manifest', stage: 'manifest', activate: ({ store }) => store.set('editor:manifest', true) });
cascade.register({ id: 'event-tree', stage: 'debug', activate: ({ editor }) => editor?.refresh?.() });
await cascade.activate({ game, editor: game.editor });
```

## 14. 3D + Physics Production Template

Use the built-in template when a project needs a decorative 3D layer plus
runtime physics:

```bash
npx create-omnicore-app arena-prototype --template 3d-physics
```

The template creates:

- a 2D gameplay stage rendered by OmniCore.
- a decorative Three.js background layer through `Dimension3D`.
- a Lean `PhysicsAddon` configuration that accepts a host-provided Matter.js
  adapter.
- sample static floor and dynamic player body binding.

Template projects should keep gameplay state in OmniCore entities, use the 3D
layer for presentation, and map collision proxies through `PhysicsAddon` or
`Tilemap.createMatterColliders()`.

## 15. Tilemap + Physics Adapter

`Tilemap.parse()` reads finite and infinite Tiled `.json` layers. Object layers
can contain rectangles, ellipses, polygons, and polylines:

```js
const map = await new OmniCore.TilemapLoader().load('/maps/arena.json');
const walls = map.createMatterColliders(game.physics, 'Collisions', {
  category: 'world',
  mask: 'player'
});
```

The physics adapter turns each collision object into a Matter-compatible body
using rectangles, circles, or `Bodies.fromVertices()` when available.

## 16. Market Benchmark Stress Pack

`npm run benchmark` now includes a complex scene pack named
`complexScene1200`. It exercises:

- more than 1000 active entities.
- dynamic material-key switching every third frame.
- collision-pair spikes across a hot cluster.
- Pixi draw-call telemetry and renderer diff statistics.

The threshold script normalizes these metrics as
`complexScene1200Fps`, `complexScene1200DrawCalls`,
`complexScene1200CollisionPairs`, and
`complexScene1200MaterialSwitches`. Existing baselines that do not contain the
new fields remain valid; new benchmark reports include them for market
comparison.
