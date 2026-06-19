import OmniCore from '../src/index.js';

const game = await new OmniCore.Game({
  parent: '#app',
  renderer: 'offscreen',
  width: 640,
  height: 360,
  autoStart: false
}).init();

const scene = new OmniCore.Scene('offscreen-demo');
scene.add(new OmniCore.Sprite('/assets/sprites/default/hero.svg', { x: 24, y: 32, width: 32, height: 32 }));
game.renderer.renderScene(scene);
