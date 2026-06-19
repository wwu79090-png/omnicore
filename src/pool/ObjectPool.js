/**
 * Generic object pool for bullets, particles, temporary vectors, and UI nodes.
 *
 * @example
 * const bullets = new ObjectPool(() => new Sprite('bullet'), (bullet) => bullet.visible = false);
 * const bullet = bullets.acquire();
 * bullets.release(bullet);
 */
export class ObjectPool {
  constructor(create, reset = () => {}, { warm = 0 } = {}) {
    this.create = create;
    this.reset = reset;
    this.available = [];
    this.active = new Set();
    for (let index = 0; index < warm; index += 1) this.available.push(this.create());
  }

  acquire() {
    const item = this.available.pop() || this.create();
    this.active.add(item);
    return item;
  }

  release(item) {
    if (!this.active.has(item)) return;
    this.active.delete(item);
    this.reset(item);
    this.available.push(item);
  }

  clear() {
    this.available.length = 0;
    this.active.clear();
  }
}

export default ObjectPool;
