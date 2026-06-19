# OmniCore Core Runtime Expansion

## Offscreen 2D Rendering

Use `renderer: "offscreen"` to transfer the canvas to a Worker with `transferControlToOffscreen()`. The main thread serializes Tilemap, Sprite, UI, and mask commands; `src/renderer/offscreen-render-worker.js` owns the 2D context and draws with standard Canvas APIs.

```js
const game = await new OmniCore.Game({ parent: '#app', renderer: 'offscreen' }).init();
game.renderer.renderScene(scene);
```

## Synthetic Audio

`AudioManager.synthesize(name, options)` uses `OscillatorNode` and `GainNode` presets for `uiClick`, `compileSuccess`, and `footstep`, avoiding external audio file loads for common UI/runtime sounds.

## Timeline And Behavior Tree

`Timeline.load(json, runtime)` accepts `branches` with EventSheet-style conditions. `EventSheet.toBehaviorTree(json)` converts event conditions/actions into JSON behavior tree `ConditionNode` and `ActionNode` sequences for AI tooling.

## PackageManager REST Protocol

`omni install <name>` resolves `GET /packages/:name/:version`, downloads the manifest module, writes it under `plugins/<name>/index.js`, and updates `omni.config.json`.

Manifest shape:

```json
{
  "name": "fps-monitor",
  "version": "1.0.0",
  "module": "index.js",
  "config": { "debugPanel": true }
}
```

## OBundle

Run `node scripts/build-obundle.js --assets assets --out dist/assets.obundle` to pack `assets/` into a binary `.obundle`. Load it at runtime with `OmniCore.OBundle.load(buffer)` and access assets by key.

## ABTest, Hotfix, Analytics

`ABTest.fromJSON(config).select(name, { userId })` provides deterministic weighted variants.
`HotfixManager.checkNow()` loads `config/hotfix.json` and patches scenes/functions.
`Analytics.track(name, payload)` records device, FPS, scene, and payload, then `flush()` emits JSON logs or calls a backend transport.
