import OmniCore from 'omnicore-runtime';

const gravity = 1600;
const jumpVelocity = -620;
const velocity = { x: 0, y: 0 };

const game = await new OmniCore.Game({ parent: '#game', renderer: 'canvas', autoStart: false }).init();
const scene = new OmniCore.Scene('template-2d-platformer');
const hero = new OmniCore.Sprite('hero', { x: 80, y: 180, width: 32, height: 48 });
const platform = new OmniCore.Sprite('platform', { x: 0, y: 320, width: 640, height: 24, color: '#334155' });

scene.add(hero);
scene.add(platform);
scene.update = (delta = 1 / 60) => {
  velocity.y += gravity * delta;
  hero.y += velocity.y * delta;
  if (hero.y + hero.height >= platform.y) {
    hero.y = platform.y - hero.height;
    velocity.y = 0;
  }
};

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && velocity.y === 0) velocity.y = jumpVelocity;
});

game.scene.register(scene);
await game.scene.push('template-2d-platformer');
game.renderer.renderScene(scene);
