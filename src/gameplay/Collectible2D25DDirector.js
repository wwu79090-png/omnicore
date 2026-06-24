export const COLLECTIBLE_2D_25D_SCHEMA = 'omnicore.collectible-2d-25d-director.v1';

/**
 * Builds one collectible director step for 2D/2.5D games.
 */
export function createCollectible2D25DDirectorStep(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const actor = normalizeActor(config.actor || {});
  const collectibles = normalizeCollectibles(config.collectibles || []);
  const dropSources = normalizeDropSources(config.dropSources || []);
  const drops = buildDropState(dropSources);
  const pickups = buildPickupState({ actor, collectibles });
  const magnet = buildMagnetState({
    actor,
    collectibles,
    pickups,
    magnet: normalizeMagnet(config.magnet || {}),
    delta
  });
  const inventory = buildInventoryState(actor, pickups.events);
  const score = buildScoreState(actor, pickups.events, config.combo || {});
  const combo = buildComboState(config.combo || {}, pickups.events);
  const lifetime = buildLifetimeState(pickups.events);
  const effects = buildEffectsState(pickups.events);
  const events = buildEventsState({ drops, pickups, inventory, score });
  const editor = buildEditorState();
  const runtimeSync = buildRuntimeSyncState();
  const debugDraw = buildDebugDraw({ collectibles, drops, magnet, pickups, inventory });
  const quality = buildQualityChecks({ drops, magnet, pickups, inventory, effects, editor, runtimeSync });

  return {
    schema: COLLECTIBLE_2D_25D_SCHEMA,
    delta,
    actor,
    collectibles,
    dropSources,
    drops,
    magnet,
    pickups,
    inventory,
    score,
    combo,
    lifetime,
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
    center: centerOf(rect),
    inventory: { ...(actor.inventory || {}) },
    score: Math.max(0, numberOr(actor.score, 0))
  };
}

function normalizeCollectibles(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((collectible, index) => {
    const rect = normalizeRect(collectible);
    return {
      ...collectible,
      id: collectible.id || `collectible-${index}`,
      type: collectible.type || 'item',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      center: centerOf(rect),
      inventoryKey: collectible.inventoryKey || collectible.type || 'items',
      amount: Math.max(0, numberOr(collectible.amount, collectible.value ?? 1)),
      score: Math.max(0, numberOr(collectible.score, 0)),
      pickupRadius: Math.max(0, numberOr(collectible.pickupRadius, 16)),
      magnetizable: collectible.magnetizable !== false,
      enabled: collectible.enabled !== false,
      feedback: {
        particle: collectible.feedback?.particle || `${collectible.type || 'item'}-pickup`,
        audio: collectible.feedback?.audio || `${collectible.type || 'item'}-pickup`
      }
    };
  });
}

function normalizeDropSources(input) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((source, index) => ({
    id: source.id || `drop-source-${index}`,
    defeated: source.defeated === true,
    x: numberOr(source.x, 0),
    y: numberOr(source.y, 0),
    drops: (Array.isArray(source.drops) ? source.drops : []).map((drop, dropIndex) => ({
      id: drop.id || `drop-${dropIndex}`,
      type: drop.type || 'item',
      inventoryKey: drop.inventoryKey || drop.type || 'items',
      amount: Math.max(0, numberOr(drop.amount, 1)),
      chance: numberOr(drop.chance, 1),
      score: Math.max(0, numberOr(drop.score, 0)),
      width: Math.max(1, numberOr(drop.width, 10)),
      height: Math.max(1, numberOr(drop.height, 10))
    }))
  }));
}

function normalizeMagnet(magnet = {}) {
  return {
    enabled: magnet.enabled === true,
    radius: Math.max(0, numberOr(magnet.radius, 0)),
    strength: Math.max(0, numberOr(magnet.strength, 0))
  };
}

function buildDropState(dropSources) {
  const spawnCommands = [];
  for (const source of dropSources) {
    if (!source.defeated) continue;
    for (const drop of source.drops) {
      if (drop.chance < 1) continue;
      spawnCommands.push({
        id: `${source.id}:${drop.id}`,
        sourceId: source.id,
        collectibleId: drop.id,
        type: drop.type,
        inventoryKey: drop.inventoryKey,
        amount: drop.amount,
        score: drop.score,
        x: source.x,
        y: source.y,
        width: drop.width,
        height: drop.height
      });
    }
  }
  return {
    spawnCommands,
    sourceCount: dropSources.length
  };
}

function buildPickupState({ actor, collectibles }) {
  const events = collectibles
    .filter((collectible) => collectible.enabled)
    .filter((collectible) => isPickupReady(actor, collectible))
    .map((collectible) => ({
      id: `${collectible.id}:${actor.id}`,
      collectibleId: collectible.id,
      actorId: actor.id,
      type: collectible.type,
      inventoryKey: collectible.inventoryKey,
      amount: collectible.amount,
      score: collectible.score,
      point: {
        x: collectible.center.x,
        y: collectible.center.y
      },
      feedback: { ...collectible.feedback }
    }));

  return {
    events,
    pickedIds: events.map((event) => event.collectibleId)
  };
}

function buildMagnetState({ actor, collectibles, pickups, magnet, delta }) {
  if (!magnet.enabled || magnet.radius <= 0 || magnet.strength <= 0) {
    return { enabled: magnet.enabled, radius: magnet.radius, targets: [], motionCommands: [] };
  }
  const pickedIds = new Set(pickups.pickedIds);
  const targets = collectibles
    .filter((collectible) => collectible.enabled && collectible.magnetizable && !pickedIds.has(collectible.id))
    .map((collectible) => {
      const distance = round(distanceBetween(actor.center, collectible.center));
      return {
        collectibleId: collectible.id,
        actorId: actor.id,
        distance,
        inRange: distance <= magnet.radius
      };
    })
    .filter((target) => target.inRange);

  return {
    enabled: true,
    radius: magnet.radius,
    strength: magnet.strength,
    targets,
    motionCommands: targets.map((target) => {
      const collectible = collectibles.find((item) => item.id === target.collectibleId);
      const direction = normalizeVector({
        x: actor.center.x - collectible.center.x,
        y: actor.center.y - collectible.center.y
      });
      return {
        collectibleId: collectible.id,
        actorId: actor.id,
        velocity: {
          x: round(direction.x * magnet.strength),
          y: round(direction.y * magnet.strength)
        },
        next: {
          x: round(collectible.x + direction.x * magnet.strength * delta),
          y: round(collectible.y + direction.y * magnet.strength * delta)
        }
      };
    })
  };
}

function buildInventoryState(actor, pickupEvents) {
  const totals = { ...actor.inventory };
  const deltas = pickupEvents.map((event) => {
    totals[event.inventoryKey] = numberOr(totals[event.inventoryKey], 0) + event.amount;
    return {
      itemId: event.inventoryKey,
      amount: event.amount,
      sourceId: event.collectibleId
    };
  });

  return {
    actorId: actor.id,
    deltas,
    totals
  };
}

function buildScoreState(actor, pickupEvents, comboInput) {
  const base = pickupEvents.reduce((sum, event) => sum + event.score, 0);
  const multiplier = Math.max(1, numberOr(comboInput.multiplier, 1));
  const awarded = Math.round(base * multiplier);
  return {
    actorId: actor.id,
    base,
    multiplier,
    awarded,
    total: actor.score + awarded
  };
}

function buildComboState(comboInput, pickupEvents) {
  const previousStreak = Math.max(0, Math.floor(numberOr(comboInput.streak, 0)));
  return {
    previousStreak,
    nextStreak: previousStreak + pickupEvents.length,
    multiplier: Math.max(1, numberOr(comboInput.multiplier, 1)),
    refreshedMs: pickupEvents.length > 0 ? Math.max(0, numberOr(comboInput.windowMs, 0)) : 0
  };
}

function buildLifetimeState(pickupEvents) {
  return {
    despawnCommands: pickupEvents.map((event) => ({
      collectibleId: event.collectibleId,
      reason: 'picked-up'
    }))
  };
}

function buildEffectsState(pickupEvents) {
  return {
    applied: pickupEvents.flatMap((event) => [
      {
        type: 'pickup-particle',
        preset: event.feedback.particle,
        collectibleId: event.collectibleId,
        point: event.point
      },
      {
        type: 'pickup-audio',
        cue: event.feedback.audio,
        collectibleId: event.collectibleId
      },
      {
        type: 'hud-toast',
        collectibleId: event.collectibleId,
        text: `+${event.amount} ${event.inventoryKey}`
      }
    ])
  };
}

function buildEventsState({ drops, pickups, inventory, score }) {
  return {
    queue: [
      ...drops.spawnCommands.map((command) => ({
        type: 'collectible:drop-spawn',
        sourceId: command.sourceId,
        collectibleId: command.collectibleId
      })),
      ...pickups.events.map((event) => ({
        type: 'collectible:pickup',
        collectibleId: event.collectibleId,
        actorId: event.actorId
      })),
      ...inventory.deltas.map((delta) => ({
        type: 'inventory:delta',
        itemId: delta.itemId,
        amount: delta.amount,
        sourceId: delta.sourceId
      })),
      ...(score.awarded > 0 ? [{
        type: 'score:add',
        actorId: score.actorId,
        amount: score.awarded
      }] : [])
    ]
  };
}

function buildEditorState() {
  return {
    format: 'omnicore.collectible-2d25d-editor.v1',
    panels: [
      'CollectibleDirector',
      'PickupRules',
      'Magnet',
      'InventoryDeltas',
      'DropTables',
      'ComboRewards',
      'RuntimeDebug'
    ],
    tools: [
      'PickupRadiusTool',
      'MagnetRadiusPreview',
      'DropTableInspector',
      'InventoryDeltaPreview',
      'ComboRewardTuning'
    ],
    hotReloadTopics: [
      'collectible:changed',
      'pickup-rule:changed',
      'magnet:changed',
      'drop-table:changed',
      'combo-reward:changed'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.collectible-2d25d/v1',
    payloads: [
      'collectibles',
      'drops',
      'magnet',
      'pickups',
      'inventory',
      'combo',
      'effects',
      'events',
      'editor'
    ],
    events: [
      'collectible:drop-spawn',
      'collectible:pickup',
      'collectible:magnet',
      'inventory:delta',
      'score:add',
      'combo:refresh'
    ]
  };
}

function buildDebugDraw({ collectibles, drops, magnet, pickups, inventory }) {
  return [
    ...collectibles.map((collectible) => ({
      op: 'debug:collectible-hitbox',
      collectibleId: collectible.id,
      type: collectible.type,
      x: collectible.x,
      y: collectible.y,
      width: collectible.width,
      height: collectible.height,
      pickupRadius: collectible.pickupRadius
    })),
    ...magnet.targets.map((target) => ({
      op: 'debug:collectible-magnet',
      ...target
    })),
    ...pickups.events.map((event) => ({
      op: 'debug:collectible-pickup',
      collectibleId: event.collectibleId,
      actorId: event.actorId,
      point: event.point
    })),
    ...inventory.deltas.map((delta) => ({
      op: 'debug:inventory-delta',
      ...delta
    })),
    ...drops.spawnCommands.map((command) => ({
      op: 'debug:collectible-drop-spawn',
      ...command
    }))
  ];
}

function buildQualityChecks({ drops, magnet, pickups, inventory, effects, editor, runtimeSync }) {
  return {
    checks: [
      {
        id: 'collectible-pickup',
        pass: pickups.events.length > 0,
        detail: `${pickups.events.length} pickups`
      },
      {
        id: 'collectible-magnet',
        pass: magnet.targets.length > 0,
        detail: `${magnet.targets.length} targets`
      },
      {
        id: 'drop-spawn',
        pass: drops.spawnCommands.length > 0,
        detail: `${drops.spawnCommands.length} drops`
      },
      {
        id: 'inventory-delta',
        pass: inventory.deltas.length > 0,
        detail: `${inventory.deltas.length} deltas`
      },
      {
        id: 'reward-feedback',
        pass: effects.applied.length > 0,
        detail: `${effects.applied.length} effects`
      },
      {
        id: 'editor-runtime-collectible-sync',
        pass: editor.panels.length > 0 && runtimeSync.payloads.includes('inventory'),
        detail: runtimeSync.protocol
      }
    ]
  };
}

function isPickupReady(actor, collectible) {
  if (rectIntersects(actor, collectible)) return true;
  return distanceBetween(actor.center, collectible.center) <= collectible.pickupRadius;
}

function normalizeRect(rect = {}) {
  return {
    x: numberOr(rect.x, 0),
    y: numberOr(rect.y, 0),
    width: Math.max(0, numberOr(rect.width ?? rect.w, 0)),
    height: Math.max(0, numberOr(rect.height ?? rect.h, 0))
  };
}

function centerOf(rect) {
  return {
    x: numberOr(rect.x, 0) + numberOr(rect.width, 0) / 2,
    y: numberOr(rect.y, 0) + numberOr(rect.height, 0) / 2
  };
}

function rectIntersects(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

function distanceBetween(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function normalizeVector(vector = {}) {
  const x = numberOr(vector.x, 0);
  const y = numberOr(vector.y, 0);
  const length = Math.hypot(x, y);
  if (length <= 0.000001) return { x: 0, y: 0 };
  return {
    x: x / length,
    y: y / length
  };
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value) {
  return Math.round(numberOr(value, 0) * 1000) / 1000;
}

export default createCollectible2D25DDirectorStep;
