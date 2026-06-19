const Components = Object.freeze({
  Position: Object.freeze({
    name: 'Position',
    fields: Object.freeze({ x: 'f32', y: 'f32' })
  }),
  Velocity: Object.freeze({
    name: 'Velocity',
    fields: Object.freeze({ x: 'f32', y: 'f32' })
  }),
  Health: Object.freeze({
    name: 'Health',
    fields: Object.freeze({ current: 'f32', max: 'f32' })
  }),
  SpriteRef: Object.freeze({
    name: 'SpriteRef',
    fields: Object.freeze({
      texture: 'ref',
      zIndex: 'i32',
      color: 'u32',
      alpha: 'f32'
    })
  })
});

export function MovementSystem(world, delta) {
  const positions = world.storage('Position');
  const velocities = world.storage('Velocity');
  const positionX = positions.fields.x;
  const positionY = positions.fields.y;
  const velocityX = velocities.fields.x;
  const velocityY = velocities.fields.y;

  for (let index = 0; index < positions.length; index += 1) {
    const entityId = positions.entityIds[index];
    const velocityIndex = velocities.indexOf(entityId);
    if (velocityIndex < 0) continue;
    positionX[index] += velocityX[velocityIndex] * delta;
    positionY[index] += velocityY[velocityIndex] * delta;
  }
}

export function RenderSystem(adapter) {
  return function renderSystem(world) {
    const positions = world.storage('Position');
    const sprites = world.storage('SpriteRef');
    for (let index = 0; index < sprites.length; index += 1) {
      const entityId = sprites.entityIds[index];
      const positionIndex = positions.indexOf(entityId);
      if (positionIndex < 0) continue;
      adapter.drawSprite({
        entityId,
        texture: sprites.fields.texture[index],
        x: positions.fields.x[positionIndex],
        y: positions.fields.y[positionIndex],
        zIndex: sprites.fields.zIndex[index],
        color: sprites.fields.color[index] || 0xffffff,
        alpha: sprites.fields.alpha[index] || 1
      });
    }
  };
}

export { Components };
