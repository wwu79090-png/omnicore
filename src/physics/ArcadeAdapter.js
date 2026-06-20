/**
 * Phaser Arcade Physics style contact adapter with AABB checks.
 */
export class ArcadeAdapter {
  constructor() {
    this.colliders = [];
    this.overlaps = [];
  }

  addCollider(left, right, callback = null, process = null) {
    return this._add(this.colliders, 'collider', left, right, callback, process);
  }

  addOverlap(left, right, callback = null, process = null) {
    return this._add(this.overlaps, 'overlap', left, right, callback, process);
  }

  step() {
    const collisions = this._run(this.colliders);
    const overlaps = this._run(this.overlaps);
    return { collisions, overlaps };
  }

  _add(list, type, left, right, callback, process) {
    const entry = {
      type,
      left,
      right,
      callback,
      process,
      active: true,
      destroy() {
        entry.active = false;
      }
    };
    list.push(entry);
    return entry;
  }

  _run(list) {
    const contacts = [];
    for (const entry of list) {
      if (!entry.active) continue;
      for (const left of normalizeBodies(entry.left)) {
        for (const right of normalizeBodies(entry.right)) {
          if (!intersects(left, right)) continue;
          if (entry.process && entry.process(left, right) === false) continue;
          const contact = { type: entry.type, left, right };
          contacts.push(contact);
          entry.callback?.(left, right, contact);
        }
      }
    }
    return contacts;
  }
}

function normalizeBodies(value) {
  if (Array.isArray(value)) return value;
  if (value?.children && Array.isArray(value.children)) return value.children;
  return value ? [value] : [];
}

function bounds(body = {}) {
  return {
    x: Number(body.x || 0),
    y: Number(body.y || 0),
    width: Number(body.width || body.w || 0),
    height: Number(body.height || body.h || 0)
  };
}

function intersects(left, right) {
  const a = bounds(left);
  const b = bounds(right);
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

export default ArcadeAdapter;
