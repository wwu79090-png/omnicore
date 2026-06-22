import OmniCore from 'omnicore';

const game = await new OmniCore.Game({
  parent: '#game',
  width: 960,
  height: 540,
  renderer: 'canvas',
  debug: true
}).init();

const scene = new OmniCore.Scene('official-rpg-dialogue');
const dialogueBox = document.querySelector('#dialogue');
const dialogueState = {
  active: false,
  line: 0,
  lines: [
    'Engineer: Welcome to the OmniCore lab.',
    'Engineer: The blue shard unlocks the north gate.',
    'Engineer: Keep the UI in HTML when text must stay crisp.'
  ]
};
const inventory = new Set();
const player = new OmniCore.Sprite('player', { x: 120, y: 360, width: 36, height: 48, color: '#38bdf8' });
const npc = new OmniCore.Sprite('npc-engineer', { x: 520, y: 318, width: 40, height: 56, color: '#a78bfa' });
const shard = new OmniCore.Sprite('blue-shard', { x: 360, y: 350, width: 26, height: 26, color: '#22d3ee' });
const walls = [
  new OmniCore.Sprite('wall', { x: 0, y: 492, width: 960, height: 48, color: '#334155' }),
  new OmniCore.Sprite('counter', { x: 650, y: 380, width: 160, height: 36, color: '#475569' })
];

scene.add(...walls);
scene.add(shard);
scene.add(npc);
scene.add(player);

scene.update = (delta = 1 / 60) => {
  const speed = 210 * delta;
  if (!dialogueState.active) {
    if (game.input.keyboard.isDown('KeyA') || game.input.keyboard.isDown('ArrowLeft')) player.x -= speed;
    if (game.input.keyboard.isDown('KeyD') || game.input.keyboard.isDown('ArrowRight')) player.x += speed;
    if (game.input.keyboard.isDown('KeyW') || game.input.keyboard.isDown('ArrowUp')) player.y -= speed;
    if (game.input.keyboard.isDown('KeyS') || game.input.keyboard.isDown('ArrowDown')) player.y += speed;
  }
  if (shard.visible !== false && overlaps(player, shard)) {
    shard.visible = false;
    inventory.add('blue-shard');
    renderDialogue('Inventory: blue-shard collected. Press E near the engineer.');
  }
};

window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyE') return;
  if (distance(player, npc) > 110) return;
  dialogueState.active = true;
  renderDialogue(dialogueState.lines[dialogueState.line]);
  dialogueState.line = (dialogueState.line + 1) % dialogueState.lines.length;
});

function renderDialogue(text) {
  dialogueBox.textContent = `${text} ${inventory.has('blue-shard') ? '[Shard ready]' : '[No shard]'}`;
}

function distance(a, b) {
  return Math.hypot((a.x + a.width / 2) - (b.x + b.width / 2), (a.y + a.height / 2) - (b.y + b.height / 2));
}

function overlaps(a, b) {
  return a.visible !== false && b.visible !== false
    && a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

game.scene.register(scene);
await game.scene.push('official-rpg-dialogue');
