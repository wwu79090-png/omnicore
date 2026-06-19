import OmniCore from 'omnicore-runtime';

const dialogueTree = {
  start: { text: '欢迎来到 OmniCore 村庄。', next: ['quest'] },
  quest: { text: '去 2.5D 展示区寻找水晶。', next: [] }
};
const inventory = [{ id: 'potion', count: 2 }];
const topDown = { x: 0, y: 0, speed: 120 };

const game = await new OmniCore.Game({ parent: '#game', renderer: 'canvas', autoStart: false }).init();
const scene = new OmniCore.Scene('template-2d-rpg');
const hero = new OmniCore.Sprite('hero', { x: 240, y: 180, width: 32, height: 32 });

scene.add(hero);
scene.update = (delta = 1 / 60) => {
  hero.x += topDown.x * topDown.speed * delta;
  hero.y += topDown.y * topDown.speed * delta;
};

game.store.set('example:rpg:dialogueTree', dialogueTree);
game.store.set('example:rpg:inventory', inventory);
game.scene.register(scene);
await game.scene.push('template-2d-rpg');
game.renderer.renderScene(scene);
