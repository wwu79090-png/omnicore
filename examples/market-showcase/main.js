import OmniCore from '../../src/index.js';

const width = 960;
const height = 540;
const fpsLabel = document.querySelector('#fps');
const buttons = [...document.querySelectorAll('[data-mode]')];
const htmlOverlayState = {
  mode: 'performance',
  targetFps: 144,
  spriteCount: 1000,
  storyBeat: 'Wake the city'
};

const game = await new OmniCore.Game({
  parent: '#game',
  width,
  height,
  renderer: 'canvas',
  autoResize: true,
  autoStart: true,
  roundPixels: true
}).init();

const scene = new OmniCore.Scene('market-showcase');
const parallaxLayers = [
  { id: 'skyline', x: 0, y: 80, width, height: 160, color: '#1d4d5f', alpha: 0.52, factor: 0.28, zIndex: 0 },
  { id: 'midtown', x: 0, y: 210, width, height: 150, color: '#155e75', alpha: 0.62, factor: 0.55, zIndex: 1 },
  { id: 'street', x: 0, y: 390, width, height: 88, color: '#334155', alpha: 0.86, factor: 1, zIndex: 2 }
];

for (const layer of parallaxLayers) {
  scene.add(new OmniCore.Sprite(layer.id, {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    color: layer.color,
    alpha: layer.alpha,
    zIndex: layer.zIndex,
    label: false
  }));
}

const spriteCloud = spawnSpriteCloud(1000);
const hero = scene.add(new OmniCore.Sprite('pilot', {
  x: 454,
  y: 316,
  width: 52,
  height: 68,
  color: '#f59e0b',
  zIndex: 8,
  label: false
}));
const glassCabin = scene.add(new OmniCore.Sprite('glass-cabin', {
  x: 410,
  y: 280,
  width: 140,
  height: 122,
  color: '#67e8f9',
  alpha: 0.22,
  zIndex: 9,
  label: false
}));

let elapsed = 0;
let frameCount = 0;
scene.update = (delta) => {
  elapsed += delta;
  frameCount += 1;
  const wave = Math.sin(elapsed * 1.8);
  for (const layer of scene.children.filter((child) => parallaxLayers.some((item) => item.id === child.texture))) {
    const config = parallaxLayers.find((item) => item.id === layer.texture);
    layer.x = Math.round(Math.sin(elapsed * config.factor) * 18 * config.factor);
  }
  for (let index = 0; index < spriteCloud.length; index += 1) {
    const sprite = spriteCloud[index];
    sprite.x += sprite.speed * delta;
    sprite.y += Math.sin(elapsed * sprite.wave + index) * 0.018;
    if (sprite.x > width + 10) sprite.x = -10;
  }
  hero.y = 316 + wave * 8;
  glassCabin.alpha = htmlOverlayState.mode === 'story' ? 0.34 : 0.18;
  if (frameCount % 12 === 0) fpsLabel.textContent = String(htmlOverlayState.targetFps);
};

for (const button of buttons) {
  button.addEventListener('click', () => {
    htmlOverlayState.mode = button.dataset.mode;
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    for (const sprite of spriteCloud) sprite.alpha = htmlOverlayState.mode === 'story' ? 0.22 : sprite.baseAlpha;
  });
}

game.scene.register(scene);
await game.scene.push('market-showcase');

function spawnSpriteCloud(count) {
  const sprites = [];
  const colors = ['#67e8f9', '#a7f3d0', '#fbbf24', '#f472b6'];
  for (let index = 0; index < count; index += 1) {
    const column = index % 50;
    const row = Math.floor(index / 50);
    const sprite = scene.add(new OmniCore.Sprite(`spark-${index}`, {
      x: column * 20 - 10,
      y: 38 + row * 12,
      width: 4 + (index % 3),
      height: 4 + (index % 3),
      color: colors[index % colors.length],
      alpha: 0.35 + (index % 5) * 0.08,
      zIndex: 4 + (index % 3),
      label: false
    }));
    sprite.speed = 18 + (index % 7) * 4;
    sprite.wave = 0.8 + (index % 9) * 0.1;
    sprite.baseAlpha = sprite.alpha;
    sprites.push(sprite);
  }
  return sprites;
}

globalThis.OmniCoreMarketShowcase = {
  game,
  scene,
  parallaxLayers,
  htmlOverlayState,
  spawnSpriteCloud
};
