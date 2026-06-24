export const HAZARD_2D_25D_SCHEMA = 'omnicore.hazard-2d-25d-director.v1';

/**
 * Builds one hazard director step for 2D/2.5D action games.
 */
export function createHazard2D25DDirectorStep(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const actor = normalizeActor(config.actor || {});
  const checkpoint = normalizeCheckpoint(config.checkpoint || {});
  const hazards = normalizeHazards(config.hazards || []);
  const motion = buildMotionState({ hazards, delta });
  const contacts = buildContactState({ actor, hazards: motion.hazardUpdates });
  const damage = buildDamageState({ actor, contacts });
  const response = buildResponseState({ actor, contacts, checkpoint });
  const stateUpdates = buildStateUpdates({ actor, contacts, damage, response, delta });
  const effects = buildEffectsState({ contacts, damage, response });
  const events = buildEventsState({ actor, contacts, damage, response });
  const editor = buildEditorState();
  const runtimeSync = buildRuntimeSyncState();
  const debugDraw = buildDebugDraw({ hazards: motion.hazardUpdates, contacts, response });
  const quality = buildQualityChecks({ motion, contacts, damage, response, editor, runtimeSync });

  return {
    schema: HAZARD_2D_25D_SCHEMA,
    delta,
    actor,
    checkpoint,
    hazards,
    motion,
    contacts,
    damage,
    response,
    stateUpdates,
    effects,
    events,
    editor,
    runtimeSync,
    debugDraw,
    quality
  };
}

function normalizeActor(actor = {}) {
  const rect = normalizeRect(actor);
  return {
    ...actor,
    id: actor.id || actor.name || 'actor',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    health: Math.max(0, numberOr(actor.health, 1)),
    invulnerabilityMs: Math.max(0, numberOr(actor.invulnerabilityMs, 0)),
    velocity: {
      x: numberOr(actor.velocity?.x ?? actor.vx, 0),
      y: numberOr(actor.velocity?.y ?? actor.vy, 0)
    }
  };
}

function normalizeCheckpoint(checkpoint = {}) {
  return {
    id: checkpoint.id || 'checkpoint',
    respawn: normalizePoint(checkpoint.respawn || checkpoint)
  };
}

function normalizeHazards(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((hazard, index) => {
    const rect = normalizeRect(hazard);
    const path = normalizePath(hazard.path);
    return {
      ...hazard,
      id: hazard.id || `hazard-${index}`,
      type: hazard.type || 'hazard',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      active: hazard.active !== false,
      damage: Math.max(0, numberOr(hazard.damage, 1)),
      knockback: {
        x: numberOr(hazard.knockback?.x, 0),
        y: numberOr(hazard.knockback?.y, 0)
      },
      invulnerabilityMs: Math.max(0, numberOr(hazard.invulnerabilityMs, 600)),
      respawnOnHit: hazard.respawnOnHit === true,
      cooldownMs: Math.max(0, numberOr(hazard.cooldownMs, 0)),
      currentCooldownMs: Math.max(0, numberOr(hazard.currentCooldownMs, 0)),
      priority: numberOr(hazard.priority, 0),
      path,
      direction: path.direction
    };
  });
}

function normalizePath(path = {}) {
  return {
    from: numberOr(path.from, 0),
    to: numberOr(path.to, 0),
    speed: Math.max(0, numberOr(path.speed, 0)),
    direction: numberOr(path.direction, 1) >= 0 ? 1 : -1
  };
}

function buildMotionState({ hazards, delta }) {
  const hazardUpdates = hazards.map((hazard) => {
    if (hazard.path.speed <= 0 || hazard.path.from === hazard.path.to) {
      return {
        ...hazard,
        direction: hazard.path.direction,
        moved: false
      };
    }

    const rawX = hazard.x + hazard.path.speed * hazard.path.direction * delta;
    const min = Math.min(hazard.path.from, hazard.path.to);
    const max = Math.max(hazard.path.from, hazard.path.to);
    const clampedX = Math.min(max, Math.max(min, rawX));
    const hitEnd = rawX < min || rawX > max || clampedX === min || clampedX === max;
    const nextDirection = hitEnd ? -hazard.path.direction : hazard.path.direction;

    return {
      ...hazard,
      x: round(clampedX),
      y: round(hazard.y),
      direction: nextDirection,
      moved: true
    };
  });

  return {
    hazardUpdates,
    movingHazards: hazardUpdates
      .filter((hazard) => hazard.moved)
      .map((hazard) => ({
        id: hazard.id,
        x: hazard.x,
        y: hazard.y,
        direction: hazard.direction,
        speed: hazard.path.speed
      }))
  };
}

function buildContactState({ actor, hazards }) {
  if (actor.invulnerabilityMs > 0) {
    return {
      hitEvents: [],
      blocked: hazards
        .filter((hazard) => hazard.active && hazard.currentCooldownMs <= 0 && rectIntersects(actor, hazard))
        .map((hazard) => ({ hazardId: hazard.id, actorId: actor.id, reason: 'actor-invulnerable' }))
    };
  }

  const hitEvents = hazards
    .filter((hazard) => hazard.active && hazard.currentCooldownMs <= 0 && rectIntersects(actor, hazard))
    .sort((left, right) => right.priority - left.priority || right.damage - left.damage)
    .slice(0, 1)
    .map((hazard) => ({
      id: `${hazard.id}:${actor.id}`,
      hazardId: hazard.id,
      actorId: actor.id,
      type: hazard.type,
      damage: hazard.damage,
      point: {
        x: round(Math.max(hazard.x, Math.min(actor.x + actor.width / 2, hazard.x + hazard.width))),
        y: round(Math.max(hazard.y, Math.min(actor.y + actor.height / 2, hazard.y + hazard.height)))
      },
      knockback: { ...hazard.knockback },
      invulnerabilityMs: hazard.invulnerabilityMs,
      respawnOnHit: hazard.respawnOnHit,
      cooldownMs: hazard.cooldownMs
    }));

  return {
    hitEvents,
    blocked: []
  };
}

function buildDamageState({ actor, contacts }) {
  const totalDamage = contacts.hitEvents.reduce((sum, event) => sum + event.damage, 0);
  const nextHealth = Math.max(0, actor.health - totalDamage);
  return {
    events: contacts.hitEvents.map((event) => ({
      hazardId: event.hazardId,
      actorId: event.actorId,
      damage: event.damage
    })),
    totalDamage,
    health: {
      actorId: actor.id,
      from: actor.health,
      to: nextHealth
    }
  };
}

function buildResponseState({ actor, contacts, checkpoint }) {
  const knockbacks = contacts.hitEvents.map((event) => ({
    actorId: actor.id,
    hazardId: event.hazardId,
    velocity: { ...event.knockback }
  }));
  const invulnerabilityFrames = contacts.hitEvents.map((event) => ({
    actorId: actor.id,
    hazardId: event.hazardId,
    durationMs: event.invulnerabilityMs
  }));
  const respawnCommands = contacts.hitEvents
    .filter((event) => event.respawnOnHit)
    .map((event) => ({
      actorId: actor.id,
      hazardId: event.hazardId,
      checkpointId: checkpoint.id,
      x: checkpoint.respawn.x,
      y: checkpoint.respawn.y
    }));

  return {
    knockbacks,
    invulnerabilityFrames,
    respawnCommands
  };
}

function buildStateUpdates({ actor, contacts, damage, response, delta }) {
  const invulnerabilityMs = response.invulnerabilityFrames[0]?.durationMs
    ?? Math.max(0, actor.invulnerabilityMs - delta * 1000);
  const respawn = response.respawnCommands[0] || null;
  return {
    actor: {
      id: actor.id,
      health: damage.health.to,
      invulnerabilityMs: round(invulnerabilityMs),
      x: respawn ? respawn.x : actor.x,
      y: respawn ? respawn.y : actor.y,
      velocity: response.knockbacks[0]?.velocity || actor.velocity
    },
    hazardCooldowns: contacts.hitEvents.map((event) => ({
      hazardId: event.hazardId,
      cooldownMs: event.cooldownMs
    }))
  };
}

function buildEffectsState({ contacts, damage, response }) {
  return {
    applied: [
      ...contacts.hitEvents.flatMap((event) => [
        {
          type: 'damage-flash',
          targetId: event.actorId,
          hazardId: event.hazardId,
          damage: event.damage
        },
        {
          type: 'hazard-sparks',
          hazardId: event.hazardId,
          point: event.point
        }
      ]),
      ...(damage.totalDamage > 0 ? [{
        type: 'camera-shake',
        trauma: round(Math.min(1, damage.totalDamage * 0.12))
      }] : []),
      ...response.respawnCommands.map((command) => ({
        type: 'respawn-flash',
        targetId: command.actorId,
        checkpointId: command.checkpointId
      }))
    ]
  };
}

function buildEventsState({ actor, contacts, damage, response }) {
  return {
    queue: [
      ...contacts.hitEvents.map((event) => ({
        type: 'hazard:hit',
        hazardId: event.hazardId,
        actorId: actor.id,
        damage: event.damage
      })),
      ...(damage.totalDamage > 0 ? [{
        type: 'actor:damage',
        actorId: actor.id,
        damage: damage.totalDamage,
        health: damage.health.to
      }] : []),
      ...response.respawnCommands.map((command) => ({
        type: 'actor:respawn',
        actorId: command.actorId,
        checkpointId: command.checkpointId,
        x: command.x,
        y: command.y
      }))
    ]
  };
}

function buildEditorState() {
  return {
    format: 'omnicore.hazard-2d25d-editor.v1',
    panels: [
      'HazardDirector',
      'DamageZones',
      'MovingHazards',
      'Knockback',
      'InvulnerabilityFrames',
      'RespawnRoute',
      'RuntimeDebug'
    ],
    tools: [
      'HazardPaintTool',
      'MovingHazardPathTool',
      'KnockbackVectorTool',
      'InvulnerabilityPreview',
      'RespawnRoutePreview'
    ],
    hotReloadTopics: [
      'hazard:changed',
      'damage-zone:changed',
      'moving-hazard:changed',
      'knockback:changed',
      'respawn-route:changed'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.hazard-2d25d/v1',
    payloads: [
      'hazards',
      'motion',
      'contacts',
      'damage',
      'response',
      'effects',
      'events',
      'editor'
    ],
    events: [
      'hazard:hit',
      'actor:damage',
      'actor:knockback',
      'actor:invulnerability',
      'actor:respawn'
    ]
  };
}

function buildDebugDraw({ hazards, contacts, response }) {
  return [
    ...hazards.map((hazard) => ({
      op: 'debug:hazard-hitbox',
      hazardId: hazard.id,
      type: hazard.type,
      x: hazard.x,
      y: hazard.y,
      width: hazard.width,
      height: hazard.height,
      active: hazard.active
    })),
    ...contacts.hitEvents.map((event) => ({
      op: 'debug:hazard-contact',
      hazardId: event.hazardId,
      actorId: event.actorId,
      point: event.point,
      damage: event.damage
    })),
    ...response.knockbacks.map((knockback) => ({
      op: 'debug:hazard-knockback',
      actorId: knockback.actorId,
      hazardId: knockback.hazardId,
      velocity: knockback.velocity
    })),
    ...response.respawnCommands.map((command) => ({
      op: 'debug:respawn-route',
      actorId: command.actorId,
      checkpointId: command.checkpointId,
      x: command.x,
      y: command.y
    }))
  ];
}

function buildQualityChecks({ motion, contacts, damage, response, editor, runtimeSync }) {
  return {
    checks: [
      {
        id: 'hazard-contact',
        pass: contacts.hitEvents.length > 0,
        detail: `${contacts.hitEvents.length} hits`
      },
      {
        id: 'hazard-damage',
        pass: damage.totalDamage > 0 && damage.health.to < damage.health.from,
        detail: `${damage.health.from}->${damage.health.to}`
      },
      {
        id: 'hazard-response',
        pass: response.knockbacks.length > 0 && response.invulnerabilityFrames.length > 0,
        detail: `${response.knockbacks.length} knockbacks`
      },
      {
        id: 'hazard-motion',
        pass: motion.movingHazards.length > 0,
        detail: `${motion.movingHazards.length} moving`
      },
      {
        id: 'editor-runtime-hazard-sync',
        pass: editor.panels.length > 0 && runtimeSync.payloads.includes('response'),
        detail: runtimeSync.protocol
      }
    ]
  };
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

function rectIntersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value) {
  return Math.round(numberOr(value, 0) * 1000) / 1000;
}

export default createHazard2D25DDirectorStep;
