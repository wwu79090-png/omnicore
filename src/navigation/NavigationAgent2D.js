export class NavigationAgent2D {
  constructor({ navmesh = null, position = { x: 0, y: 0 }, speed = 64 } = {}) {
    this.navmesh = navmesh;
    this.position = { x: Number(position.x || 0), y: Number(position.y || 0) };
    this.speed = Math.max(0, Number(speed || 0));
    this.target = null;
    this.path = [];
    this.pathIndex = 0;
    this.finished = true;
  }

  setTarget(target = {}) {
    this.target = { x: Number(target.x || 0), y: Number(target.y || 0) };
    if (!this.navmesh) {
      this.path = [];
      this.finished = true;
      return this;
    }
    const start = this.navmesh.worldToCell(this.position);
    const goal = this.navmesh.worldToCell(this.target);
    this.path = this.navmesh.findPath(start, goal);
    this.pathIndex = 0;
    this.finished = this.path.length === 0;
    return this;
  }

  update(delta = 1) {
    if (!this.navmesh || this.finished || this.path.length === 0) {
      return { position: this.position, finished: this.finished, path: this.path };
    }
    let remaining = Math.max(0, Number(delta || 0)) * this.speed;
    while (remaining > 0 && !this.finished) {
      const waypoint = this.navmesh.cellToWorld(this.path[this.pathIndex]);
      const dx = waypoint.x - this.position.x;
      const dy = waypoint.y - this.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0.0001) {
        this.pathIndex += 1;
        if (this.pathIndex >= this.path.length) this.finished = true;
        continue;
      }
      const step = Math.min(distance, remaining);
      this.position.x += (dx / distance) * step;
      this.position.y += (dy / distance) * step;
      remaining -= step;
      if (step >= distance) {
        this.pathIndex += 1;
        if (this.pathIndex >= this.path.length) this.finished = true;
      }
    }
    return { position: this.position, finished: this.finished, path: this.path };
  }

  get desiredVelocity() {
    if (!this.navmesh || this.finished || !this.path[this.pathIndex]) return { x: 0, y: 0 };
    const waypoint = this.navmesh.cellToWorld(this.path[this.pathIndex]);
    const dx = waypoint.x - this.position.x;
    const dy = waypoint.y - this.position.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return { x: 0, y: 0 };
    return {
      x: (dx / distance) * this.speed,
      y: (dy / distance) * this.speed
    };
  }
}

export default NavigationAgent2D;
