import OmniCore from 'omnicore';

const gravity = 1600;
const jump = -620;
const platform = { x: 0, y: 360, width: 640, height: 32 };
const velocity = { x: 0, y: 0 };
let enemyDirection = -1;

const game = await new OmniCore.Game({
  parent: '#game',
  width: 640,
  height: 400,
  renderer: 'canvas',
  autoStart: false
}).init();

const scene = new OmniCore.Scene('template-platformer');
const player = new OmniCore.Sprite('hero', { x: 80, y: 260, width: 32, height: 48, color: '#38bdf8' });
const ground = new OmniCore.Sprite('platform', { ...platform, color: '#334155', label: false });
const enemy = new OmniCore.Sprite('enemy', { x: 340, y: 328, width: 32, height: 32, color: '#ef4444' });

scene.add(player);
scene.add(ground);
scene.add(enemy);
scene.update = (delta = 1 / 60) => {
  velocity.y += gravity * delta;
  player.y += velocity.y * delta;
  if (player.y + player.height >= platform.y) {
    player.y = platform.y - player.height;
    velocity.y = 0;
  }
  enemy.x += enemyDirection * 80 * delta;
  if (enemy.x < 240 || enemy.x > 420) enemyDirection *= -1;
  const hitEnemy = Math.abs(player.x - enemy.x) < 30 && Math.abs(player.y - enemy.y) < 40;
  if (hitEnemy) {
    player.x = 80;
    player.y = 260;
    velocity.y = 0;
  }
};

window.addEventListener('keydown', (event) => {
  if ((event.code === 'Space' || event.code === 'ArrowUp') && velocity.y === 0) velocity.y = jump;
});

game.scene.register(scene);
await game.scene.push('template-platformer');
game.renderer.renderScene(scene);
