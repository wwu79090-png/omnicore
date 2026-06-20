/**
 * Small pooled particle runtime for translucent code layers and glow effects.
 */
export class ParticleSystem {
  constructor({
    maxParticles = 256,
    blendMode = 'source-over',
    rng = Math.random
  } = {}) {
    this.maxParticles = Math.max(1, Number(maxParticles) || 1);
    this.blendMode = blendMode;
    this.rng = rng;
    this.particles = Array.from({ length: this.maxParticles }, () => createParticle());
  }

  get activeCount() {
    return this.particles.filter((particle) => particle.active).length;
  }

  emit(count = 1, config = {}) {
    const emitted = [];
    for (let index = 0; index < count; index += 1) {
      const particle = this.particles.find((item) => !item.active);
      if (!particle) break;
      resetParticle(particle, config, this.rng);
      emitted.push(particle);
    }
    return emitted;
  }

  update(deltaSeconds = 0) {
    const delta = Math.max(0, Number(deltaSeconds) || 0);
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.age += delta;
      if (particle.age >= particle.lifetime) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
    }
    return this;
  }

  toRenderCommands() {
    return this.particles
      .filter((particle) => particle.active)
      .map((particle) => {
        const progress = particle.age / particle.lifetime;
        return {
          op: 'particle',
          x: particle.x,
          y: particle.y,
          radius: interpolate(particle.size[0], particle.size[1], progress) / 2,
          color: progress < 0.5 ? particle.color[0] : particle.color[1],
          alpha: Number((1 - progress).toFixed(6)),
          blendMode: particle.blendMode || this.blendMode
        };
      });
  }

  render(ctx) {
    if (!ctx) return { rendered: 0 };
    let rendered = 0;
    for (const command of this.toRenderCommands()) {
      ctx.save?.();
      ctx.globalAlpha = command.alpha;
      ctx.globalCompositeOperation = command.blendMode;
      ctx.fillStyle = command.color;
      ctx.beginPath?.();
      ctx.arc?.(command.x, command.y, command.radius, 0, Math.PI * 2);
      ctx.fill?.();
      ctx.restore?.();
      rendered += 1;
    }
    return { rendered };
  }
}

function createParticle() {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    lifetime: 1,
    size: [1, 1],
    color: ['#ffffff', '#ffffff'],
    blendMode: null
  };
}

function resetParticle(particle, config, rng) {
  const velocity = config.velocity || {};
  particle.active = true;
  particle.x = Number(config.x || 0);
  particle.y = Number(config.y || 0);
  particle.vx = rangeValue(velocity.x, rng);
  particle.vy = rangeValue(velocity.y, rng);
  particle.age = 0;
  particle.lifetime = Math.max(0.001, Number(config.lifetime || 1));
  particle.size = normalizeRange(config.size, 1);
  particle.color = Array.isArray(config.color) ? config.color : [config.color || '#ffffff', config.color || '#ffffff'];
  particle.blendMode = config.blendMode || null;
  return particle;
}

function rangeValue(value, rng) {
  if (Array.isArray(value)) return interpolate(Number(value[0] || 0), Number(value[1] || 0), rng());
  return Number(value || 0);
}

function normalizeRange(value, fallback) {
  if (Array.isArray(value)) return [Number(value[0] || fallback), Number(value[1] ?? value[0] ?? fallback)];
  const numeric = Number(value || fallback);
  return [numeric, numeric];
}

function interpolate(from, to, progress) {
  return from + (to - from) * Math.max(0, Math.min(1, progress));
}

export default ParticleSystem;
