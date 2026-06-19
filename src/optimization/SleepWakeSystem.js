/**
 * Distance-based sleep and wake system for NPCs and enemies.
 *
 * Entities can opt in with `kind: 'npc'`, `kind: 'enemy'`, `tags: ['npc']`, or
 * `sleepable: true`. Sleeping entities skip logic updates until the player is
 * back inside the wake radius.
 *
 * @example
 * const sleepWake = new SleepWakeSystem({ player, distance: 640 });
 * if (sleepWake.shouldUpdate(enemy, scene)) enemy.update(delta);
 */
export class SleepWakeSystem {
  constructor({
    player = null,
    distance = 768,
    wakeDistance = null,
    types = ['npc', 'enemy'],
    enabled = true,
    stillnessMs = 5000,
    onSleep = null,
    onWake = null
  } = {}) {
    this.player = player;
    this.distance = distance;
    this.wakeDistance = wakeDistance || distance * 0.85;
    this.types = new Set(types);
    this.enabled = enabled;
    this.stillnessMs = stillnessMs;
    this.stillness = new WeakMap();
    this.onSleep = onSleep;
    this.onWake = onWake;
  }

  setPlayer(player) {
    this.player = player;
    return this;
  }

  shouldUpdate(entity, scene = null) {
    if (!this.enabled || !entity || entity.alwaysUpdate || entity.sleepable === false) return true;
    if (!this._isSleepCandidate(entity)) return true;
    const player = this._resolvePlayer(scene);
    if (!player) return true;
    const radius = entity.sleepDistance || this.distance;
    const wakeRadius = entity.wakeDistance || this.wakeDistance;
    const dist = squaredDistance(entity, player);
    const sleeping = Boolean(entity.sleeping || entity.__omnicoreSleeping);

    if (sleeping && dist <= wakeRadius * wakeRadius) {
      this._wake(entity, scene);
      return true;
    }

    if (!sleeping && dist > radius * radius) {
      this._sleep(entity, scene);
      return false;
    }

    return !sleeping;
  }

  updatePhysicsStillness(entity, deltaMs = 0, scene = null) {
    if (!this.enabled || !entity || entity.sleeping || entity.__omnicoreSleeping) return entity;
    const velocity = Math.abs(Number(entity.vx || entity.velocityX || entity.velocity?.x || 0))
      + Math.abs(Number(entity.vy || entity.velocityY || entity.velocity?.y || 0));
    const previous = this.stillness.get(entity) || { x: entity.x || 0, y: entity.y || 0, ms: 0 };
    const moved = Math.abs((entity.x || 0) - previous.x) > 0.0001
      || Math.abs((entity.y || 0) - previous.y) > 0.0001
      || velocity > 0.0001;
    const next = {
      x: entity.x || 0,
      y: entity.y || 0,
      ms: moved ? 0 : previous.ms + Math.max(0, Number(deltaMs) || 0)
    };
    this.stillness.set(entity, next);
    if (next.ms >= this.stillnessMs) {
      entity.sleep?.();
      this._sleep(entity, scene);
    }
    return entity;
  }

  updateDistanceActivity(entity, scene = null) {
    if (!this.enabled || !entity) return true;
    const player = this._resolvePlayer(scene);
    if (!player) return true;
    const radius = entity.sleepDistance || this.distance;
    const wakeRadius = entity.wakeDistance || this.wakeDistance || radius;
    const dist = squaredDistance(entity, player);
    const inactive = entity.active === false || entity.__omnicoreDistanceInactive;
    if (inactive && dist <= wakeRadius * wakeRadius) {
      entity.active = true;
      entity.__omnicoreDistanceInactive = false;
      this._wake(entity, scene);
      return true;
    }
    if (!inactive && dist > radius * radius) {
      entity.active = false;
      entity.__omnicoreDistanceInactive = true;
      this._sleep(entity, scene);
      return false;
    }
    return entity.active !== false;
  }

  _resolvePlayer(scene) {
    if (typeof this.player === 'function') return this.player(scene);
    if (this.player) return this.player;
    return scene?.player || scene?.game?.player || scene?.game?.store?.get?.('player') || null;
  }

  _isSleepCandidate(entity) {
    if (entity.sleepable === true) return true;
    const kind = entity.kind || entity.role || entity.entityType;
    if (kind && this.types.has(kind)) return true;
    if (Array.isArray(entity.tags)) return entity.tags.some((tag) => this.types.has(tag));
    return false;
  }

  _sleep(entity, scene) {
    entity.sleeping = true;
    entity.__omnicoreSleeping = true;
    entity.onSleep?.(scene);
    this.onSleep?.(entity, scene);
  }

  _wake(entity, scene) {
    entity.sleeping = false;
    entity.__omnicoreSleeping = false;
    entity.onWake?.(scene);
    this.onWake?.(entity, scene);
  }
}

function squaredDistance(left = {}, right = {}) {
  const dx = (left.x || 0) - (right.x || 0);
  const dy = (left.y || 0) - (right.y || 0);
  return dx * dx + dy * dy;
}

export default SleepWakeSystem;
