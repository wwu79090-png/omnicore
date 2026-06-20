export class ParticleTerrainCollider25D {
  constructor({
    width = 1,
    height = 1,
    cellSize = 32,
    heights = [],
    restitution = 0.4,
    friction = 0.85,
    gravity = 0
  } = {}) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.cellSize = Math.max(1, Number(cellSize) || 32);
    this.heights = heights;
    this.restitution = Math.max(0, Number(restitution) || 0);
    this.friction = Math.max(0, Math.min(1, Number(friction)));
    this.gravity = Number(gravity || 0);
  }

  step(particles = [], delta = 1 / 60) {
    const dt = Math.max(0, Number(delta || 0));
    return particles.map((particle) => this.stepParticle(particle, dt));
  }

  stepParticle(particle, delta = 1 / 60) {
    const next = { ...particle };
    next.vz = Number(next.vz || 0) - this.gravity * delta;
    next.x = Number(next.x || 0) + Number(next.vx || 0) * delta;
    next.y = Number(next.y || 0) + Number(next.vy || 0) * delta;
    next.z = Number(next.z || 0) + next.vz * delta;
    const terrainZ = this.sampleHeight(next.x, next.y);
    if (next.z <= terrainZ) {
      next.z = terrainZ;
      next.vz = Math.abs(next.vz) * this.restitution;
      next.vx = Number(next.vx || 0) * this.friction;
      next.vy = Number(next.vy || 0) * this.friction;
      next.collided = true;
      next.sliding = Math.abs(next.vx) + Math.abs(next.vy) > 0.001;
    } else {
      next.collided = false;
      next.sliding = false;
    }
    return next;
  }

  sampleHeight(x, y) {
    const cellX = clamp(Math.floor(Number(x || 0) / this.cellSize), 0, this.width - 1);
    const cellY = clamp(Math.floor(Number(y || 0) / this.cellSize), 0, this.height - 1);
    return Number(this.heights[cellY * this.width + cellX] ?? 0);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default ParticleTerrainCollider25D;
