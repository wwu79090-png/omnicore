# OmniCore Quickstart

目标：新手在 2 小时内完成第一个可交互游戏原型。

## 三步完成第一个 Sprite 交互

### 1. 创建项目

```bash
npm create omnicore-app my-game
cd my-game
npm install
npm run dev
```

### 2. 创建 Sprite

```js
import OmniCore from 'omnicore-runtime';

const game = await new OmniCore.Game({
  parent: '#game',
  renderer: 'canvas',
  autoStart: false
}).init();

const scene = new OmniCore.Scene('first-scene');
const hero = new OmniCore.Sprite('hero', {
  x: 120,
  y: 160,
  width: 32,
  height: 32
});

scene.add(hero);
game.scene.register(scene);
await game.scene.push('first-scene');
game.renderer.renderScene(scene);
```

### 3. 加入交互

```js
window.addEventListener('keydown', (event) => {
  if (event.code === 'ArrowRight') hero.x += 8;
  if (event.code === 'ArrowLeft') hero.x -= 8;
  if (event.code === 'ArrowDown') hero.y += 8;
  if (event.code === 'ArrowUp') hero.y -= 8;
  game.renderer.renderScene(scene);
});
```

## 已完成代码示例

```html
<div id="game"></div>
<script type="module">
  import OmniCore from 'omnicore-runtime';

  const game = await new OmniCore.Game({ parent: '#game', renderer: 'canvas', autoStart: false }).init();
  const scene = new OmniCore.Scene('prototype');
  const hero = new OmniCore.Sprite('hero', { x: 120, y: 160, width: 32, height: 32 });
  scene.add(hero);
  game.scene.register(scene);
  await game.scene.push('prototype');
  game.renderer.renderScene(scene);

  window.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowRight') hero.x += 8;
    if (event.code === 'ArrowLeft') hero.x -= 8;
    if (event.code === 'ArrowDown') hero.y += 8;
    if (event.code === 'ArrowUp') hero.y -= 8;
    game.renderer.renderScene(scene);
  });
</script>
```

完成后继续打开 `examples/template-2d-platformer` 或 `examples/template-25d-showcase` 对照完整项目结构。
