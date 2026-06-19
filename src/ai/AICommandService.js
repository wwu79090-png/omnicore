import { Sprite } from '../scene/Scene.js';

export class AICommandService {
  async generateCommand(prompt) {
    const speedMatch = String(prompt).match(/速度\s*(\d+(?:\.\d+)?)/u);
    return {
      prompt,
      entities: [{
        id: 'player',
        type: 'sprite',
        texture: 'player',
        controls: /WASD/i.test(prompt) ? 'wasd' : null,
        speed: speedMatch ? Number(speedMatch[1]) : 4,
        x: 0,
        y: 0
      }]
    };
  }

  async generateAndInject(prompt, game) {
    const command = await this.generateCommand(prompt);
    return this.inject(command, game);
  }

  inject(command, game) {
    const scene = game?.scene?.current;
    const created = (command.entities || []).map((entity) => createEntity(entity, game));
    for (const entity of created) scene?.add?.(entity);
    game?.store?.set?.('ai:lastCommand', command);
    if (scene) game?.renderer?.renderScene?.(scene);
    return created;
  }
}

function createEntity(entity, game) {
  const sprite = new Sprite(entity.texture || entity.id, entity);
  sprite.id = entity.id;
  sprite.controls = entity.controls;
  sprite.speed = entity.speed || 0;
  const baseUpdate = sprite.update.bind(sprite);
  sprite.update = (delta, time) => {
    baseUpdate(delta, time);
    if (sprite.controls !== 'wasd') return;
    const keyboard = game?.input?.keyboard;
    if (keyboard?.isDown?.('KeyD')) sprite.x += sprite.speed;
    if (keyboard?.isDown?.('KeyA')) sprite.x -= sprite.speed;
    if (keyboard?.isDown?.('KeyW')) sprite.y -= sprite.speed;
    if (keyboard?.isDown?.('KeyS')) sprite.y += sprite.speed;
  };
  return sprite;
}

export default AICommandService;
