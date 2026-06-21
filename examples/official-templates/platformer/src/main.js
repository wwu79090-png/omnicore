import OmniCore from 'omnicore';

const game = await new OmniCore.Game({
  parent: '#game',
  width: 960,
  height: 540,
  renderer: 'canvas',
  roundPixels: true,
  debug: true
}).init();

const scene = new OmniCore.Scene('official-platformer');
const gravity = 1700;
const moveSpeed = 280;
const jumpVelocity = -720;
const velocity = { x: 0, y: 0 };
const platforms = [
  { x: 0, y: 492, width: 960, height: 48 },
  { x: 184, y: 392, width: 192, height: 24 },
  { x: 536, y: 310, width: 220, height: 24 }
];
const collectible = new OmniCore.Sprite('collectible', { x: 620, y: 260, width: 28, height: 28, color: '#facc15' });
const player = new OmniCore.Sprite('hero', { x: 80, y: 420, width: 36, height: 52, color: '#38bdf8' });
const enemy = new OmniCore.Sprite('enemy', { x: 720, y: 456, width: 36, height: 36, color: '#ef4444' });
let enemyDirection = -1;
let collected = 0;

for (const platform of platforms) {
  scene.add(new OmniCore.Sprite('platform', { ...platform, color: '#334155' }));
}
scene.add(collectible);
scene.add(player);
scene.add(enemy);

scene.update = (delta = 1 / 60) => {
  velocity.x = 0;
  if (game.input.keyboard.isDown('ArrowLeft') || game.input.keyboard.isDown('KeyA')) velocity.x = -moveSpeed;
  if (game.input.keyboard.isDown('ArrowRight') || game.input.keyboard.isDown('KeyD')) velocity.x = moveSpeed;
  if ((game.input.keyboard.isDown('Space') || game.input.keyboard.isDown('ArrowUp')) && isOnGround(player, platforms)) {
    velocity.y = jumpVelocity;
  }

  velocity.y += gravity * delta;
  player.x += velocity.x * delta;
  player.y += velocity.y * delta;
  collideWithPlatforms(player, platforms, velocity);

  enemy.x += enemyDirection * 90 * delta;
  if (enemy.x < 640 || enemy.x > 820) enemyDirection *= -1;
  if (overlaps(player, enemy)) resetPlayer();
  if (collectible.visible !== false && overlaps(player, collectible)) {
    collected += 1;
    collectible.visible = false;
    console.log(`collectible picked: ${collected}`);
  }
};

function collideWithPlatforms(body, solidPlatforms, bodyVelocity) {
  for (const platform of solidPlatforms) {
    const fromAbove = body.y + body.height >= platform.y && body.y + body.height <= platform.y + platform.height + 20;
    const insideX = body.x + body.width > platform.x && body.x < platform.x + platform.width;
    if (insideX && fromAbove && bodyVelocity.y >= 0) {
      body.y = platform.y - body.height;
      bodyVelocity.y = 0;
    }
  }
}

function isOnGround(body, solidPlatforms) {
  return solidPlatforms.some((platform) => (
    Math.abs((body.y + body.height) - platform.y) < 2
    && body.x + body.width > platform.x
    && body.x < platform.x + platform.width
  ));
}

function overlaps(a, b) {
  return a.visible !== false && b.visible !== false
    && a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function resetPlayer() {
  player.x = 80;
  player.y = 420;
  velocity.x = 0;
  velocity.y = 0;
}

game.scene.register(scene);
await game.scene.push('official-platformer');
