const BATCH_KEYS = ['texture', 'blendMode', 'shader', 'mask', 'material', 'layer'];

export function diagnoseBatchBreaks(commands = []) {
  const normalized = commands.map(normalizeCommand);
  const breaks = [];
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    for (const key of BATCH_KEYS) {
      if (previous[key] !== current[key]) {
        breaks.push({
          index,
          from: previous.id,
          to: current.id,
          reason: key,
          previous: previous[key],
          current: current[key]
        });
      }
    }
  }
  const reasonCounts = breaks.reduce((result, item) => {
    result[item.reason] = (result[item.reason] || 0) + 1;
    return result;
  }, {});
  return {
    format: 'OmniCore.BatchDiagnostics',
    version: 1,
    drawCommands: normalized.length,
    breakCount: breaks.length,
    reasonCounts,
    breaks,
    suggestions: buildSuggestions(reasonCounts)
  };
}

function normalizeCommand(command = {}, index = 0) {
  return {
    id: command.id || `draw-${index}`,
    texture: command.texture || 'none',
    blendMode: command.blendMode || 'normal',
    shader: command.shader || command.materialShader || 'sprite',
    mask: command.mask || 'none',
    material: command.material || 'default',
    layer: command.layer || command.renderLayer || 'default'
  };
}

function buildSuggestions(reasonCounts) {
  const suggestions = [];
  if (reasonCounts.texture) suggestions.push('Merge small textures into one atlas and keep sprite texture keys adjacent.');
  if (reasonCounts.blendMode) suggestions.push('Group additive/normal blend modes into separate render passes.');
  if (reasonCounts.shader) suggestions.push('Avoid switching custom shaders inside dense sprite runs.');
  if (reasonCounts.mask) suggestions.push('Masks often force batch breaks; pre-bake simple masks when possible.');
  if (reasonCounts.material) suggestions.push('Sort by material or collapse equivalent material states.');
  if (reasonCounts.layer) suggestions.push('Keep world, fx, and UI layers explicit so layer switches are intentional.');
  return suggestions;
}

export default diagnoseBatchBreaks;
