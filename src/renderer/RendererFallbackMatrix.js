export const RENDERER_FALLBACK_MATRIX_SCHEMA = 'omnicore.renderer-fallback-matrix.v1';

const DEFAULT_MATRIX = Object.freeze([
  {
    name: 'webgpu',
    label: 'WebGPU',
    fallbackTo: Object.freeze(['pixi', 'canvas'])
  },
  {
    name: 'pixi',
    label: 'PixiJS WebGL',
    fallbackTo: Object.freeze(['canvas'])
  },
  {
    name: 'canvas',
    label: 'Canvas 2D',
    fallbackTo: Object.freeze([])
  }
]);

export function createRendererFallbackMatrix(input = {}) {
  const options = {
    probe: false,
    capabilities: {},
    navigatorRef: globalThis.navigator,
    documentRef: globalThis.document,
    canvasFactory: null,
    ...input
  };
  const detections = {
    webgpu: detectWebGPU(options),
    pixi: detectPixi(options),
    canvas: detectCanvas(options)
  };
  return {
    schema: RENDERER_FALLBACK_MATRIX_SCHEMA,
    generatedAt: options.generatedAt || null,
    backends: DEFAULT_MATRIX.map((entry) => ({
      ...entry,
      fallbackTo: [...entry.fallbackTo],
      ...detections[entry.name]
    }))
  };
}

export function resolveRendererFallbackPlan(preferred = 'auto', matrix = createRendererFallbackMatrix(), fallbackOrder = null) {
  const entries = new Map((matrix.backends || []).map((entry) => [entry.name, entry]));
  const preferredEntry = entries.get(preferred);
  const order = unique(
    fallbackOrder
      || (preferred === 'auto'
        ? (matrix.backends || []).map((entry) => entry.name)
        : [preferred, ...(preferredEntry?.fallbackTo || [])])
  );
  const explanations = order.map((backend, index) => {
    const entry = entries.get(backend);
    return {
      backend,
      label: entry?.label || backend,
      available: entry?.available ?? null,
      reason: entry?.reason || 'not-in-fallback-matrix',
      fallbackTo: order.slice(index + 1)
    };
  });
  return {
    schema: matrix.schema || RENDERER_FALLBACK_MATRIX_SCHEMA,
    preferred,
    order,
    availableOrder: explanations
      .filter((entry) => entry.available !== false)
      .map((entry) => entry.backend),
    explanations
  };
}

function detectWebGPU(options) {
  const override = readCapabilityOverride(options, 'webgpu');
  if (override) return override;
  if (!options.probe) return { available: null, reason: 'not-probed' };
  return options.navigatorRef?.gpu
    ? { available: true, reason: 'navigator-gpu-present' }
    : { available: false, reason: 'navigator-gpu-missing' };
}

function detectPixi(options) {
  const override = readCapabilityOverride(options, 'pixi');
  if (override) return override;
  if (!options.probe) return { available: null, reason: 'not-probed' };
  const canvas = createProbeCanvas(options);
  if (!canvas?.getContext) return { available: false, reason: 'webgl-probe-unavailable' };
  const context = safeGetContext(canvas, 'webgl2') || safeGetContext(canvas, 'webgl');
  return context
    ? { available: true, reason: 'webgl-context-present' }
    : { available: false, reason: 'webgl-context-missing' };
}

function detectCanvas(options) {
  const override = readCapabilityOverride(options, 'canvas');
  if (override) return override;
  if (!options.probe) return { available: null, reason: 'not-probed' };
  const canvas = createProbeCanvas(options);
  if (!canvas?.getContext) return { available: false, reason: 'canvas-probe-unavailable' };
  const context = safeGetContext(canvas, '2d');
  return context
    ? { available: true, reason: 'canvas-2d-context-present' }
    : { available: false, reason: 'canvas-2d-context-missing' };
}

function readCapabilityOverride(options, backend) {
  if (!Object.prototype.hasOwnProperty.call(options.capabilities || {}, backend)) return null;
  const value = options.capabilities[backend];
  return value
    ? { available: true, reason: 'capability-override-present' }
    : { available: false, reason: 'capability-override-missing' };
}

function createProbeCanvas(options) {
  if (typeof options.canvasFactory === 'function') return options.canvasFactory();
  return options.documentRef?.createElement?.('canvas') || null;
}

function safeGetContext(canvas, type) {
  try {
    return canvas.getContext(type);
  } catch {
    return null;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

export default createRendererFallbackMatrix;
