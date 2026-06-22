export class RenderFeatureProfile {
  constructor({
    id = 'default',
    quality = 'high',
    features = {},
    budgets = {},
    materialVariant = 'default'
  } = {}) {
    this.id = String(id);
    this.quality = quality;
    this.features = clone(features || {});
    this.budgets = clone(budgets || {});
    this.materialVariant = materialVariant;
  }

  applyTo({ materials = [] } = {}) {
    return {
      id: this.id,
      quality: this.quality,
      features: clone(this.features),
      budgets: clone(this.budgets),
      materials: materials.map((material) => (
        typeof material.resolve === 'function' ? material.resolve(this.materialVariant) : material
      ))
    };
  }

  validate(metrics = {}) {
    const warnings = [];
    if (this.budgets.textureMB != null && Number(metrics.estimatedTextureMB || 0) > Number(this.budgets.textureMB)) {
      warnings.push({
        code: 'texture-budget-exceeded',
        metric: 'estimatedTextureMB',
        limit: Number(this.budgets.textureMB),
        actual: Number(metrics.estimatedTextureMB || 0)
      });
    }
    if (this.budgets.drawCalls != null && Number(metrics.drawCalls || 0) > Number(this.budgets.drawCalls)) {
      warnings.push({
        code: 'draw-call-budget-exceeded',
        metric: 'drawCalls',
        limit: Number(this.budgets.drawCalls),
        actual: Number(metrics.drawCalls || 0)
      });
    }
    return { ok: warnings.length === 0, profile: this.id, warnings };
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RenderFeatureProfile;
