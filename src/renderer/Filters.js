import { ColorMatrixFilter, NoiseFilter } from 'pixi.js';
import { AdvancedBloomFilter, AdjustmentFilter, GlitchFilter } from 'pixi-filters';

/**
 * PixiJS v8 filter helpers.
 *
 * @example
 * const bloom = createBloomFilter({ threshold: 0.4, bloomScale: 1.2 });
 * renderer.applyFilter(sprite, bloom);
 */
export function appendFilter(target, filter) {
  if (!target) return filter;
  const current = target.filters ? (Array.isArray(target.filters) ? target.filters : [target.filters]) : [];
  target.filters = [...current, filter];
  return filter;
}

export function createBloomFilter(options = {}) {
  return new AdvancedBloomFilter({
    threshold: 0.35,
    bloomScale: 1.15,
    brightness: 1,
    blur: 4,
    quality: 5,
    ...options
  });
}

export function createAdjustmentFilter(options = {}) {
  return new AdjustmentFilter({
    gamma: 1,
    saturation: 1,
    contrast: 1,
    brightness: 1,
    red: 1,
    green: 1,
    blue: 1,
    alpha: 1,
    ...options
  });
}

export function createGlitchFilter(options = {}) {
  return new GlitchFilter({ slices: 6, offset: 8, direction: 0, ...options });
}

export function createColorMatrixFilter(matrix) {
  const filter = new ColorMatrixFilter();
  if (Array.isArray(matrix)) filter.matrix = matrix;
  return filter;
}

export function createNoiseFilter(options = {}) {
  return new NoiseFilter(options);
}

export function createHD2DFilter({
  cornerBlur = 0.25,
  toneSeparation = 3,
  chromaticAberration = 0.012,
  pixelSnap = 1,
  time = 0
} = {}) {
  return {
    type: 'omnicore-hd2d-filter',
    renderer: 'pixi-filter-descriptor',
    uniforms: {
      uCornerBlur: Number(cornerBlur),
      uToneSeparation: Number(toneSeparation),
      uChromaticAberration: Number(chromaticAberration),
      uPixelSnap: Number(pixelSnap),
      uTime: Number(time)
    },
    fragment: `
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uCornerBlur;
uniform float uToneSeparation;
uniform float uChromaticAberration;
uniform float uPixelSnap;
uniform float uTime;

void main(void) {
  vec2 snapped = floor(vTextureCoord * uPixelSnap) / max(uPixelSnap, 1.0);
  float corner = smoothstep(0.0, uCornerBlur, min(min(snapped.x, snapped.y), min(1.0 - snapped.x, 1.0 - snapped.y)));
  vec2 offset = vec2(uChromaticAberration * sin(uTime + snapped.y * 8.0), 0.0);
  vec4 red = texture(uTexture, snapped + offset);
  vec4 base = texture(uTexture, snapped);
  vec4 blue = texture(uTexture, snapped - offset);
  vec3 toneSteps = floor(vec3(red.r, base.g, blue.b) * uToneSeparation) / max(uToneSeparation, 1.0);
  gl_FragColor = vec4(mix(base.rgb, toneSteps, 0.72) * corner, base.a);
}
`
  };
}

export function createNormalLightShader({
  normalMap = null,
  light = { x: 0, y: -0.4, z: 0.8 },
  ambient = 0.32,
  diffuseStrength = 0.78,
  specularStrength = 0.35,
  shininess = 24
} = {}) {
  const lightVector = normalizeLightVector(light);
  return {
    type: 'omnicore-25d-normal-light-shader',
    normalMap,
    uniforms: {
      uLightDirection: lightVector,
      uAmbient: Number(ambient),
      uDiffuseStrength: Number(diffuseStrength),
      uSpecularStrength: Number(specularStrength),
      uShininess: Number(shininess)
    },
    fragment: `
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform sampler2D uNormalMap;
uniform vec3 uLightDirection;
uniform float uAmbient;
uniform float uDiffuseStrength;
uniform float uSpecularStrength;
uniform float uShininess;

void main(void) {
  vec4 albedo = texture(uTexture, vTextureCoord);
  vec3 normalSample = texture(uNormalMap, vTextureCoord).xyz * 2.0 - 1.0;
  float diffuse = max(dot(normalize(normalSample), normalize(uLightDirection)), 0.0);
  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  vec3 halfVector = normalize(uLightDirection + viewDirection);
  float specular = pow(max(dot(normalize(normalSample), halfVector), 0.0), uShininess);
  vec3 lit = albedo.rgb * (uAmbient + diffuse * uDiffuseStrength) + vec3(specular * uSpecularStrength);
  gl_FragColor = vec4(lit, albedo.a);
}
`
  };
}

export function createSpineFFDVertexShader({
  strength = 0.25,
  phase = 0,
  axis = 'y'
} = {}) {
  return {
    type: 'omnicore-spine-ffd-vertex-shader',
    uniforms: {
      uFFDStrength: Number(strength),
      uFFDPhase: Number(phase),
      uFFDAxis: axis === 'x' ? 0 : 1
    },
    vertex: `
in vec2 aPosition;
in vec2 aTextureCoord;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform float uFFDStrength;
uniform float uFFDPhase;
uniform float uFFDAxis;
out vec2 vTextureCoord;

void main(void) {
  vec2 ffd = aPosition;
  float wave = sin((uFFDAxis < 0.5 ? aPosition.y : aPosition.x) * 0.05 + uFFDPhase) * uFFDStrength;
  ffd.x += wave * step(0.5, uFFDAxis);
  ffd.y += wave * (1.0 - step(0.5, uFFDAxis));
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * vec3(ffd, 1.0)).xy, 0.0, 1.0);
  vTextureCoord = aTextureCoord;
}
`
  };
}

function normalizeLightVector(light = {}) {
  const x = Number(light.x || 0);
  const y = Number(light.y ?? -0.4);
  const z = Number(light.z ?? 0.8);
  const length = Math.hypot(x, y, z) || 1;
  return {
    x: Number((x / length).toFixed(6)),
    y: Number((y / length).toFixed(6)),
    z: Number((z / length).toFixed(6))
  };
}
