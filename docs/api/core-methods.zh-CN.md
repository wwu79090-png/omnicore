# OmniCore 核心 API 使用场景

本页补充 `docs/api/README.zh-CN.md` 的速查内容。每个方法都给出一个常见使用场景，方便在编辑器、脚本和教程之间对照。

## OmniCore.Store.set(key, value)

用途：把运行时状态写入全局 Store，UI、调试面板和派生状态可以立即读取。

常见使用场景：记录角色当前位置，方便属性面板和存档系统同时使用。

```js
game.store.set('player.position', { x: player.x, y: player.y });
```

## OmniCore.Store.get(key)

用途：读取当前状态。

常见使用场景：从 Store 中恢复上次保存的角色位置。

```js
const position = game.store.get('player.position') || { x: 80, y: 80 };
player.x = position.x;
player.y = position.y;
```

## OmniCore.Scene.add(entity)

用途：把 Sprite、Tilemap 或自定义实体加入场景。

常见使用场景：创建角色，并让它出现在当前场景中。

```js
const player = scene.add(new OmniCore.Sprite('assets/sprites/default/hero.svg', {
  x: 96,
  y: 96,
  width: 32,
  height: 32
}));
```

## OmniCore.Sprite(texture, options)

用途：创建一个可渲染实体。

常见使用场景：创建 NPC 或宝箱，不需要先写继承类。

```js
const chest = new OmniCore.Sprite('assets/sprites/default/tile.svg', {
  x: 160,
  y: 128,
  width: 32,
  height: 32
});
scene.add(chest);
```

## OmniCore.Loader.loadBundle(items)

用途：批量加载资源，并在路径错误时返回友好占位对象。

常见使用场景：进入地图前先加载角色图、地图 JSON 和配置。

```js
const assets = await game.loader.loadBundle([
  { key: 'hero', url: 'assets/sprites/default/hero.svg', type: 'text' },
  { key: 'map', url: 'assets/maps/first-map.json', type: 'json' }
]);
```

## OmniCore.TilemapLoader.load(url)

用途：加载地图数据并转为 Tilemap 对象。

常见使用场景：加载地图后，把角色放到出生点。

```js
const map = await new OmniCore.TilemapLoader().load('assets/maps/first-map.json');
scene.add(map);
player.x = map.spawn?.x ?? 96;
player.y = map.spawn?.y ?? 96;
```

## OmniCore.Dimension3D.Scene

用途：在 2D 游戏旁边创建独立 3D Addon 场景。

常见使用场景：三行代码添加一个旋转模型，不影响 2D 场景实体。

```js
const scene3D = await new OmniCore.Dimension3D.Scene({ controls: 'orbit' }).init();
const cube = scene3D.add(scene3D.createRotatingBox({ rotationSpeed: { y: 1 } }));
scene3D.render(1 / 60);
```

## 从创建角色到加载地图

1. 用 `Scene.add(new Sprite(...))` 创建角色。
2. 在 `scene.update(delta)` 中根据输入修改 `player.x` 和 `player.y`。
3. 用 `Loader.loadBundle()` 或 `TilemapLoader.load()` 加载地图。
4. 用 `Store.set()` 保存角色位置和当前地图名。
