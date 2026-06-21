import OmniCore from 'omnicore';

const game = await new OmniCore.Game({
  parent: '#game',
  width: 960,
  height: 540,
  renderer: 'canvas',
  roundPixels: true,
  debug: true
}).init();

const scene = new OmniCore.Scene('arcade-survivor');
const scoreEl = document.querySelector('#score');
const statusEl = document.querySelector('#status');
const player = new OmniCore.Sprite('player', { x: 460, y: 250, width: 36, height: 36, color: '#38bdf8' });
const core = new OmniCore.Sprite('core', { x: 180, y: 160, width: 24, height: 24, color: '#facc15' });
const enemies = [
  new OmniCore.Sprite('enemy-a', { x: 120, y: 90, width: 34, height: 34, color: '#ef4444' }),
  new OmniCore.Sprite('enemy-b', { x: 780, y: 390, width: 42, height: 42, color: '#fb7185' }),
  new OmniCore.Sprite('enemy-c', { x: 760, y: 110, width: 30, height: 30, color: '#f97316' })
];
const velocity = { x: 0, y: 0 };
let score = 0;
let ended = false;
let elapsed = 0;

scene.add(new OmniCore.Sprite('arena', { x: 24, y: 24, width: 912, height: 492, color: '#0f172a' }));
scene.add(core);
for (const enemy of enemies) scene.add(enemy);
scene.add(player);

scene.update = (delta = 1 / 60) => {
  if (game.input.keyboard.isDown('KeyR')) restartGame();
  if (ended) return;

  elapsed += delta;
  velocity.x = 0;
  velocity.y = 0;
  if (game.input.keyboard.isDown('ArrowLeft') || game.input.keyboard.isDown('KeyA')) velocity.x -= 1;
  if (game.input.keyboard.isDown('ArrowRight') || game.input.keyboard.isDown('KeyD')) velocity.x += 1;
  if (game.input.keyboard.isDown('ArrowUp') || game.input.keyboard.isDown('KeyW')) velocity.y -= 1;
  if (game.input.keyboard.isDown('ArrowDown') || game.input.keyboard.isDown('KeyS')) velocity.y += 1;

  const speed = 260;
  const length = Math.hypot(velocity.x, velocity.y) || 1;
  player.x = clamp(player.x + (velocity.x / length) * speed * delta, 36, 888);
  player.y = clamp(player.y + (velocity.y / length) * speed * delta, 36, 468);

  enemies.forEach((enemy, index) => {
    const angle = elapsed * (0.8 + index * 0.2) + index * 2.1;
    enemy.x += Math.cos(angle) * (80 + index * 24) * delta;
    enemy.y += Math.sin(angle * 1.3) * (70 + index * 18) * delta;
    enemy.x = clamp(enemy.x, 42, 886);
    enemy.y = clamp(enemy.y, 42, 466);
    if (overlaps(player, enemy)) endGame();
  });

  if (overlaps(player, core)) {
    score += 1;
    updateHud();
    moveCore();
    OmniCore.Tween.to(player, { width: 44, height: 44, duration: 80, yoyo: true, repeat: 1 }).start();
  }
};

function moveCore() {
  core.x = 72 + ((score * 173) % 780);
  core.y = 64 + ((score * 109) % 380);
}

function updateHud() {
  scoreEl.textContent = `Score ${score}`;
}

function endGame() {
  ended = true;
  statusEl.textContent = 'Hit! Press R to restart';
  player.color = '#94a3b8';
}

function restartGame() {
  score = 0;
  ended = false;
  elapsed = 0;
  player.x = 460;
  player.y = 250;
  player.color = '#38bdf8';
  statusEl.textContent = 'Survive and collect cores';
  updateHud();
  moveCore();
}

function overlaps(a, b) {
  return a.visible !== false && b.visible !== false
    && a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

game.scene.register(scene);
await game.scene.push('arcade-survivor');
restartGame();
