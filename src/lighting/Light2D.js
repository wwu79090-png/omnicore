/**
 * Lightweight 2D light descriptors and shadow helpers.
 */
export class Light2D {
  constructor({
    type = 'point',
    x = 0,
    y = 0,
    radius = 160,
    angle = 0,
    intensity = 1,
    color = '#ffffff',
    colorTemperature = null
  } = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.angle = angle;
    this.intensity = intensity;
    this.color = color;
    this.colorTemperature = normalizeColorTemperature(colorTemperature);
    this.resolvedColor = this.resolveColor();
  }

  static point(options = {}) {
    return new Light2D({ ...options, type: 'point' });
  }

  static directional(options = {}) {
    return new Light2D({ ...options, type: 'directional', radius: options.radius || Infinity });
  }

  static createNormalPipeline({ surface = {}, nodes = [], edges = [] } = {}) {
    const normalNode = nodes.find((node) => node.type === 'normalMap') || {};
    const lightNodes = nodes.filter((node) => node.type === 'pointLight' || node.type === 'directionalLight');
    const shadowCasters = nodes
      .filter((node) => node.type === 'occluder')
      .map((node) => ({
        id: node.id,
        x: Number(node.x || 0),
        y: Number(node.y || 0),
        width: Number(node.width || 0),
        height: Number(node.height || 0),
        polygon: Array.isArray(node.polygon) ? node.polygon : null
      }));
    const normalStrength = Number(normalNode.strength ?? surface.normalStrength ?? 1);
    const lights = lightNodes.map((node) => ({
      id: node.id,
      type: node.type === 'directionalLight' ? 'directional' : 'point',
      x: Number(node.x || 0),
      y: Number(node.y || 0),
      radius: node.type === 'directionalLight' ? (node.radius || Infinity) : Number(node.radius || 160),
      angle: Number(node.angle || 0),
      intensity: Number(node.intensity ?? 1),
      color: node.color || '#ffffff',
      colorTemperature: normalizeColorTemperature(node.colorTemperature),
      resolvedColor: normalizeColorTemperature(node.colorTemperature)
        ? colorTemperatureToHex(node.colorTemperature)
        : (node.color || '#ffffff'),
      normalStrength
    }));
    const colorTexture = surface.texture || nodes.find((node) => node.type === 'texture')?.texture || null;
    const normalMap = surface.normalMap || normalNode.texture || null;

    return {
      backend: 'webgpu',
      graph: { nodes: [...nodes], edges: [...edges] },
      surface: {
        texture: colorTexture,
        normalMap,
        size: surface.size || null
      },
      lights,
      shadowCasters,
      shader: {
        language: 'wgsl',
        wgsl: normalLightingWgsl()
      },
      commands: [
        {
          op: 'light2d:normal-pass',
          backend: 'webgpu',
          colorTexture,
          normalMap,
          lightCount: lights.length,
          shadowCasterCount: shadowCasters.length
        },
        {
          op: 'light2d:shadow-bake',
          backend: 'webgpu',
          casters: shadowCasters
        }
      ]
    };
  }

  toDrawCommand() {
    this.resolvedColor = this.resolveColor();
    return {
      op: 'light2d',
      type: this.type,
      x: this.x,
      y: this.y,
      radius: this.radius,
      angle: this.angle,
      intensity: this.intensity,
      color: this.color,
      colorTemperature: this.colorTemperature,
      resolvedColor: this.resolvedColor
    };
  }

  resolveColor() {
    return this.colorTemperature ? colorTemperatureToHex(this.colorTemperature) : this.color;
  }

  preview() {
    this.resolvedColor = this.resolveColor();
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      radius: this.radius,
      angle: this.angle,
      intensity: this.intensity,
      color: this.color,
      colorTemperature: this.colorTemperature,
      resolvedColor: this.resolvedColor
    };
  }

  shadowForRect(rect) {
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height }
    ];
    if (this.type === 'directional') {
      const dx = Math.cos(this.angle) * 4096;
      const dy = Math.sin(this.angle) * 4096;
      return corners.map((corner) => ({ x: corner.x + dx, y: corner.y + dy }));
    }
    return corners.map((corner) => {
      const dx = corner.x - this.x;
      const dy = corner.y - this.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const scale = this.radius / length;
      return {
        x: corner.x + dx * scale,
        y: corner.y + dy * scale
      };
    });
  }

  render(ctx, occluders = []) {
    if (!ctx) return [];
    const command = this.toDrawCommand();
    const shadows = occluders.map((occluder) => this.shadowForRect(occluder));
    ctx.save?.();
    ctx.globalAlpha = this.intensity;
    ctx.fillStyle = this.resolveColor();
    if (this.type === 'point') {
      ctx.beginPath?.();
      ctx.arc?.(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill?.();
    }
    ctx.restore?.();
    return { command, shadows };
  }
}

function normalizeColorTemperature(value) {
  if (value === null || value === undefined || value === '') return null;
  const kelvin = Number(value);
  if (!Number.isFinite(kelvin)) return null;
  return Math.max(1000, Math.min(40000, Math.round(kelvin)));
}

function colorTemperatureToHex(value) {
  const temperature = normalizeColorTemperature(value) / 100;
  let red;
  let green;
  let blue;

  if (temperature <= 66) red = 255;
  else red = 329.698727446 * ((temperature - 60) ** -0.1332047592);

  if (temperature <= 66) green = 99.4708025861 * Math.log(temperature) - 161.1195681661;
  else green = 288.1221695283 * ((temperature - 60) ** -0.0755148492);

  if (temperature >= 66) blue = 255;
  else if (temperature <= 19) blue = 0;
  else blue = 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

function normalLightingWgsl() {
  return `
struct Light2D {
  position: vec2<f32>,
  radius: f32,
  intensity: f32,
  color: vec3<f32>,
  normalStrength: f32,
};

fn applyNormalLight(normalSample: vec3<f32>, lightDir: vec3<f32>, light: Light2D) -> vec3<f32> {
  let normal = normalize((normalSample * 2.0 - vec3<f32>(1.0, 1.0, 1.0)) * vec3<f32>(light.normalStrength, light.normalStrength, 1.0));
  let lit = max(dot(normal, normalize(lightDir)), 0.0) * light.intensity;
  return light.color * lit;
}
`;
}

export default Light2D;
