function commandBatchKey(command = {}) {
  return [
    command.layer || 'default',
    command.texture || command.atlas || command.atlasKey || 'none',
    command.material || command.shader || 'default',
    command.blendMode || 'normal',
    command.pipeline || command.pluginName || 'default'
  ].join('|');
}

function commandLayerOrder(command, fallback) {
  const safeCommand = command || {};
  const explicit = safeCommand.layerOrder ?? safeCommand.renderLayerOrder ?? safeCommand.zLayer;
  if (Number.isFinite(Number(explicit))) return Number(explicit);
  const layer = String(safeCommand.layer || 'default');
  const known = {
    background: 0,
    bg: 0,
    world: 10,
    gameplay: 10,
    fx: 20,
    effects: 20,
    ui: 30,
    hud: 30,
    overlay: 40
  };
  return known[layer] ?? fallback;
}

function isBarrier(command = {}) {
  return Boolean(command.mask || command.filters?.length || command.blockBatching || command.canReorder === false);
}

function drawCallsFor(commands = []) {
  let previous = null;
  let count = 0;
  for (const command of commands) {
    const key = isBarrier(command) ? `barrier:${command.id ?? count}` : commandBatchKey(command);
    if (key !== previous) count += 1;
    previous = key;
  }
  return count;
}

function buildGroups(commands = []) {
  const groups = [];
  for (const command of commands) {
    const batchKey = isBarrier(command) ? `barrier:${command.id ?? groups.length}` : commandBatchKey(command);
    const last = groups[groups.length - 1];
    if (!last || last.batchKey !== batchKey) {
      groups.push({
        batchKey,
        layer: command.layer || 'default',
        texture: command.texture || command.atlas || command.atlasKey || null,
        material: command.material || command.shader || 'default',
        blendMode: command.blendMode || 'normal',
        commandIds: [],
        spriteCount: 0
      });
    }
    const group = groups[groups.length - 1];
    group.commandIds.push(command.id ?? command.commandId ?? group.commandIds.length);
    group.spriteCount += 1;
  }
  return groups;
}

function optimizeSegment(segment) {
  return [...segment].sort((left, right) => {
    const leftKey = commandBatchKey(left);
    const rightKey = commandBatchKey(right);
    if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
    return (left.__omnicoreOriginalIndex || 0) - (right.__omnicoreOriginalIndex || 0);
  });
}

/**
 * Reorders safe render commands inside the same layer so identical render
 * state becomes consecutive. Mask/filter/barrier commands keep their position.
 */
export function optimizeRenderQueueForBatching(commands = []) {
  const normalized = commands.map((command, index) => ({
    ...command,
    __omnicoreOriginalIndex: index,
    __omnicoreLayerOrder: commandLayerOrder(command, index)
  }));
  const byLayer = [...normalized].sort((left, right) => {
    if (left.__omnicoreLayerOrder !== right.__omnicoreLayerOrder) {
      return left.__omnicoreLayerOrder - right.__omnicoreLayerOrder;
    }
    return (left.zIndex || 0) - (right.zIndex || 0) || left.__omnicoreOriginalIndex - right.__omnicoreOriginalIndex;
  });

  const optimized = [];
  let segment = [];
  let segmentLayer = null;
  const flush = () => {
    if (!segment.length) return;
    optimized.push(...optimizeSegment(segment));
    segment = [];
    segmentLayer = null;
  };

  for (const command of byLayer) {
    if (segmentLayer !== null && command.layer !== segmentLayer) flush();
    if (isBarrier(command)) {
      flush();
      optimized.push(command);
      continue;
    }
    segmentLayer = command.layer || 'default';
    segment.push(command);
  }
  flush();

  const stripped = optimized.map(({ __omnicoreOriginalIndex, __omnicoreLayerOrder, ...command }) => command);
  const beforeDrawCalls = drawCallsFor(normalized);
  const afterDrawCalls = drawCallsFor(stripped);
  return {
    commands: stripped,
    groups: buildGroups(stripped),
    beforeDrawCalls,
    afterDrawCalls,
    savedDrawCalls: Math.max(0, beforeDrawCalls - afterDrawCalls)
  };
}

export default optimizeRenderQueueForBatching;
