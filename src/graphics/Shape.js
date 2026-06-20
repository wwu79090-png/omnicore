import {
  conicGradientFill,
  createBezierPrimitive,
  createPolygonPrimitive,
  createRingPrimitive,
  createSectorPrimitive,
  linearGradientFill,
  radialGradientFill,
  textureFill
} from '../renderer/VectorPrimitives.js';

const BLEND_MODES = Object.freeze({
  normal: 'source-over',
  add: 'lighter',
  multiply: 'multiply',
  overlay: 'overlay',
  screen: 'screen'
});

export class ShapeBuilder {
  constructor(primitive) {
    this.primitive = primitive;
  }

  fill(value) {
    return this._patch({ fill: value });
  }

  stroke(value, lineWidth = null) {
    return this._patch({ stroke: value, ...(lineWidth == null ? {} : { lineWidth }) });
  }

  blend(mode = 'normal') {
    return this._patch({ blendMode: BLEND_MODES[mode] || mode });
  }

  mask(mask) {
    return this._patch({ mask: unwrap(mask) });
  }

  clip(mask) {
    return this.mask(mask);
  }

  toJSON() {
    return this.primitive;
  }

  _patch(patch) {
    this.primitive.commands = this.primitive.commands.map((command) => ({
      ...command,
      ...patch
    }));
    return this;
  }
}

export const Shape = {
  BLEND_MODES,
  gradient: {
    linear: linearGradientFill,
    radial: radialGradientFill,
    conic: conicGradientFill,
    texture: textureFill
  },

  polygon(options = {}) {
    return new ShapeBuilder(createPolygonPrimitive(options));
  },

  sector(options = {}) {
    return new ShapeBuilder(createSectorPrimitive(options));
  },

  ring(options = {}) {
    return new ShapeBuilder(createRingPrimitive(options));
  },

  bezier(options = {}) {
    return new ShapeBuilder(createBezierPrimitive(options));
  },

  mask(shape) {
    return { type: 'mask', primitive: unwrap(shape) };
  },

  clip(shape) {
    return { type: 'clip', primitive: unwrap(shape) };
  }
};

function unwrap(value) {
  if (value instanceof ShapeBuilder) return value.toJSON();
  return value?.primitive || value;
}

export default Shape;
