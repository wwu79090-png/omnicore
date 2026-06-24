export const LEVEL_2D_25D_GAMEPLAY_SCHEMA = 'omnicore.level-2d-25d-gameplay-loop.v1';

/**
 * Builds a production-oriented 2D/2.5D level gameplay step for camera, combat, pickups, checkpoints, AI, events, and rendering.
 */
export function createLevel2D25DGameplayLoop(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const world = normalizeWorld(config.world);
  const actors = normalizeActors(config.actors || []);
  const camera = buildCameraState(config.camera || {}, actors, world);
  const combat = buildCombatState(actors);
  const collectibles = buildCollectibleState(actors, config.collectibles || []);
  const checkpoints = buildCheckpointState(actors, config.checkpoints || []);
  const enemyAI = buildEnemyAIState(actors, delta);
  const events = buildEventState(actors, config.triggers || []);
  const render = buildRenderState({
    actors,
    collectibles: collectibles.remaining,
    checkpoints: checkpoints.checkpoints,
    triggers: events.triggers,
    render: config.render || {},
    world
  });
  const performance = buildPerformanceState({
    world,
    render,
    combat,
    collectibles,
    events
  });
  const debugDraw = buildDebugDraw({
    camera,
    actors,
    combat,
    collectibles,
    checkpoints,
    enemyAI,
    events,
    render
  });
  const editor = buildEditorState();
  const runtimeSync = buildRuntimeSyncState();
  const quality = buildQualityChecks({
    camera,
    combat,
    collectibles,
    checkpoints,
    enemyAI,
    performance
  });

  return {
    schema: LEVEL_2D_25D_GAMEPLAY_SCHEMA,
    delta,
    world,
    camera,
    combat,
    collectibles,
    checkpoints,
    enemyAI,
    events,
    render,
    performance,
    debugDraw,
    editor,
    runtimeSync,
    quality
  };
}

function normalizeWorld(worldInput) {
  const world = worldInput || {};
  return {
    bounds: normalizeRect(world.bounds, { x: 0, y: 0, width: 0, height: 0 }),
    frameBudgetMs: numberOr(world.frameBudgetMs, 16.67)
  };
}

function normalizeActors(actorInput) {
  const actors = Array.isArray(actorInput) ? actorInput : [actorInput];
  return actors.filter(Boolean).map((actor, index) => {
    const width = numberOr(actor.width ?? actor.w, 0);
    const height = numberOr(actor.height ?? actor.h, 0);
    return {
      ...actor,
      id: actor.id || actor.name || `actor-${index}`,
      type: actor.type || 'entity',
      x: numberOr(actor.x, 0),
      y: numberOr(actor.y, 0),
      width,
      height,
      health: numberOr(actor.health, 1),
      facing: actor.facing || 'right',
      hitboxes: Array.isArray(actor.hitboxes) ? actor.hitboxes : [],
      hurtboxes: Array.isArray(actor.hurtboxes) && actor.hurtboxes.length > 0
        ? actor.hurtboxes
        : [{ id: 'body', x: 0, y: 0, width, height }]
    };
  });
}

function buildCameraState(cameraInput, actors, world) {
  const viewport = normalizeRect(cameraInput.viewport, { x: 0, y: 0, width: 320, height: 180 });
  const zones = (Array.isArray(cameraInput.zones) ? cameraInput.zones : []).map((zone, index) => ({
    id: zone.id || `zone-${index}`,
    ...normalizeRect(zone, world.bounds),
    deadzone: normalizeRect(zone.deadzone, { x: 0, y: 0, width: 0, height: 0 }),
    transition: zone.transition || null
  }));
  const followTargetId = cameraInput.target || cameraInput.follow || null;
  const target = actors.find((actor) => actor.id === followTargetId) || actors[0] || null;
  const targetCenter = target ? centerOf(target) : { x: 0, y: 0 };
  const activeZone = zones.find((zone) => containsPoint(zone, targetCenter)) || zones[0] || {
    id: 'world',
    ...world.bounds,
    deadzone: normalizeRect(null, { x: 0, y: 0, width: 0, height: 0 }),
    transition: null
  };
  const rawView = {
    x: targetCenter.x - viewport.width / 2,
    y: targetCenter.y - viewport.height / 2,
    width: viewport.width,
    height: viewport.height
  };
  const view = clampView(rawView, activeZone.width > 0 ? activeZone : world.bounds);
  return {
    followTargetId: target?.id || followTargetId,
    activeZoneId: activeZone.id,
    transition: activeZone.transition,
    viewport,
    deadzone: activeZone.deadzone,
    view
  };
}

function buildCombatState(actors) {
  const damageEvents = [];
  const healthUpdates = {};
  const hurtTargets = actors.flatMap((actor) => actor.hurtboxes.map((hurtbox) => ({
    actor,
    hurtbox,
    rect: localRect(actor, hurtbox)
  })));
  for (const attacker of actors) {
    for (const hitbox of attacker.hitboxes) {
      const hitRect = localRect(attacker, hitbox);
      for (const target of hurtTargets) {
        if (target.actor.id === attacker.id) continue;
        if (!intersects(hitRect, target.rect)) continue;
        const damage = Math.max(0, numberOr(hitbox.damage, 1));
        const previous = target.actor.health;
        const current = Math.max(0, previous - damage);
        damageEvents.push({
          attackerId: attacker.id,
          targetId: target.actor.id,
          hitboxId: hitbox.id || 'hitbox',
          hurtboxId: target.hurtbox.id || 'hurtbox',
          damage,
          tags: hitbox.tags || []
        });
        healthUpdates[target.actor.id] = { previous, current };
      }
    }
  }
  return {
    format: 'omnicore.level-combat-2d25d.v1',
    damageEvents,
    healthUpdates
  };
}

function buildCollectibleState(actors, collectibleInput) {
  const players = actors.filter((actor) => actor.type === 'player');
  const collectibles = (Array.isArray(collectibleInput) ? collectibleInput : []).map((item, index) => ({
    id: item.id || `collectible-${index}`,
    ...normalizeRect(item, { width: 0, height: 0 }),
    inventoryKey: item.inventoryKey || 'items',
    value: numberOr(item.value, 1)
  }));
  const events = [];
  const inventoryDelta = {};
  for (const collectible of collectibles) {
    const actor = players.find((player) => intersects(rectOf(player), collectible));
    if (!actor) continue;
    events.push({
      actorId: actor.id,
      collectibleId: collectible.id,
      inventoryKey: collectible.inventoryKey,
      value: collectible.value
    });
    inventoryDelta[collectible.inventoryKey] = numberOr(inventoryDelta[collectible.inventoryKey], 0) + collectible.value;
  }
  const collectedIds = new Set(events.map((event) => event.collectibleId));
  return {
    format: 'omnicore.level-collectibles-2d25d.v1',
    events,
    inventoryDelta,
    all: collectibles,
    remaining: collectibles.filter((collectible) => !collectedIds.has(collectible.id)),
    collectedIds: [...collectedIds]
  };
}

function buildCheckpointState(actors, checkpointInput) {
  const players = actors.filter((actor) => actor.type === 'player');
  const checkpoints = (Array.isArray(checkpointInput) ? checkpointInput : []).map((checkpoint, index) => ({
    id: checkpoint.id || `checkpoint-${index}`,
    ...normalizeRect(checkpoint, { width: 0, height: 0 }),
    respawn: checkpoint.respawn || { x: numberOr(checkpoint.x, 0), y: numberOr(checkpoint.y, 0) }
  }));
  const active = checkpoints.find((checkpoint) => players.some((player) => intersects(rectOf(player), checkpoint))) || null;
  return {
    format: 'omnicore.level-checkpoints-2d25d.v1',
    checkpoints,
    activeCheckpointId: active?.id || null,
    respawnPoint: active ? { ...active.respawn } : null
  };
}

function buildEnemyAIState(actors, delta) {
  const patrolUpdates = actors
    .filter((actor) => actor.type === 'enemy' && actor.patrol)
    .map((actor) => {
      const patrol = actor.patrol || {};
      const speed = numberOr(patrol.speed, 0);
      const from = numberOr(patrol.from, actor.x);
      const to = numberOr(patrol.to, actor.x);
      const currentDirection = numberOr(patrol.direction, 1) >= 0 ? 1 : -1;
      let nextX = actor.x + speed * currentDirection * delta;
      let direction = currentDirection;
      if (nextX > to) {
        nextX = to;
        direction = -1;
      } else if (nextX < from) {
        nextX = from;
        direction = 1;
      }
      return {
        actorId: actor.id,
        fromX: actor.x,
        nextX,
        direction,
        patrolRange: { from, to }
      };
    });
  return {
    format: 'omnicore.enemy-ai-2d25d.v1',
    patrolUpdates
  };
}

function buildEventState(actors, triggerInput) {
  const players = actors.filter((actor) => actor.type === 'player');
  const triggers = (Array.isArray(triggerInput) ? triggerInput : []).map((trigger, index) => ({
    id: trigger.id || `trigger-${index}`,
    ...normalizeRect(trigger, { width: 0, height: 0 }),
    event: trigger.event || 'event',
    target: trigger.target || null
  }));
  const queue = [];
  for (const trigger of triggers) {
    const actor = players.find((player) => intersects(rectOf(player), trigger));
    if (!actor) continue;
    queue.push({
      id: trigger.id,
      type: trigger.event,
      target: trigger.target,
      actorId: actor.id
    });
  }
  return {
    format: 'omnicore.level-events-2d25d.v1',
    triggers,
    queue
  };
}

function buildRenderState({ actors, collectibles, checkpoints, triggers, render, world }) {
  const visibleBounds = normalizeRect(render.visibleBounds, world.bounds);
  const ySortQueue = [
    ...actors.map((actor) => renderEntry(actor.id, actor.type, actor)),
    ...collectibles.map((collectible) => renderEntry(collectible.id, 'collectible', collectible)),
    ...checkpoints.map((checkpoint) => renderEntry(checkpoint.id, 'checkpoint', checkpoint)),
    ...triggers.map((trigger) => renderEntry(trigger.id, 'trigger', trigger))
  ]
    .map((entry) => ({ ...entry, visible: intersects(entry, visibleBounds) }))
    .sort((left, right) => left.depthY - right.depthY || String(left.id).localeCompare(String(right.id)));
  return {
    format: 'omnicore.level-render-2d25d.v1',
    visibleBounds,
    maxDrawCalls: Math.max(1, numberOr(render.maxDrawCalls, 128)),
    ySortQueue
  };
}

function buildPerformanceState({ world, render, combat, collectibles, events }) {
  const visibleCount = render.ySortQueue.filter((entry) => entry.visible).length;
  const estimatedDrawCalls = Math.min(render.maxDrawCalls, Math.max(1, visibleCount));
  const estimatedMs = Number((estimatedDrawCalls * 0.35
    + combat.damageEvents.length * 0.08
    + collectibles.events.length * 0.04
    + events.queue.length * 0.04).toFixed(3));
  return {
    format: 'omnicore.level-frame-budget-2d25d.v1',
    frameBudget: {
      budgetMs: world.frameBudgetMs,
      estimatedMs,
      estimatedDrawCalls,
      visibleCount,
      overBudget: estimatedMs > world.frameBudgetMs
    }
  };
}

function buildDebugDraw({ camera, actors, combat, collectibles, checkpoints, enemyAI, events, render }) {
  return [
    {
      op: 'debug:camera-zone',
      id: camera.activeZoneId,
      x: camera.view.x,
      y: camera.view.y,
      width: camera.view.width,
      height: camera.view.height
    },
    ...actors.flatMap((actor) => [
      ...actor.hitboxes.map((hitbox) => ({
        op: 'debug:hitbox',
        actorId: actor.id,
        id: hitbox.id || 'hitbox',
        ...localRect(actor, hitbox)
      })),
      ...actor.hurtboxes.map((hurtbox) => ({
        op: 'debug:hurtbox',
        actorId: actor.id,
        id: hurtbox.id || 'hurtbox',
        ...localRect(actor, hurtbox)
      }))
    ]),
    ...collectibles.all.map((collectible) => ({
      op: 'debug:collectible',
      id: collectible.id,
      collected: collectibles.collectedIds.includes(collectible.id),
      ...rectOf(collectible)
    })),
    ...checkpoints.checkpoints.map((checkpoint) => ({
      op: 'debug:checkpoint',
      id: checkpoint.id,
      ...rectOf(checkpoint)
    })),
    ...enemyAI.patrolUpdates.map((update) => ({
      op: 'debug:patrol-path',
      actorId: update.actorId,
      x: update.patrolRange.from,
      y: actors.find((actor) => actor.id === update.actorId)?.y || 0,
      width: update.patrolRange.to - update.patrolRange.from,
      direction: update.direction
    })),
    ...events.triggers.map((trigger) => ({
      op: 'debug:event-trigger',
      id: trigger.id,
      ...rectOf(trigger)
    })),
    ...render.ySortQueue.map((entry, index) => ({
      op: 'debug:y-sort-entry',
      id: entry.id,
      index,
      depthY: entry.depthY,
      visible: entry.visible
    })),
    ...combat.damageEvents.map((event) => ({
      op: 'debug:damage-event',
      attackerId: event.attackerId,
      targetId: event.targetId,
      damage: event.damage
    }))
  ];
}

function buildEditorState() {
  return {
    format: 'omnicore.level-gameplay-editor-2d25d.v1',
    panels: [
      'CameraZones',
      'Combat',
      'Collectibles',
      'Checkpoints',
      'EnemyAI',
      'Events',
      'YSort',
      'FrameBudget'
    ],
    tools: [
      'CameraZonePainter',
      'HitboxInspector',
      'PickupPlacement',
      'CheckpointPlacement',
      'PatrolPathEditor',
      'EventTriggerEditor',
      'YSortDebugger',
      'FrameBudgetOverlay'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.level-2d25d/v1',
    payloads: [
      'camera',
      'combat',
      'collectibles',
      'checkpoints',
      'enemyAI',
      'events',
      'render',
      'performance'
    ],
    events: [
      'camera:zone-changed',
      'combat:damage',
      'collectible:picked',
      'checkpoint:activated',
      'enemy:patrol-step',
      'event:triggered',
      'render:y-sort',
      'performance:frame-budget'
    ]
  };
}

function buildQualityChecks({ camera, combat, collectibles, checkpoints, enemyAI, performance }) {
  return {
    checks: [
      {
        id: 'camera-zone-follow',
        pass: Boolean(camera.followTargetId && camera.activeZoneId),
        detail: `${camera.followTargetId || 'none'} in ${camera.activeZoneId || 'none'}`
      },
      {
        id: 'combat-hitbox-hurtbox',
        pass: combat.damageEvents.length > 0,
        detail: `${combat.damageEvents.length} damage events`
      },
      {
        id: 'collectible-pickup',
        pass: collectibles.events.length > 0,
        detail: `${collectibles.events.length} pickup events`
      },
      {
        id: 'checkpoint-respawn',
        pass: Boolean(checkpoints.activeCheckpointId && checkpoints.respawnPoint),
        detail: checkpoints.activeCheckpointId || 'none'
      },
      {
        id: 'enemy-patrol-ai',
        pass: enemyAI.patrolUpdates.length > 0,
        detail: `${enemyAI.patrolUpdates.length} patrol updates`
      },
      {
        id: 'frame-budget',
        pass: !performance.frameBudget.overBudget,
        detail: `${performance.frameBudget.estimatedMs}/${performance.frameBudget.budgetMs}ms`
      }
    ]
  };
}

function renderEntry(id, type, value) {
  const rect = rectOf(value);
  return {
    id,
    type,
    ...rect,
    depthY: numberOr(value.depthY, rect.y + rect.height)
  };
}

function localRect(actor, box = {}) {
  const width = numberOr(box.width ?? box.w, actor.width);
  const height = numberOr(box.height ?? box.h, actor.height);
  const offsetX = numberOr(box.x, 0);
  const x = actor.facing === 'left'
    ? actor.x + actor.width - offsetX - width
    : actor.x + offsetX;
  return {
    x,
    y: actor.y + numberOr(box.y, 0),
    width,
    height
  };
}

function rectOf(value = {}) {
  return {
    x: numberOr(value.x, 0),
    y: numberOr(value.y, 0),
    width: numberOr(value.width ?? value.w, 0),
    height: numberOr(value.height ?? value.h, 0)
  };
}

function normalizeRect(value, fallback = {}) {
  return {
    x: numberOr(value?.x, fallback.x || 0),
    y: numberOr(value?.y, fallback.y || 0),
    width: numberOr(value?.width ?? value?.w, fallback.width || 0),
    height: numberOr(value?.height ?? value?.h, fallback.height || 0)
  };
}

function clampView(view, bounds) {
  const maxX = bounds.x + Math.max(0, bounds.width - view.width);
  const maxY = bounds.y + Math.max(0, bounds.height - view.height);
  return {
    x: Math.min(maxX, Math.max(bounds.x, view.x)),
    y: Math.min(maxY, Math.max(bounds.y, view.y)),
    width: view.width,
    height: view.height
  };
}

function centerOf(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function containsPoint(rect, point) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function intersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export default createLevel2D25DGameplayLoop;
