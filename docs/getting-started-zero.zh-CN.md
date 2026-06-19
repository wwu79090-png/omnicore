# 零基础第一条完整流程

这份教程面向第一次打开 OmniCore 的策划、美术或新手开发者。你不用先理解引擎源码，只要按步骤完成：创建角色、让角色移动、加载地图。

## 你会看到什么

截图位置：`website/assets/code-awakener-screenshot.svg` 可以作为编辑器首屏参考。画面左侧是游戏区域，右侧是实体树和属性面板。

## 1. 创建项目

打开终端，执行：

```bash
npx create-omnicore-app my-first-game --template basic
cd my-first-game
npm install
npm run dev
```

浏览器打开本地地址后，会看到一个空白舞台或默认示例。

## 2. 创建角色

把下面这段放进 `src/main.js` 的初始化代码后面：

```js
const scene = new OmniCore.Scene('play');
const player = scene.add(new OmniCore.Sprite('assets/sprites/default/hero.svg', {
  x: 96,
  y: 96,
  width: 32,
  height: 32
}));

game.scene.register(scene);
await game.scene.push('play');
```

通俗理解：`Scene` 是房间，`Sprite` 是角色图片，`scene.add()` 就是把角色放进房间。

## 3. 让角色移动

继续加入：

```js
scene.update = (delta) => {
  const speed = 120 * delta;
  if (game.input?.keyboard.isDown('ArrowLeft')) player.x -= speed;
  if (game.input?.keyboard.isDown('ArrowRight')) player.x += speed;
  if (game.input?.keyboard.isDown('ArrowUp')) player.y -= speed;
  if (game.input?.keyboard.isDown('ArrowDown')) player.y += speed;
};
```

刷新页面，按方向键。角色移动时，你可以打开编辑器面板查看 x、y 是否变化。

## 4. 加载地图

先准备 `assets/maps/first-map.json`。最小内容可以是：

```json
{
  "name": "first-map",
  "spawn": { "x": 96, "y": 96 },
  "layers": []
}
```

然后在角色创建后加载：

```js
const mapData = await game.loader.loadBundle([
  { key: 'map', url: 'assets/maps/first-map.json', type: 'json' }
]);

game.store.set('currentMap', mapData.map.name);
player.x = mapData.map.spawn.x;
player.y = mapData.map.spawn.y;
```

通俗理解：地图 JSON 是说明书，Loader 负责读说明书，Store 负责记录“当前在哪张地图”。

## 5. 在编辑器中检查

1. 启动时把 `editor: true` 打开。
2. 在场景树里点击角色。
3. 在属性面板修改 x、y、scale。
4. 如果你有 `assets/prefabs/*.json`，在资产浏览器点击它，右侧会出现 Prefab 预览，不会把它直接塞进游戏场景。

## 6. 遇到问题

- 看不到角色：先检查图片路径是否写错。
- 角色不动：确认页面焦点在游戏画布里，再按方向键。
- 地图加载失败：打开浏览器控制台，查找 Loader 输出的资源路径提示。
