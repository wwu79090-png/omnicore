export class PixiRenderHardeningProfile {
  guardFrame(options = {}) {
    const frame = Number(options.frame) || 0;
    const backend = String(options.backend || 'webgl');
    const textureIdleFrames = Number(options.textureIdleFrames) || Infinity;
    const textures = normalizeArray(options.textures);
    const filters = normalizeArray(options.filters);
    const textureGc = textures
      .filter((texture) => frame - (Number(texture.lastUsedFrame) || 0) >= textureIdleFrames)
      .map((texture) => String(texture.id));
    const warnings = [];
    const recommendations = [];

    if (Number(options.drawCalls) > Number(options.drawCallBudget || Infinity)) {
      warnings.push('draw-call-budget');
      recommendations.push('enableBatchAtlasDiagnostics');
    }
    for (const textureId of textureGc) recommendations.push(`runTextureGc:${textureId}`);
    const filterCost = filters.reduce((total, filter) => total + (Number(filter.cost) || 0), 0);
    if (filterCost > Number(options.filterBudget || Infinity)) {
      warnings.push('filter-budget');
      recommendations.push('collapseFilterChain');
    }

    return {
      backend,
      resetSequence: buildResetSequence(options.mixedRenderers),
      textureGc,
      warnings,
      recommendations
    };
  }
}

function buildResetSequence(mixedRenderers = []) {
  const renderers = new Set(normalizeArray(mixedRenderers).map(String));
  const sequence = [];
  if (renderers.has('three')) sequence.push('three.resetState');
  if (renderers.has('pixi')) sequence.push('pixi.resetState');
  else if (renderers.size > 0) sequence.push('pixi.resetState');
  sequence.push('pixi.render');
  return sequence;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default PixiRenderHardeningProfile;
