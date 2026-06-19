import OmniCore from '../../src/index.js';

const game = await new OmniCore.Game({
  parent: '#game',
  width: 640,
  height: 360,
  renderer: 'canvas',
  debug: true,
  feedback: true
}).init();

const scene = new OmniCore.Scene('rpg-demo');
const hud = document.querySelector('#hud');

for (let y = 0; y < 360; y += 32) {
  for (let x = 0; x < 640; x += 32) {
    scene.add(new OmniCore.Sprite('grass', { x, y, width: 30, height: 30, alpha: 0.28, zIndex: 0 }));
  }
}

const crates = [
  scene.add(new OmniCore.Sprite('crate', { x: 220, y: 130, width: 42, height: 42, zIndex: 2 })),
  scene.add(new OmniCore.Sprite('crate', { x: 300, y: 190, width: 42, height: 42, zIndex: 2 }))
];
const npc = scene.add(new OmniCore.Sprite('npc', { x: 440, y: 120, width: 40, height: 52, zIndex: 3 }));
const player = scene.add(new OmniCore.Sprite('player', { x: 80, y: 140, width: 36, height: 44, zIndex: 4 }));

let dialogue = '方向键移动，靠近 NPC 按空格交互。';
let spaceLatch = false;

scene.update = (delta) => {
  const next = { x: player.x, y: player.y };
  const speed = 130 * delta;
  if (game.input.keyboard.isDown('ArrowLeft') || game.input.keyboard.isDown('KeyA')) next.x -= speed;
  if (game.input.keyboard.isDown('ArrowRight') || game.input.keyboard.isDown('KeyD')) next.x += speed;
  if (game.input.keyboard.isDown('ArrowUp') || game.input.keyboard.isDown('KeyW')) next.y -= speed;
  if (game.input.keyboard.isDown('ArrowDown') || game.input.keyboard.isDown('KeyS')) next.y += speed;

  const blocked = crates.some((crate) => intersects({ ...player, ...next }, crate));
  if (!blocked) {
    player.x = clamp(next.x, 0, 604);
    player.y = clamp(next.y, 0, 316);
  }

  const nearNpc = distance(player, npc) < 72;
  const spaceDown = game.input.keyboard.isDown('Space');
  if (nearNpc && spaceDown && !spaceLatch) {
    dialogue = 'NPC：OmniCore 支持 Scene、Sprite、输入、Store 与可选调试工具。';
  }
  spaceLatch = spaceDown;
  hud.textContent = nearNpc ? `${dialogue}（按空格）` : dialogue;
};

game.scene.register(scene);
await game.scene.push('rpg-demo');

function intersects(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
