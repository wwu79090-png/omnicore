# 10 分钟极简教程：三行画出第一个角色

目标：让第一次接触 OmniCore 的用户在 10 分钟内看到第一个角色出现在画面中。

## 1. 创建最小页面

```html
<div id="app"></div>
<script type="module" src="/src/main.js"></script>
```

## 2. 安装

```bash
npm install omnicore
```

如果官方源较慢：

```bash
npm config set registry https://registry.npmmirror.com/
npm install omnicore
```

## 3. 三行代码画出角色

在 `src/main.js` 中写入：

```js
import OmniCore from 'omnicore';

const game = await new OmniCore.Game({ parent: '#app', renderer: 'canvas' }).init();
const scene = Object.assign(new OmniCore.Scene('play'), { create() { this.add(new OmniCore.Sprite('hero', { x: 120, y: 120, width: 48, height: 48, color: '#38bdf8' })); } });
game.scene.register(scene); await game.scene.push('play');
```

你会看到一个蓝色方块角色。没有贴图时，`Sprite` 会用颜色和文字标签渲染占位角色，方便先跑通流程。

## 4. 让角色移动

跑通后再加键盘移动：

```js
scene.update = (delta) => {
  const speed = 160 * delta;
  if (game.input.keyboard.isDown('ArrowLeft')) scene.children[0].x -= speed;
  if (game.input.keyboard.isDown('ArrowRight')) scene.children[0].x += speed;
  if (game.input.keyboard.isDown('ArrowUp')) scene.children[0].y -= speed;
  if (game.input.keyboard.isDown('ArrowDown')) scene.children[0].y += speed;
};
```

## 5. 下一步

- 打开 `website/playground/index.html`：在线改代码并看预览。
- 打开 `website/editor/index.html`：拖拽实体、改属性、保存场景。
- 需要完整小游戏结构时，继续看 `examples/full-game-demo/`。
