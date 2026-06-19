/**
 * 2D vector helper for positions, velocities, and offsets.
 *
 * @example
 * const velocity = new Vec2(3, 4).normalize().scale(120);
 * sprite.x += velocity.x * dt;
 */
export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vec2(this.x, this.y);
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  add(other) {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  subtract(other) {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  scale(value) {
    this.x *= value;
    this.y *= value;
    return this;
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  normalize() {
    const length = this.length();
    if (length > 0) this.scale(1 / length);
    return this;
  }

  distanceTo(other) {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }

  static from(value) {
    if (value instanceof Vec2) return value.clone();
    return new Vec2(value?.x || 0, value?.y || 0);
  }
}

export default Vec2;
