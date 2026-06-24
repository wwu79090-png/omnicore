export const PROJECTILE_2D_25D_SCHEMA = 'omnicore.projectile-2d-25d-director.v1';

/**
 * Builds one projectile director step for 2D/2.5D action games.
 */
export function createProjectile2D25DDirectorStep(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const bounds = normalizeRect(config.bounds || {});
  const emitters = normalizeEmitters(config.emitters || []);
  const projectiles = normalizeProjectiles(config.projectiles || []);
  const targets = normalizeTargets(config.targets || []);
  const colliders = normalizeColliders(config.colliders || []);
  const spawning = buildSpawningState({ emitters, projectiles, config });
  const motion = buildMotionState({ projectiles, colliders, bounds, delta });
  const collisions = buildCollisionState({ motion, targets });
  const lifetime = buildLifetimeState({ motion, collisions, bounds });
  const pool = buildPoolState(config.pool || {}, projectiles, spawning.spawnCommands);
  const feedback = buildFeedbackState(collisions.hitEvents);
  const editor = buildEditorState();
  const runtimeSync = buildRuntimeSyncState();
  const debugDraw = buildDebugDraw({ spawning, motion, collisions, pool });
  const quality = buildQualityChecks({ spawning, motion, collisions, pool, editor, runtimeSync });

  return {
    schema: PROJECTILE_2D_25D_SCHEMA,
    delta,
    bounds,
    emitters,
    projectiles,
    targets,
    colliders,
    spawning,
    motion,
    collisions,
    lifetime,
    pool,
    feedback,
    editor,
    runtimeSync,
    debugDraw,
    quality
  };
}

function normalizeEmitters(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((emitter, index) => {
    const direction = normalizeVector(emitter.direction || { x: 1, y: 0 });
    const speed = Math.max(0, numberOr(emitter.speed, 0));
    return {
      id: emitter.id || `emitter-${index}`,
      ownerId: emitter.ownerId || emitter.owner || null,
      prefab: emitter.prefab || emitter.projectile || 'projectile',
      fire: emitter.fire === true || emitter.triggered === true,
      muzzle: normalizePoint(emitter.muzzle || emitter.position || emitter),
      direction,
      speed,
      velocity: {
        x: round(direction.x * speed),
        y: round(direction.y * speed)
      },
      damage: Math.max(0, numberOr(emitter.damage, 1)),
      pierce: Math.max(0, Math.floor(numberOr(emitter.pierce, 0))),
      bounce: Math.max(0, Math.floor(numberOr(emitter.bounce, 0))),
      width: Math.max(1, numberOr(emitter.width, 8)),
      height: Math.max(1, numberOr(emitter.height, 4)),
      ttlMs: Math.max(1, numberOr(emitter.ttlMs, 1000)),
      poolSize: Math.max(0, Math.floor(numberOr(emitter.poolSize, 0))),
      cooldownMs: Math.max(0, numberOr(emitter.cooldownMs, 0))
    };
  });
}

function normalizeProjectiles(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((projectile, index) => ({
    id: projectile.id || `projectile-${index}`,
    ownerId: projectile.ownerId || projectile.owner || null,
    prefab: projectile.prefab || 'projectile',
    x: numberOr(projectile.x, 0),
    y: numberOr(projectile.y, 0),
    width: Math.max(1, numberOr(projectile.width ?? projectile.w, 8)),
    height: Math.max(1, numberOr(projectile.height ?? projectile.h, 4)),
    velocity: {
      x: numberOr(projectile.velocity?.x ?? projectile.vx, 0),
      y: numberOr(projectile.velocity?.y ?? projectile.vy, 0)
    },
    damage: Math.max(0, numberOr(projectile.damage, 1)),
    pierce: Math.max(0, Math.floor(numberOr(projectile.pierce, 0))),
    bounce: Math.max(0, Math.floor(numberOr(projectile.bounce, 0))),
    ageMs: Math.max(0, numberOr(projectile.ageMs, 0)),
    ttlMs: Math.max(1, numberOr(projectile.ttlMs, 1000)),
    tags: Array.isArray(projectile.tags) ? [...projectile.tags] : []
  }));
}

function normalizeTargets(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((target, index) => {
    const base = normalizeRect(target);
    return {
      ...target,
      id: target.id || target.name || `target-${index}`,
      type: target.type || 'target',
      x: base.x,
      y: base.y,
      width: base.width,
      height: base.height,
      health: numberOr(target.health, 1),
      hurtboxes: normalizeHurtboxes(target)
    };
  });
}

function normalizeHurtboxes(target) {
  if (!Array.isArray(target.hurtboxes) || target.hurtboxes.length === 0) {
    return [{ id: 'body', x: 0, y: 0, width: numberOr(target.width ?? target.w, 0), height: numberOr(target.height ?? target.h, 0) }];
  }
  return target.hurtboxes.map((box, index) => ({
    id: box.id || `hurtbox-${index}`,
    x: numberOr(box.x, 0),
    y: numberOr(box.y, 0),
    width: Math.max(0, numberOr(box.width ?? box.w, 0)),
    height: Math.max(0, numberOr(box.height ?? box.h, 0))
  }));
}

function normalizeColliders(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((collider, index) => ({
    ...normalizeRect(collider),
    id: collider.id || `collider-${index}`,
    type: collider.type || 'solid'
  }));
}

function buildSpawningState({ emitters, projectiles, config }) {
  const activeByPrefab = new Map();
  for (const projectile of projectiles) {
    activeByPrefab.set(projectile.prefab, (activeByPrefab.get(projectile.prefab) || 0) + 1);
  }

  const spawnCommands = [];
  const blocked = [];
  for (const emitter of emitters) {
    const activeForPrefab = activeByPrefab.get(emitter.prefab) || 0;
    const poolFull = emitter.poolSize > 0 && activeForPrefab >= emitter.poolSize;
    if (!emitter.fire || emitter.cooldownMs > 0 || poolFull) {
      if (poolFull) blocked.push({ emitterId: emitter.id, reason: 'pool-full', prefab: emitter.prefab });
      continue;
    }
    spawnCommands.push({
      id: `${emitter.id}:shot-${spawnCommands.length}`,
      emitterId: emitter.id,
      ownerId: emitter.ownerId,
      prefab: emitter.prefab,
      x: emitter.muzzle.x,
      y: emitter.muzzle.y,
      width: emitter.width,
      height: emitter.height,
      velocity: { ...emitter.velocity },
      damage: emitter.damage,
      pierce: emitter.pierce,
      bounce: emitter.bounce,
      ttlMs: emitter.ttlMs
    });
    activeByPrefab.set(emitter.prefab, activeForPrefab + 1);
  }

  return {
    spawnCommands,
    blocked,
    emitterCount: emitters.length,
    requested: emitters.filter((emitter) => emitter.fire).length,
    policy: config.spawnPolicy || 'fire-ready-emitters'
  };
}

function buildMotionState({ projectiles, colliders, bounds, delta }) {
  const updates = projectiles.map((projectile) => {
    const raw = {
      x: projectile.x + projectile.velocity.x * delta,
      y: projectile.y + projectile.velocity.y * delta
    };
    const rawRect = { ...projectile, ...raw };
    const wallHit = colliders.find((collider) => collider.type !== 'sensor' && rectIntersects(rawRect, collider));
    const outside = isOutsideBounds(rawRect, bounds);
    const bounced = projectile.bounce > 0 && (wallHit || outside);
    const nextVelocity = bounced
      ? reflectVelocity(projectile.velocity, wallHit, rawRect, bounds)
      : { ...projectile.velocity };
    const nextPoint = bounced
      ? { x: projectile.x, y: projectile.y }
      : raw;

    return {
      ...projectile,
      x: round(nextPoint.x),
      y: round(nextPoint.y),
      previous: { x: projectile.x, y: projectile.y },
      velocity: {
        x: round(nextVelocity.x),
        y: round(nextVelocity.y)
      },
      ageMs: round(projectile.ageMs + delta * 1000),
      bounced,
      bounceRemaining: Math.max(0, projectile.bounce - (bounced ? 1 : 0)),
      colliderId: wallHit?.id || null,
      outsideBounds: outside
    };
  });

  return {
    updates,
    trajectories: updates.map((projectile) => ({
      projectileId: projectile.id,
      from: projectile.previous,
      to: { x: projectile.x, y: projectile.y },
      velocity: projectile.velocity,
      bounced: projectile.bounced
    }))
  };
}

function buildCollisionState({ motion, targets }) {
  const hitEvents = [];
  const hitCounts = new Map();

  for (const projectile of motion.updates) {
    for (const target of targets) {
      if (projectile.ownerId && projectile.ownerId === target.id) continue;
      const hitbox = findTargetHitbox(projectile, target);
      if (!hitbox) continue;
      const hitCount = (hitCounts.get(projectile.id) || 0) + 1;
      hitCounts.set(projectile.id, hitCount);
      hitEvents.push({
        id: `${projectile.id}:${target.id}:${hitCount}`,
        projectileId: projectile.id,
        targetId: target.id,
        targetType: target.type,
        hurtboxId: hitbox.id,
        damage: projectile.damage,
        point: {
          x: round(projectile.x + projectile.width / 2),
          y: round(projectile.y + projectile.height / 2)
        }
      });
      if (hitCount > projectile.pierce) break;
    }
  }

  return {
    hitEvents,
    pierceUpdates: motion.updates
      .filter((projectile) => hitCounts.has(projectile.id))
      .map((projectile) => ({
        projectileId: projectile.id,
        hitCount: hitCounts.get(projectile.id),
        remainingPierce: Math.max(0, projectile.pierce - hitCounts.get(projectile.id))
      }))
  };
}

function buildLifetimeState({ motion, collisions, bounds }) {
  const pierceByProjectile = new Map(collisions.pierceUpdates.map((entry) => [entry.projectileId, entry]));
  const despawnCommands = [];

  for (const projectile of motion.updates) {
    const pierce = pierceByProjectile.get(projectile.id);
    const expired = projectile.ageMs >= projectile.ttlMs;
    const outsideWithoutBounce = projectile.outsideBounds && projectile.bounceRemaining <= 0 && !rectTouchesBounds(projectile, bounds);
    const exhaustedPierce = pierce && pierce.hitCount > projectile.pierce;
    if (expired || outsideWithoutBounce || exhaustedPierce) {
      despawnCommands.push({
        projectileId: projectile.id,
        reason: expired ? 'ttl-expired' : exhaustedPierce ? 'pierce-exhausted' : 'out-of-bounds'
      });
    }
  }

  return {
    despawnCommands,
    activeIds: motion.updates
      .filter((projectile) => !despawnCommands.some((command) => command.projectileId === projectile.id))
      .map((projectile) => projectile.id)
  };
}

function buildPoolState(poolInput, projectiles, spawnCommands) {
  const budget = Math.max(0, Math.floor(numberOr(poolInput.budget, projectiles.length + spawnCommands.length)));
  const active = Math.max(0, Math.floor(numberOr(poolInput.active, projectiles.length))) + spawnCommands.length;
  return {
    budget,
    active,
    available: Math.max(0, budget - active),
    overBudget: active > budget,
    spawnedThisStep: spawnCommands.length,
    activeBeforeStep: Math.max(0, Math.floor(numberOr(poolInput.active, projectiles.length)))
  };
}

function buildFeedbackState(hitEvents) {
  return {
    impactParticles: hitEvents.map((event) => ({
      id: `impact:${event.projectileId}:${event.targetId}`,
      projectileId: event.projectileId,
      targetId: event.targetId,
      point: event.point,
      preset: 'projectile-impact'
    })),
    audioCues: hitEvents.map((event) => ({
      id: `audio:${event.projectileId}:${event.targetId}`,
      projectileId: event.projectileId,
      targetId: event.targetId,
      cue: 'projectile-hit'
    }))
  };
}

function buildEditorState() {
  return {
    format: 'omnicore.projectile-2d25d-editor.v1',
    panels: [
      'ProjectileDirector',
      'Emitters',
      'ProjectilePool',
      'Hitboxes',
      'PierceBounce',
      'TrajectoryDebug',
      'RuntimeDebug'
    ],
    tools: [
      'EmitterInspector',
      'ProjectilePoolBudget',
      'HitboxPreview',
      'TrajectoryOverlay',
      'PierceBounceTuning'
    ],
    hotReloadTopics: [
      'projectile:emitter-changed',
      'projectile:prefab-changed',
      'projectile:pool-changed',
      'projectile:collision-changed'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.projectile-2d25d/v1',
    payloads: [
      'spawning',
      'motion',
      'collisions',
      'lifetime',
      'pool',
      'feedback',
      'editor'
    ],
    events: [
      'projectile:spawn',
      'projectile:move',
      'projectile:bounce',
      'projectile:hit',
      'projectile:despawn',
      'projectile:pool-budget'
    ]
  };
}

function buildDebugDraw({ spawning, motion, collisions, pool }) {
  return [
    ...motion.trajectories.map((trajectory) => ({
      op: 'debug:projectile-trajectory',
      ...trajectory
    })),
    ...motion.updates.map((projectile) => ({
      op: 'debug:projectile-hitbox',
      projectileId: projectile.id,
      x: projectile.x,
      y: projectile.y,
      width: projectile.width,
      height: projectile.height,
      bounced: projectile.bounced
    })),
    ...collisions.hitEvents.map((event) => ({
      op: 'debug:projectile-impact',
      ...event
    })),
    {
      op: 'debug:projectile-pool',
      budget: pool.budget,
      active: pool.active,
      available: pool.available,
      spawnedThisStep: spawning.spawnCommands.length,
      overBudget: pool.overBudget
    }
  ];
}

function buildQualityChecks({ spawning, motion, collisions, pool, editor, runtimeSync }) {
  return {
    checks: [
      {
        id: 'projectile-spawn',
        pass: spawning.spawnCommands.length > 0,
        detail: `${spawning.spawnCommands.length} spawned`
      },
      {
        id: 'projectile-motion',
        pass: motion.updates.length > 0,
        detail: `${motion.updates.length} moved`
      },
      {
        id: 'projectile-collision',
        pass: collisions.hitEvents.length > 0,
        detail: `${collisions.hitEvents.length} hits`
      },
      {
        id: 'projectile-pool-budget',
        pass: !pool.overBudget,
        detail: `${pool.active}/${pool.budget}`
      },
      {
        id: 'editor-runtime-projectile-sync',
        pass: editor.panels.length > 0 && runtimeSync.payloads.includes('collisions'),
        detail: runtimeSync.protocol
      }
    ]
  };
}

function findTargetHitbox(projectile, target) {
  for (const box of target.hurtboxes) {
    const worldBox = {
      id: box.id,
      x: target.x + box.x,
      y: target.y + box.y,
      width: box.width,
      height: box.height
    };
    if (rectIntersects(projectile, worldBox)) return worldBox;
  }
  return null;
}

function reflectVelocity(velocity, collider, rect, bounds) {
  if (!collider) {
    const hitHorizontal = rect.x < bounds.x || rect.x + rect.width > bounds.x + bounds.width;
    const hitVertical = rect.y < bounds.y || rect.y + rect.height > bounds.y + bounds.height;
    return {
      x: hitHorizontal ? -velocity.x : velocity.x,
      y: hitVertical ? -velocity.y : velocity.y
    };
  }

  const horizontalOverlap = Math.min(rect.x + rect.width, collider.x + collider.width) - Math.max(rect.x, collider.x);
  const verticalOverlap = Math.min(rect.y + rect.height, collider.y + collider.height) - Math.max(rect.y, collider.y);
  if (horizontalOverlap <= verticalOverlap) return { x: -velocity.x, y: velocity.y };
  return { x: velocity.x, y: -velocity.y };
}

function isOutsideBounds(rect, bounds) {
  if (bounds.width <= 0 || bounds.height <= 0) return false;
  return rect.x < bounds.x
    || rect.y < bounds.y
    || rect.x + rect.width > bounds.x + bounds.width
    || rect.y + rect.height > bounds.y + bounds.height;
}

function rectTouchesBounds(rect, bounds) {
  if (bounds.width <= 0 || bounds.height <= 0) return true;
  return rect.x + rect.width >= bounds.x
    && rect.x <= bounds.x + bounds.width
    && rect.y + rect.height >= bounds.y
    && rect.y <= bounds.y + bounds.height;
}

function rectIntersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function normalizeRect(rect = {}) {
  return {
    x: numberOr(rect.x, 0),
    y: numberOr(rect.y, 0),
    width: Math.max(0, numberOr(rect.width ?? rect.w, 0)),
    height: Math.max(0, numberOr(rect.height ?? rect.h, 0))
  };
}

function normalizePoint(point = {}) {
  return {
    x: numberOr(point.x, 0),
    y: numberOr(point.y, 0)
  };
}

function normalizeVector(vector = {}) {
  const x = numberOr(vector.x, 0);
  const y = numberOr(vector.y, 0);
  const length = Math.hypot(x, y);
  if (length <= 0.000001) return { x: 1, y: 0 };
  return {
    x: round(x / length),
    y: round(y / length)
  };
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value) {
  return Math.round(numberOr(value, 0) * 1000) / 1000;
}

export default createProjectile2D25DDirectorStep;
