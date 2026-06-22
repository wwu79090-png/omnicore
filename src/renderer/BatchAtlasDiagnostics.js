export class BatchAtlasDiagnostics {
  analyze(draws = []) {
    const normalized = draws.map(normalizeDraw);
    const batchBreaks = [];

    for (let index = 1; index < normalized.length; index += 1) {
      const previous = normalized[index - 1];
      const current = normalized[index];
      const reason = breakReason(previous, current);
      if (reason) {
        batchBreaks.push({
          from: previous.id,
          to: current.id,
          reason
        });
      }
    }
    for (const draw of normalized.filter((entry) => entry.dynamic)) {
      batchBreaks.push({ from: draw.id, to: draw.id, reason: 'dynamic-sprite' });
    }

    const atlasCandidates = buildAtlasCandidates(normalized);
    const predictedDrawCallsAfter = Math.max(1, normalized.length - Math.min(1, atlasCandidates.length));
    return {
      drawCallsBefore: normalized.length,
      predictedDrawCallsAfter,
      materialSwitches: batchBreaks.length,
      batchBreaks,
      atlasCandidates,
      recommendations: buildRecommendations({ atlasCandidates, materialSwitches: batchBreaks.length, normalized })
    };
  }
}

function normalizeDraw(draw, index) {
  const item = draw || {};
  return {
    id: String(item.id || item.name || `draw-${index}`),
    texture: String(item.texture || item.textureKey || item.sprite || 'texture'),
    material: String(item.material || item.shader || 'default'),
    blendMode: String(item.blendMode || 'normal'),
    dynamic: Boolean(item.dynamic || item.animated || item.video)
  };
}

function breakReason(previous, current) {
  if (current.dynamic) return null;
  if (previous.material !== current.material || previous.blendMode !== current.blendMode) return 'material-switch';
  if (previous.texture !== current.texture) return 'texture-switch';
  return null;
}

function buildAtlasCandidates(draws) {
  const groups = new Map();
  for (const draw of draws.filter((entry) => !entry.dynamic)) {
    const key = `${draw.material}|${draw.blendMode}`;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(draw.texture);
  }
  return [...groups.entries()]
    .map(([key, textures]) => ({
      key,
      textures: [...textures].sort(),
      spriteCount: [...textures].length
    }))
    .filter((group) => group.spriteCount >= 3)
    .sort((left, right) => right.spriteCount - left.spriteCount || left.key.localeCompare(right.key));
}

function buildRecommendations({ atlasCandidates, materialSwitches, normalized }) {
  const recommendations = [];
  for (const group of atlasCandidates) recommendations.push(`createAtlas:${group.key}`);
  if (materialSwitches > 0) recommendations.push('sortByMaterialTexture');
  if (normalized.some((draw) => draw.dynamic)) recommendations.push('keepDynamicSpritesOutOfStaticBatches');
  return recommendations;
}

export default BatchAtlasDiagnostics;
