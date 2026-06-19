import OmniCore from 'omnicore';

const topDown = { speed: 160, input: { x: 0, y: 0 } };
const inventory = [{ id: 'potion', count: 2 }];
const tilemap = {
  width: 10,
  height: 6,
  tileWidth: 32,
  tileHeight: 32,
  layers: [{ name: 'ground', data: new Array(60).fill(1) }]
};
const dialogueTree = {
  start: {
    text: 'Welcome to OmniCore Village.',
    next: ['shop', 'quest']
  },
  shop: { text: 'Need supplies?', next: [] },
  quest: { text: 'The old road is blocked.', next: [] }
};

const game = await new OmniCore.Game({
  parent: '#game',
  width: 640,
  height: 400,
  renderer: 'canvas',
  autoStart: false
}).init();

const scene = new OmniCore.Scene('template-rpg');
for (let y = 0; y < tilemap.height; y += 1) {
  for (let x = 0; x < tilemap.width; x += 1) {
    scene.add(new OmniCore.Sprite('grass', { x: x * tilemap.tileWidth, y: y * tilemap.tileHeight, width: 32, height: 32, color: '#14532d' }));
  }
}
const hero = new OmniCore.Sprite('hero', { x: 280, y: 180, width: 32, height: 32, color: '#22c55e' });
const npc = new OmniCore.Sprite('npc', { x: 360, y: 180, width: 32, height: 32, color: '#facc15' });
scene.add(hero);
scene.add(npc);
scene.update = (delta = 1 / 60) => {
  hero.x += topDown.input.x * topDown.speed * delta;
  hero.y += topDown.input.y * topDown.speed * delta;
};

window.addEventListener('keydown', (event) => {
  topDown.input.x = Number(event.code === 'ArrowRight') - Number(event.code === 'ArrowLeft');
  topDown.input.y = Number(event.code === 'ArrowDown') - Number(event.code === 'ArrowUp');
});
window.addEventListener('keyup', () => {
  topDown.input.x = 0;
  topDown.input.y = 0;
});

game.store.set('template:rpg:inventory', inventory);
game.store.set('template:rpg:dialogueTree', dialogueTree);
game.store.set('template:rpg:tilemap', tilemap);
game.scene.register(scene);
await game.scene.push('template-rpg');
game.renderer.renderScene(scene);
