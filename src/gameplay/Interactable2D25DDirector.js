export const INTERACTABLE_2D_25D_SCHEMA = 'omnicore.interactable-2d-25d-director.v1';

/**
 * Builds one interactable director step for 2D/2.5D games.
 */
export function createInteractable2D25DDirectorStep(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const player = normalizePlayer(config.player || {});
  const input = normalizeInput(config.input || {});
  const worldState = normalizeWorldState(config.worldState || {});
  const interactables = normalizeInteractables(config.interactables || [], worldState);
  const prompts = buildPromptState({ player, interactables });
  const interactions = buildInteractionState({ input, prompts, interactables });
  const resolved = resolveInteractionOutputs({ player, interactions });
  const editor = buildEditorState();
  const runtimeSync = buildRuntimeSyncState();
  const debugDraw = buildDebugDraw({ interactables, prompts, effects: resolved.effects, stateUpdates: resolved.stateUpdates });
  const quality = buildQualityChecks({ prompts, interactions, stateUpdates: resolved.stateUpdates, events: resolved.events, editor, runtimeSync });

  return {
    schema: INTERACTABLE_2D_25D_SCHEMA,
    delta,
    player,
    input,
    worldState,
    interactables,
    prompts,
    interactions,
    stateUpdates: resolved.stateUpdates,
    effects: resolved.effects,
    events: resolved.events,
    editor,
    runtimeSync,
    debugDraw,
    quality
  };
}

function normalizePlayer(player = {}) {
  const rect = normalizeRect(player);
  return {
    ...player,
    id: player.id || player.name || 'player',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    facing: player.facing || 'right',
    inventory: { ...(player.inventory || {}) },
    center: centerOf(rect)
  };
}

function normalizeInput(input = {}) {
  const interactTargetIds = Array.isArray(input.interactTargetIds)
    ? input.interactTargetIds.filter(Boolean)
    : input.interactTargetId
      ? [input.interactTargetId]
      : [];
  return {
    interactPressed: input.interactPressed === true,
    interactTargetIds
  };
}

function normalizeWorldState(worldState = {}) {
  return {
    switches: { ...(worldState.switches || {}) },
    doors: { ...(worldState.doors || {}) },
    chests: { ...(worldState.chests || {}) },
    checkpoints: { ...(worldState.checkpoints || {}) },
    flags: { ...(worldState.flags || {}) }
  };
}

function normalizeInteractables(input, worldState) {
  return (Array.isArray(input) ? input : [input]).filter(Boolean).map((interactable, index) => {
    const rect = normalizeRect(interactable);
    const id = interactable.id || `interactable-${index}`;
    const type = interactable.type || 'interactable';
    const state = resolveInteractableState(id, type, interactable, worldState);
    return {
      ...interactable,
      id,
      type,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      center: centerOf(rect),
      radius: Math.max(0, numberOr(interactable.radius, 40)),
      prompt: interactable.prompt || defaultPromptFor(type),
      priority: numberOr(interactable.priority, defaultPriorityFor(type)),
      enabled: interactable.enabled !== false,
      auto: interactable.auto === true,
      active: state.active,
      locked: state.locked,
      open: state.open,
      opened: state.opened,
      effects: Array.isArray(interactable.effects) ? interactable.effects.map((effect) => ({ ...effect })) : [],
      loot: Array.isArray(interactable.loot) ? interactable.loot.map((item) => ({ ...item })) : [],
      transition: interactable.transition ? { ...interactable.transition } : null,
      respawn: interactable.respawn ? normalizePoint(interactable.respawn) : null,
      dialogue: interactable.dialogue || null
    };
  });
}

function resolveInteractableState(id, type, interactable, worldState) {
  if (type === 'switch') {
    return {
      active: Boolean(worldState.switches[id] ?? interactable.active),
      locked: false,
      open: false,
      opened: false
    };
  }
  if (type === 'door') {
    const door = worldState.doors[id] || {};
    return {
      active: false,
      locked: Boolean(door.locked ?? interactable.locked),
      open: Boolean(door.open ?? interactable.open),
      opened: false
    };
  }
  if (type === 'chest') {
    const chest = worldState.chests[id] || {};
    return {
      active: false,
      locked: Boolean(chest.locked ?? interactable.locked),
      open: false,
      opened: Boolean(chest.opened ?? interactable.opened)
    };
  }
  return {
    active: Boolean(interactable.active),
    locked: Boolean(interactable.locked),
    open: Boolean(interactable.open),
    opened: Boolean(interactable.opened)
  };
}

function buildPromptState({ player, interactables }) {
  const ready = interactables
    .map((interactable) => {
      const distance = round(distanceBetween(player.center, interactable.center));
      const inRange = distance <= interactable.radius || rectIntersects(player, interactable);
      const locked = interactable.locked === true;
      const consumed = interactable.type === 'chest' && interactable.opened;
      const available = interactable.enabled && inRange && !locked && !consumed;
      return {
        interactableId: interactable.id,
        type: interactable.type,
        prompt: interactable.prompt,
        distance,
        radius: interactable.radius,
        priority: interactable.priority,
        locked,
        available,
        automatic: interactable.auto,
        input: interactable.auto ? 'auto' : 'interact'
      };
    })
    .filter((prompt) => prompt.distance <= prompt.radius || prompt.automatic)
    .sort((left, right) => right.priority - left.priority || left.distance - right.distance);

  return {
    ready,
    nearest: ready.find((prompt) => prompt.available && !prompt.automatic) || null,
    blocked: ready.filter((prompt) => !prompt.available)
  };
}

function buildInteractionState({ input, prompts, interactables }) {
  const promptById = new Map(prompts.ready.map((prompt) => [prompt.interactableId, prompt]));
  const interactableById = new Map(interactables.map((interactable) => [interactable.id, interactable]));
  const targetIds = input.interactTargetIds.length > 0
    ? input.interactTargetIds
    : input.interactPressed && prompts.nearest
      ? [prompts.nearest.interactableId]
      : [];
  const autoTargetIds = prompts.ready
    .filter((prompt) => prompt.automatic && prompt.available)
    .map((prompt) => prompt.interactableId);

  const activated = [];
  const blocked = [];
  for (const targetId of unique([...targetIds, ...autoTargetIds])) {
    const prompt = promptById.get(targetId);
    const interactable = interactableById.get(targetId);
    if (!prompt || !interactable) continue;
    if (!prompt.available) {
      blocked.push({
        interactableId: targetId,
        reason: prompt.locked ? 'locked' : 'unavailable'
      });
      continue;
    }
    if (!prompt.automatic && !input.interactPressed) continue;
    activated.push({
      interactableId: targetId,
      type: interactable.type,
      action: actionFor(interactable),
      automatic: prompt.automatic,
      prompt: prompt.prompt,
      active: interactable.active,
      effects: interactable.effects.map((effect) => ({ ...effect })),
      loot: interactable.loot.map((item) => ({ ...item })),
      transition: interactable.transition ? { ...interactable.transition } : null,
      respawn: interactable.respawn ? { ...interactable.respawn } : null,
      dialogue: interactable.dialogue
    });
  }

  return {
    activated,
    blocked,
    requestedTargetIds: targetIds,
    autoTargetIds
  };
}

function resolveInteractionOutputs({ player, interactions }) {
  const stateUpdates = {
    switches: [],
    doors: [],
    chests: [],
    dialogue: [],
    inventoryDeltas: [],
    checkpoint: null
  };
  const effects = { applied: [] };
  const events = { queue: [] };

  for (const activation of interactions.activated) {
    if (activation.type === 'switch') {
      resolveSwitchActivation({ activation, stateUpdates, effects, events });
    } else if (activation.type === 'door') {
      resolveDoorActivation({ activation, stateUpdates, events });
    } else if (activation.type === 'chest') {
      resolveChestActivation({ player, activation, stateUpdates, effects, events });
    } else if (activation.type === 'npc') {
      resolveNpcActivation({ activation, stateUpdates, events });
    } else if (activation.type === 'checkpoint') {
      resolveCheckpointActivation({ activation, stateUpdates, events });
    } else {
      events.queue.push({
        type: 'interactable:activate',
        interactableId: activation.interactableId,
        action: activation.action
      });
    }
  }

  return { stateUpdates, effects, events };
}

function resolveSwitchActivation({ activation, stateUpdates, effects, events }) {
  stateUpdates.switches.push({
    switchId: activation.interactableId,
    active: !activation.active,
    sourceId: activation.interactableId
  });
  events.queue.push({
    type: 'interactable:switch-toggle',
    interactableId: activation.interactableId,
    active: !activation.active
  });

  for (const effect of activation.effects) {
    const applied = {
      ...effect,
      sourceId: activation.interactableId
    };
    effects.applied.push(applied);
    if (effect.type === 'set-state' && effect.domain === 'doors') {
      stateUpdates.doors.push({
        doorId: effect.targetId,
        [effect.key]: effect.value,
        sourceId: activation.interactableId
      });
    }
    if (effect.type === 'emit-event') {
      events.queue.push({
        type: effect.event,
        targetId: effect.targetId,
        sourceId: activation.interactableId
      });
    }
  }
}

function resolveDoorActivation({ activation, stateUpdates, events }) {
  stateUpdates.doors.push({
    doorId: activation.interactableId,
    open: true,
    sourceId: activation.interactableId
  });
  events.queue.push({
    type: 'interactable:door-open',
    interactableId: activation.interactableId,
    transition: activation.transition || null
  });
}

function resolveChestActivation({ player, activation, stateUpdates, effects, events }) {
  stateUpdates.chests.push({
    chestId: activation.interactableId,
    opened: true,
    sourceId: activation.interactableId
  });
  events.queue.push({
    type: 'interactable:chest-open',
    interactableId: activation.interactableId
  });

  for (const item of activation.loot) {
    const amount = numberOr(item.amount, 1);
    stateUpdates.inventoryDeltas.push({
      itemId: item.id,
      amount,
      sourceId: activation.interactableId
    });
    effects.applied.push({
      type: 'grant-loot',
      targetId: player.id,
      itemId: item.id,
      amount,
      sourceId: activation.interactableId
    });
    events.queue.push({
      type: 'interactable:loot-grant',
      interactableId: activation.interactableId,
      itemId: item.id,
      amount
    });
  }
}

function resolveNpcActivation({ activation, stateUpdates, events }) {
  stateUpdates.dialogue.push({
    npcId: activation.interactableId,
    dialogue: activation.dialogue || null
  });
  events.queue.push({
    type: 'interactable:dialogue-start',
    interactableId: activation.interactableId,
    dialogue: activation.dialogue || null
  });
}

function resolveCheckpointActivation({ activation, stateUpdates, events }) {
  const respawn = activation.respawn || { x: 0, y: 0 };
  stateUpdates.checkpoint = {
    checkpointId: activation.interactableId,
    respawn
  };
  events.queue.push({
    type: 'interactable:checkpoint-save',
    interactableId: activation.interactableId,
    respawn
  });
}

function buildEditorState() {
  return {
    format: 'omnicore.interactable-2d25d-editor.v1',
    panels: [
      'InteractableDirector',
      'Prompts',
      'Switches',
      'Doors',
      'Chests',
      'Dialogue',
      'Checkpoints',
      'RuntimeDebug'
    ],
    tools: [
      'PromptRadiusTool',
      'SwitchDoorLinker',
      'ChestLootInspector',
      'DialoguePreview',
      'CheckpointPreview'
    ],
    hotReloadTopics: [
      'interactable:changed',
      'prompt:changed',
      'door-link:changed',
      'chest-loot:changed',
      'checkpoint:changed'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.interactable-2d25d/v1',
    payloads: [
      'prompts',
      'interactions',
      'stateUpdates',
      'effects',
      'events',
      'editor'
    ],
    events: [
      'interactable:prompt-ready',
      'interactable:activate',
      'interactable:switch-toggle',
      'interactable:door-open',
      'interactable:chest-open',
      'interactable:checkpoint-save'
    ]
  };
}

function buildDebugDraw({ interactables, prompts, effects, stateUpdates }) {
  return [
    ...interactables.map((interactable) => ({
      op: 'debug:interaction-radius',
      interactableId: interactable.id,
      type: interactable.type,
      x: interactable.center.x,
      y: interactable.center.y,
      radius: interactable.radius
    })),
    ...prompts.ready.map((prompt) => ({
      op: 'debug:interaction-prompt',
      interactableId: prompt.interactableId,
      type: prompt.type,
      available: prompt.available,
      locked: prompt.locked,
      prompt: prompt.prompt
    })),
    ...effects.applied.map((effect) => ({
      op: 'debug:interaction-effect',
      ...effect
    })),
    ...(stateUpdates.checkpoint ? [{
      op: 'debug:checkpoint',
      checkpointId: stateUpdates.checkpoint.checkpointId,
      respawn: stateUpdates.checkpoint.respawn
    }] : [])
  ];
}

function buildQualityChecks({ prompts, interactions, stateUpdates, events, editor, runtimeSync }) {
  return {
    checks: [
      {
        id: 'interaction-prompts',
        pass: prompts.ready.length > 0,
        detail: `${prompts.ready.length} ready`
      },
      {
        id: 'interaction-activation',
        pass: interactions.activated.length > 0,
        detail: `${interactions.activated.length} activated`
      },
      {
        id: 'interaction-state-updates',
        pass: hasStateUpdates(stateUpdates),
        detail: `${stateUpdates.switches.length + stateUpdates.doors.length + stateUpdates.chests.length + stateUpdates.inventoryDeltas.length} updates`
      },
      {
        id: 'interaction-events',
        pass: events.queue.length > 0,
        detail: `${events.queue.length} events`
      },
      {
        id: 'editor-runtime-interaction-sync',
        pass: editor.panels.length > 0 && runtimeSync.payloads.includes('stateUpdates'),
        detail: runtimeSync.protocol
      }
    ]
  };
}

function hasStateUpdates(stateUpdates) {
  return stateUpdates.switches.length > 0
    || stateUpdates.doors.length > 0
    || stateUpdates.chests.length > 0
    || stateUpdates.dialogue.length > 0
    || stateUpdates.inventoryDeltas.length > 0
    || Boolean(stateUpdates.checkpoint);
}

function actionFor(interactable) {
  if (interactable.type === 'switch') return 'toggle-switch';
  if (interactable.type === 'door') return 'open-door';
  if (interactable.type === 'chest') return 'open-chest';
  if (interactable.type === 'npc') return 'start-dialogue';
  if (interactable.type === 'checkpoint') return 'save-checkpoint';
  return 'activate';
}

function defaultPromptFor(type) {
  if (type === 'switch') return 'Use';
  if (type === 'door') return 'Open';
  if (type === 'chest') return 'Open';
  if (type === 'npc') return 'Talk';
  if (type === 'checkpoint') return 'Save';
  return 'Interact';
}

function defaultPriorityFor(type) {
  if (type === 'checkpoint') return 20;
  if (type === 'switch') return 10;
  if (type === 'chest') return 8;
  if (type === 'door') return 6;
  if (type === 'npc') return 5;
  return 1;
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

function unique(values) {
  return [...new Set(values)];
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value) {
  return Math.round(numberOr(value, 0) * 1000) / 1000;
}

export default createInteractable2D25DDirectorStep;
