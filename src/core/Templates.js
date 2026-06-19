import { createOmniError } from './OmniError.js';

const TEMPLATE_FACTORIES = {
  topdown_player: () => `// OmniCore topdown_player template
// WASD: W/A/S/D or Arrow keys move the Player entity.
export class Player extends OmniCore.Sprite {
  constructor({ x = 100, y = 100, speed = 140, texture = 'player' } = {}) {
    super(texture, { x, y, width: 32, height: 32, zIndex: 10 });
    this.speed = speed;
  }

  update(delta, _time, game) {
    const input = game.input?.keyboard;
    const left = input?.isDown('KeyA') || input?.isDown('ArrowLeft');
    const right = input?.isDown('KeyD') || input?.isDown('ArrowRight');
    const up = input?.isDown('KeyW') || input?.isDown('ArrowUp');
    const down = input?.isDown('KeyS') || input?.isDown('ArrowDown');
    const axisX = Number(Boolean(right)) - Number(Boolean(left));
    const axisY = Number(Boolean(down)) - Number(Boolean(up));
    this.x += axisX * this.speed * delta;
    this.y += axisY * this.speed * delta;
    game.store.set('player.position', { x: this.x, y: this.y });
  }
}

export function installTopdownPlayer(game) {
  const player = new Player();
  game.scene.current.add(player);
  const unsubscribe = game.store.subscribe('player.position', (position) => {
    game.events?.emit?.('debug:player-position', position);
  });
  return { player, unsubscribe };
}
`,
  '3d-physics': () => `// 3D Decor + Physics production template.
// 使用方式：
// 1) 先在页面提供 #app、#background；
// 2) 可按需提供 Matter.js CDN 或本地 loader。

import OmniCore from 'omnicore';
import { createLeanRuntime } from 'omnicore/lean';

const game = await new OmniCore.Game({
  parent: '#app',
  width: 960,
  height: 540,
  renderer: 'pixi',
  debug: true,
  dimension3D: {
    backend: 'three',
    parent: '#background',
    decorativeModel: {
      url: '/models/demo-scene.glb',
      position: { x: 0, y: -1, z: -6 },
      scale: 1.25,
      rotationSpeed: { y: 0.1 }
    }
  }
}).init();

const runtime = await createLeanRuntime({
  debug: false,
  renderer: { backend: 'canvas', parent: '#app' }
});

const physics = runtime.addons.physics;
await physics.loadExternal(async () => {
  const { Matter } = await import('https://cdn.jsdelivr.net/npm/matter-js@0.20.1/build/matter.min.js');
  return Matter || (await import('https://cdn.jsdelivr.net/npm/matter-js@0.20.1/build/matter.min.mjs'));
});
physics.mount();

class ProductionScene extends OmniCore.Scene {
  create() {
    this.player = this.add(new OmniCore.Sprite('player', {
      x: 120,
      y: 120,
      width: 32,
      height: 48,
      zIndex: 10
    }));
    physics.attachBody(this.player, {
      body: { type: 'dynamic', category: 'player', mask: 'world' },
      width: 32,
      height: 48,
      x: this.player.x,
      y: this.player.y,
      shape: { type: 'rectangle', width: 32, height: 48 }
    });

    this.floor = this.add(new OmniCore.Sprite('ground', {
      x: 120,
      y: 420,
      width: 640,
      height: 48,
      zIndex: 1
    }));
    physics.attachBody(this.floor, {
      body: { type: 'static', category: 'world', mask: 'player' },
      x: this.floor.x,
      y: this.floor.y,
      width: this.floor.width,
      height: this.floor.height,
      shape: { type: 'rectangle', width: this.floor.width, height: this.floor.height }
    });
  }

  update(delta) {
    if (this.input.keyboard.isDown('KeyA')) this.player.x -= 80 * delta;
    if (this.input.keyboard.isDown('KeyD')) this.player.x += 80 * delta;
  }
}

game.scene.register(new ProductionScene('production'));
game.scene.push('production');
`
};

class TemplateGenerator {
  generate(name, options = {}) {
    const factory = TEMPLATE_FACTORIES[name];
    if (!factory) throw createOmniError('Templates', `未知模板：${name}`);
    return factory(options);
  }

  list() {
    return Object.keys(TEMPLATE_FACTORIES);
  }
}

const Templates = new TemplateGenerator();

export { TemplateGenerator, Templates };
export default Templates;
