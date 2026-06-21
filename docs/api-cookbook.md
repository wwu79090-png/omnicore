# OmniCore API Cookbook

这份 Cookbook 面向第一次试用和迁移用户：每段代码都保持最小、可复制、可逐步扩展。

## 三行画出第一个角色

```js
import OmniCore from 'omnicore';

const game = await new OmniCore.Game({ parent: '#app', renderer: 'canvas' }).init();
const scene = Object.assign(new OmniCore.Scene('play'), { create() { this.add(new OmniCore.Sprite('hero', { x: 120, y: 120, width: 48, height: 48, color: '#38bdf8' })); } });
game.scene.register(scene); await game.scene.push('play');
```

## Sprite：占位角色与贴图角色

```js
const hero = new OmniCore.Sprite('hero.png', {
  x: 80,
  y: 120,
  width: 48,
  height: 48,
  color: '#38bdf8'
});
scene.add(hero);
```

## Scene：注册、切换和更新

```js
const play = new OmniCore.Scene('play');
play.update = (delta) => {
  hero.x += 120 * delta;
};
game.scene.register(play);
await game.scene.push('play');
```

## Tween：按钮、UI 和角色过渡

```js
const tween = new OmniCore.Tween(hero, {
  x: { from: 80, to: 520 },
  duration: 900,
  ease: 'inOutCubic',
  yoyo: true
}).onComplete(() => console.log('done'));

scene.update = (delta) => tween.update(delta * 1000);
```

## Input：键盘、点击、滑动和缩放

```js
scene.update = (delta) => {
  const speed = 180 * delta;
  if (game.input.keyboard.isDown('ArrowLeft')) hero.x -= speed;
  if (game.input.keyboard.isDown('ArrowRight')) hero.x += speed;
};

game.input.pointer.on('swipe', ({ direction }) => console.log(direction));
game.input.pointer.on('pinch', ({ scale }) => console.log(scale));
```

## Audio：音乐、音效和淡入淡出

```js
await game.audio.load('coin', '/assets/audio/coin.ogg');
game.audio.play('coin', { volume: 0.7 });
game.audio.fadeIn?.('bgm', 800);
```

## Loader：资源预加载和离线兜底

```js
await game.loader.loadBundle('/assets/assets.manifest.json');
await OmniCore.Font.load('SourceHanSans', '/assets/fonts/source-han-sans.woff2');
```

## Mask：Sprite 遮罩与裁剪

```js
const glass = new OmniCore.Sprite('glass', { x: 100, y: 80, width: 240, height: 140, alpha: 0.5 });
const mask = new OmniCore.Sprite('mask', { x: 120, y: 100, width: 180, height: 100 });
glass.setMask(mask).setCrop({ x: 0, y: 0, width: 180, height: 100 });
scene.add(glass);
```

## 2.5D：Y 轴排序与轻量伪阴影

```js
scene.sortChildren = () => {
  scene.children.sort((left, right) => (left.y || 0) - (right.y || 0));
};

const shadow = new OmniCore.Sprite('shadow', { x: hero.x, y: hero.y + 44, width: 48, height: 12, color: '#000000', alpha: 0.22 });
scene.add(shadow);
```

## Physics adapter：Phaser 风格接触判定

```js
const arcade = new OmniCore.Physics.ArcadeAdapter();
arcade.addCollider(player, platforms, () => console.log('landed'));
arcade.addOverlap(player, coins, (hero, coin) => coin.destroy?.());
```

## HTML overlay：保留 CSS UI

```js
const overlay = new OmniCore.HtmlOverlay({ root: document.body });
overlay.mount('<div class="dialogue">Press E to talk</div>');
```

## exportRunnableProject：编辑器一键导出可运行工程

```js
const project = OmniCore.EditorAPI.exportRunnableProject({
  projectName: 'my-first-omnicore-game'
});
console.log(project.files.map((file) => file.path));
```

## 官方可玩模板

- `examples/official-templates/platformer`
- `examples/official-templates/rpg-dialogue`
- `examples/official-templates/bullet-heaven`
