import OmniCore from 'omnicore';

const Tiled = {
  width: 8,
  height: 6,
  tilewidth: 32,
  tileheight: 32,
  layers: [
    { name: 'Ground', type: 'tilelayer', width: 8, height: 6, data: new Array(48).fill(1) },
    { name: 'Collisions', type: 'objectgroup', objects: [{ id: 1, x: 64, y: 96, width: 128, height: 32 }] }
  ],
  tilesets: [{ firstgid: 1, name: 'terrain', image: 'terrain.png' }]
};
const collision = Tiled.layers[1].objects;
const parallax = [{ texture: 'far-hills', factor: 0.35 }, { texture: 'trees', factor: 0.7 }];

const game = await new OmniCore.Game({
  parent: '#game',
  width: 640,
  height: 400,
  renderer: 'canvas',
  autoStart: false
}).init();

const tilemap = OmniCore.Tilemap.parse(Tiled);
const scene = new OmniCore.Scene('template-tilemap');
parallax.forEach((layer, index) => {
  scene.add(new OmniCore.Sprite(layer.texture, { x: index * 32, y: 40 + index * 32, width: 640, height: 80, alpha: layer.factor }));
});
collision.forEach((object) => {
  scene.add(new OmniCore.Sprite('collision', { ...object, color: '#ef4444', alpha: 0.4 }));
});

game.store.set('template:tilemap', tilemap);
game.scene.register(scene);
await game.scene.push('template-tilemap');
game.renderer.renderScene(scene);
