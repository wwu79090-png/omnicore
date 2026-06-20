import OmniCore from '../../src/index.js';

const width = 960;
const height = 540;
const status = document.querySelector('#status');
const touchState = { left: false, right: false };

const game = await new OmniCore.Game({
  parent: '#game',
  width,
  height,
  renderer: 'canvas',
  autoStart: true,
  autoAttach: true
}).init();

const scene = new OmniCore.Scene('full-game-demo');
const player = new OmniCore.Sprite('player', { x: 460, y: 462, width: 42, height: 42, zIndex: 10 });
const energy = new OmniCore.Sprite('energy', { x: 180, y: -40, width: 28, height: 28, zIndex: 6 });
const glitch = new OmniCore.Sprite('glitch', { x: 720, y: -160, width: 34, height: 34, zIndex: 7 });
const background = new OmniCore.Sprite('arena', { x: 0, y: 0, width, height, alpha: 0.2, zIndex: 0 });

let score = 0;
let speed = 190;
let gameOver = false;

scene.add(background);
scene.add(energy);
scene.add(glitch);
scene.add(player);

scene.update = (delta) => {
  if (gameOver) return;
  updatePlayer(delta);
  updateFalling(energy, delta, 150 + score * 4, 'energy');
  updateFalling(glitch, delta, 210 + score * 5, 'glitch');

  if (intersects(player, energy)) {
    score += 1;
    speed += 7;
    resetFalling(energy, 'energy');
  }
  if (intersects(player, glitch)) {
    gameOver = true;
    status.textContent = `Game Over. score: ${score}. Press Restart.`;
  } else {
    status.textContent = `score: ${score} | A/D or Arrow keys.`;
  }
};

game.scene.register(scene);
await game.scene.push('full-game-demo');

document.querySelector('#restart').addEventListener('click', restartGame);
for (const button of document.querySelectorAll('[data-move]')) {
  const direction = button.dataset.move;
  button.addEventListener('pointerdown', () => { touchState[direction] = true; });
  button.addEventListener('pointerup', () => { touchState[direction] = false; });
  button.addEventListener('pointerleave', () => { touchState[direction] = false; });
}

function updatePlayer(delta) {
  const keyboard = game.input.keyboard;
  const left = keyboard.isDown('ArrowLeft') || keyboard.isDown('KeyA') || touchState.left;
  const right = keyboard.isDown('ArrowRight') || keyboard.isDown('KeyD') || touchState.right;
  if (left) player.x -= speed * delta;
  if (right) player.x += speed * delta;
  player.x = clamp(player.x, 0, width - player.width);
}

function updateFalling(sprite, delta, fallSpeed, kind) {
  sprite.y += fallSpeed * delta;
  if (sprite.y > height + 48) resetFalling(sprite, kind);
}

function resetFalling(sprite, kind) {
  const lane = kind === 'energy' ? 97 : 151;
  sprite.x = ((score + 3) * lane) % (width - 72) + 24;
  sprite.y = kind === 'energy' ? -36 : -120;
}

function restartGame() {
  score = 0;
  speed = 190;
  gameOver = false;
  player.x = 460;
  resetFalling(energy, 'energy');
  resetFalling(glitch, 'glitch');
  status.textContent = 'score: 0 | A/D or Arrow keys.';
}

function intersects(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
