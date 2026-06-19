export default {
  name: 'ParticlePack',
  version: '1.0.0',
  install({ game, scene = game?.scene?.current } = {}) {
    const particles = [];
    const unsubscribe = game?.loop?.subscribe?.((delta) => {
      for (const particle of particles) {
        particle.life -= delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.alpha = Math.max(0, particle.life);
      }
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        if (particles[index].life <= 0) particles.splice(index, 1);
      }
    });
    return {
      burst({ x = 0, y = 0, count = 12 } = {}) {
        for (let index = 0; index < count; index += 1) {
          const particle = { x, y, vx: Math.cos(index) * 80, vy: Math.sin(index) * 80, life: 1, alpha: 1 };
          particles.push(particle);
          scene?.add?.(particle);
        }
        return particles;
      },
      destroy() {
        unsubscribe?.();
        particles.length = 0;
      }
    };
  }
};
