export class MaterialPreset {
  constructor({
    id = 'material',
    shader = 'sprite',
    parameters = {},
    features = {},
    variants = {}
  } = {}) {
    this.id = String(id);
    this.shader = shader;
    this.parameters = clone(parameters || {});
    this.features = clone(features || {});
    this.variants = clone(variants || {});
  }

  resolve(variant = 'default') {
    const override = variant === 'default' ? {} : this.variants[variant] || {};
    return {
      id: this.id,
      variant,
      shader: override.shader || this.shader,
      parameters: { ...this.parameters, ...(override.parameters || {}) },
      features: { ...this.features, ...(override.features || {}) }
    };
  }

  toJSON() {
    return this.resolve();
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default MaterialPreset;
