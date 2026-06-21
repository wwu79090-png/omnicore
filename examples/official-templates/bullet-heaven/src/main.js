import OmniCore from 'omnicore';

const game = await new OmniCore.Game({
  parent: '#game',
  width: 960,
  height: 540,
  renderer: 'canvas',
  debug: true
}).init();

const scene = new OmniCore.Scene('official-bullet-heaven');
const player = new OmniCore.Sprite('survivor', { x: 460, y: 250, width: 34, height: 34, color: '#38bdf8' });
const projectilePool = Array.from({ length: 40 }, (_, index) => new OmniCore.Sprite(`projectile-${index}`, {
  x: -100,
  y: -100,
  width: 10,
  height: 10,
  color: '#facc15',
  visible: false,
  active: false,
  vx: 0,
  vy: 0
}));
const enemies = [];
let spawnTimer = 0;
let shotTimer = 0;
let xp = 0;
let level = 1;

scene.add(player);
scene.add(...projectilePool);

scene.update = (delta = 1 / 60) => {
  movePlayer(delta);
  spawnTimer += delta;
  shotTimer += delta;
  if (spawnTimer > 1.2) {
    spawnTimer = 0;
    spawnEnemyWave(level + 2);
  }
  if (shotTimer > 0.18) {
    shotTimer = 0;
    fireProjectile();
  }
  updateEnemies(delta);
  updateProjectiles(delta);
};

function movePlayer(delta) {
  const speed = 260 * delta;
  if (game.input.keyboard.isDown('KeyA') || game.input.keyboard.isDown('ArrowLeft')) player.x -= speed;
  if (game.input.keyboard.isDown('KeyD') || game.input.keyboard.isDown('ArrowRight')) player.x += speed;
  if (game.input.keyboard.isDown('KeyW') || game.input.keyboard.isDown('ArrowUp')) player.y -= speed;
  if (game.input.keyboard.isDown('KeyS') || game.input.keyboard.isDown('ArrowDown')) player.y += speed;
}

function spawnEnemyWave(count = 3) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const enemy = new OmniCore.Sprite(`enemy-${Date.now()}-${index}`, {
      x: player.x + Math.cos(angle) * 420,
      y: player.y + Math.sin(angle) * 260,
      width: 28,
      height: 28,
      color: '#ef4444',
      hp: 2 + level
    });
    enemies.push(enemy);
    scene.add(enemy);
  }
}

function fireProjectile() {
  const projectile = projectilePool.find((item) => !item.active);
  if (!projectile) return;
  const target = enemies[0] || { x: player.x + 1, y: player.y };
  const length = Math.max(1, Math.hypot(target.x - player.x, target.y - player.y));
  projectile.x = player.x + player.width / 2;
  projectile.y = player.y + player.height / 2;
  projectile.vx = ((target.x - player.x) / length) * 540;
  projectile.vy = ((target.y - player.y) / length) * 540;
  projectile.active = true;
  projectile.visible = true;
}

function updateEnemies(delta) {
  for (const enemy of enemies) {
    if (enemy.visible === false) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    enemy.x += (dx / length) * 80 * delta;
    enemy.y += (dy / length) * 80 * delta;
  }
}

function updateProjectiles(delta) {
  for (const projectile of projectilePool) {
    if (!projectile.active) continue;
    projectile.x += projectile.vx * delta;
    projectile.y += projectile.vy * delta;
    const hit = enemies.find((enemy) => enemy.visible !== false && overlaps(projectile, enemy));
    if (hit) {
      hit.hp -= 1;
      recycle(projectile);
      if (hit.hp <= 0) defeatEnemy(hit);
    } else if (projectile.x < -40 || projectile.x > 1000 || projectile.y < -40 || projectile.y > 580) {
      recycle(projectile);
    }
  }
}

function defeatEnemy(enemy) {
  enemy.visible = false;
  xp += 1;
  if (xp >= level * 4) levelUp();
}

function levelUp() {
  xp = 0;
  level += 1;
  player.color = level % 2 === 0 ? '#22c55e' : '#38bdf8';
  console.log(`levelUp -> ${level}`);
}

function recycle(projectile) {
  projectile.active = false;
  projectile.visible = false;
  projectile.x = -100;
  projectile.y = -100;
}

function overlaps(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

game.scene.register(scene);
await game.scene.push('official-bullet-heaven');
