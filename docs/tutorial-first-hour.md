# OmniCore 第一小时教程

本教程只使用当前仓库已经实现的功能：脚手架、默认素材、`Game`、`Scene`、`Sprite`、输入查询和 Canvas/Pixi 渲染。

## 1. 创建项目

```bash
npx create-omnicore-app my-first-game --template basic
cd my-first-game
npm install
npm run dev
```

脚手架会复制 `assets/sprites/default/` 到新项目，默认素材包含 16x16 玩家、草地、箱子和 NPC 像素块。

## 2. 修改初始化配置

打开 `src/main.js`，确认存在以下初始化代码：

```js
import OmniCore from 'omnicore';

const game = await new OmniCore.Game({
  parent: '#game',
  width: 640,
  height: 360,
  renderer: 'auto',
  debug: true
}).init();
```

`renderer: 'auto'` 会优先尝试 Pixi，失败后降级到 Canvas。`debug: true` 会打开性能面板、F1 API 速查和实体检查器。

## 3. 添加图像实体

```js
const scene = new OmniCore.Scene('play');
const player = scene.add(new OmniCore.Sprite('assets/sprites/default/default-tilesheet.svg', {
  x: 80,
  y: 80,
  width: 32,
  height: 32
}));

game.scene.register(scene);
await game.scene.push('play');
```

如果素材路径写错，debug 模式下 Loader 会生成红色缺失资源标记，并记录丢失路径。

## 4. 编写移动逻辑

```js
scene.update = (delta) => {
  const speed = 120 * delta;
  if (game.input?.keyboard.isDown('ArrowLeft')) player.x -= speed;
  if (game.input?.keyboard.isDown('ArrowRight')) player.x += speed;
  if (game.input?.keyboard.isDown('ArrowUp')) player.y -= speed;
  if (game.input?.keyboard.isDown('ArrowDown')) player.y += speed;
};
```

保存后刷新页面，方向键即可移动玩家。按 `F1` 可以打开 API 速查面板，右侧 Live Inspector 可以实时修改实体坐标。

## 5. 生成微信小游戏骨架

```bash
npx create-omnicore-app wechat-rpg --platform wechat --template rpg-mini
```

生成目录会包含 `project.config.json`、`game.json` 和 `wechat-adapter.js`。该适配层使用现有平台检测能力，不依赖未实现的编辑器功能。

## 6. 使用 3D + 物理生产模板

需要 2D 玩法、3D 背景和基础物理时，使用强制模板而不是手写启动文件：

```bash
npx create-omnicore-app arena-prototype --template 3d-physics
cd arena-prototype
npm install
npm run dev
```

该模板会生成 `#game-stage` 和 `#background-layer`，并给玩家和地面绑定基础物理刚体。玩法状态仍由 OmniCore 实体保存，3D 层只负责背景呈现。

## 7. 打开可视化事件树调试器

debug 构建中可以挂载事件图，并查看导出的树状逻辑：

```js
const graph = new OmniCore.VisualEventGraph({ debug: true });
graph.addNode({
  id: 'combo-ready',
  type: 'and',
  scope: { combo: 2 },
  data: { op: 'and' }
});
graph.addNode({ id: 'unlock', type: 'action', data: { op: 'set', target: 'state.unlocked', value: true } });
graph.connect('combo-ready', 'unlock');
graph.attach(document.body);
```

页面中会出现 `data-omnicore-event-tree` 预览。导出前先确认 AND/OR 嵌套、局部 `scope` 和 action 列表符合预期。

## 8. 跑市场压力基准

开发过程中至少跑一次默认基准：

```bash
npm run benchmark
```

输出中的 `complexStress` / `complexScene1200*` 指标用于市场对标：1200 实体、动态材质切换、碰撞激增和 Pixi draw-call 统计会一起记录。
