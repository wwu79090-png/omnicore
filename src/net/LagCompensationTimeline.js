export class LagCompensationTimeline {
  constructor({ historyMs = 1000 } = {}) {
    this.historyMs = Math.max(0, Number(historyMs) || 1000);
    this.entities = new Map();
  }

  record({ timeMs = 0, entity = '', hitbox = {} } = {}) {
    const id = String(entity);
    if (!this.entities.has(id)) this.entities.set(id, []);
    const records = this.entities.get(id);
    records.push({ timeMs: Number(timeMs) || 0, hitbox: normalizeHitbox(hitbox) });
    records.sort((a, b) => a.timeMs - b.timeMs);
    this._prune(records, Number(timeMs) || 0);
    return this;
  }

  rewind(timeMs, { entities = [] } = {}) {
    const ids = entities.length ? entities.map(String) : [...this.entities.keys()].sort();
    return {
      timeMs: Number(timeMs) || 0,
      entities: Object.fromEntries(ids
        .map((id) => [id, this._sample(id, Number(timeMs) || 0)])
        .filter(([, hitbox]) => hitbox !== null))
    };
  }

  validateHit({ timeMs = 0, entity = '', point = {} } = {}) {
    const id = String(entity);
    const rewind = this.rewind(timeMs, { entities: [id] });
    const hitbox = rewind.entities[id] || null;
    return {
      entity: id,
      hit: Boolean(hitbox && pointInHitbox(point, hitbox)),
      timeMs: Number(timeMs) || 0,
      hitbox
    };
  }

  _sample(entity, timeMs) {
    const records = this.entities.get(entity) || [];
    if (records.length === 0) return null;
    if (timeMs <= records[0].timeMs) return clone(records[0].hitbox);
    for (let index = 0; index < records.length - 1; index += 1) {
      const from = records[index];
      const to = records[index + 1];
      if (timeMs >= from.timeMs && timeMs <= to.timeMs) {
        return blendHitbox(from.hitbox, to.hitbox, ratio(timeMs, from.timeMs, to.timeMs));
      }
    }
    return clone(records[records.length - 1].hitbox);
  }

  _prune(records, latestTimeMs) {
    const minTime = latestTimeMs - this.historyMs;
    while (records.length > 1 && records[0].timeMs < minTime) records.shift();
  }
}

function normalizeHitbox(hitbox) {
  return {
    x: Number(hitbox.x) || 0,
    y: Number(hitbox.y) || 0,
    w: Number(hitbox.w) || 0,
    h: Number(hitbox.h) || 0
  };
}

function blendHitbox(left, right, alpha) {
  return {
    x: round(left.x + ((right.x - left.x) * alpha)),
    y: round(left.y + ((right.y - left.y) * alpha)),
    w: round(left.w + ((right.w - left.w) * alpha)),
    h: round(left.h + ((right.h - left.h) * alpha))
  };
}

function ratio(value, from, to) {
  if (to === from) return 0;
  return (value - from) / (to - from);
}

function pointInHitbox(point, hitbox) {
  const x = Number(point.x) || 0;
  const y = Number(point.y) || 0;
  return x >= hitbox.x && x <= hitbox.x + hitbox.w && y >= hitbox.y && y <= hitbox.y + hitbox.h;
}

function round(value) {
  return Number(value.toFixed(3));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default LagCompensationTimeline;
