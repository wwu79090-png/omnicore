# OmniCore Ergonomics Enhancements

## PrefabRegistry

Place JSON prefab files under `assets/prefabs`.

```js
await OmniCore.Prefab.load('slime');
const slime = OmniCore.Prefab.instantiate('slime', 100, 200);
scene.add(slime);
```

`extends` supports JSON inheritance:

```json
{
  "extends": "enemy",
  "texture": "slime",
  "props": { "hp": 3 }
}
```

## DevProfile

`DevProfile` runs only when `debug: true`.

```js
const profile = new OmniCore.DevProfile({ debug: true, audio: game.audio });
const report = await profile.scan();
console.table(report.suggestions);
```

The default scan simulates `200` tiles, `50` entities, and `1` synthesized sound for `10000ms`.

## Build-Time Source Optimizer

`npm run build` runs `scripts/optimize-source.js` first. It scans `src/game/**/*.js` and rewrites loop-local allocations:

```js
new Sprite('enemy')
```

to:

```js
OmniCore.Pool.allocate('Sprite')
```

Only `new Entity()` and `new Sprite()` inside `for` or `while` blocks are changed.

## TimeGuard

`TimeGuard` compares engine delta time against `Date.now()` growth. Spikes above `5x` the baseline are clamped to `16ms`.

```js
const deltaMs = game.timeGuard.clamp(rawDeltaMs);
```

`Game` wires `TimeGuard` into `Loop` by default.

## Templates

```js
const code = OmniCore.Templates.generate('topdown_player');
```

The generated code contains a `Player` sprite, WASD movement, and `Store` position updates.
