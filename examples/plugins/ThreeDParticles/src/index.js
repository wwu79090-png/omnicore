export default {
  name: 'ThreeDParticles',
  version: '1.0.0',
  install({ game, scene = game?.scene?.current, clock = globalThis.performance } = {}) {
    const particles = [];
    const start = clock?.now?.() || 0;
    const unsubscribe = game?.loop?.subscribe?.((delta = 1 / 60) => {
      updateParticles(particles, delta);
    });
    return {
      spawnBurst3D(options = {}) {
        const created = spawnBurst3D(scene, particles, options);
        return created;
      },
      update(delta = 1 / 60) {
        updateParticles(particles, delta);
        return particles;
      },
      snapshot() {
        return {
          ageMs: (clock?.now?.() || start) - start,
          count: particles.length,
          particles: particles.map((particle) => ({ ...particle }))
        };
      },
      destroy() {
        unsubscribe?.();
        particles.length = 0;
      }
    };
  }
};

export function spawnBurst3D(scene, particles, {
  x = 0,
  y = 0,
  z = 0,
  count = 24,
  speed = 80,
  gravity = 16,
  texture = 'spark'
} = {}) {
  const created = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / Math.max(1, count);
    const depth = (index % 6) / 6;
    const particle = {
      type: 'particle3d',
      texture,
      x,
      y,
      z: z + depth,
      vx: Math.cos(angle) * speed * (0.45 + depth),
      vy: Math.sin(angle) * speed * (0.45 + depth),
      vz: 12 + depth * 18,
      gravity,
      life: 1,
      alpha: 1,
      scale: 1 + depth * 0.35
    };
    particles.push(particle);
    created.push(particle);
    scene?.add?.(particle);
  }
  return created;
}

function updateParticles(particles, delta) {
  for (const particle of particles) {
    particle.vz -= particle.gravity * delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta - particle.vz * delta;
    particle.z += particle.vz * delta;
    particle.life -= delta * 0.85;
    particle.alpha = Math.max(0, particle.life);
    particle.scale = Math.max(0.1, particle.scale * (1 - delta * 0.2));
  }
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    if (particles[index].life <= 0) particles.splice(index, 1);
  }
}
