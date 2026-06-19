export default {
  name: 'auto-move',
  version: '1.0.0',
  install({ game, target, speed = 48, bounds = { minX: 16, maxX: 420 } }) {
    let direction = 1;
    const unsubscribe = game.loop.subscribe((delta) => {
      if (!target) return;
      target.x += speed * direction * delta;
      if (target.x > bounds.maxX || target.x < bounds.minX) direction *= -1;
    });
    return {
      destroy() {
        unsubscribe?.();
      }
    };
  }
};
