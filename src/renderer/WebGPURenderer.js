import { createOmniError } from '../core/OmniError.js';
import { DEFAULT_RENDERER_CONFIG } from '../config/defaults.js';
import RenderWorkerBridge from './RenderWorkerBridge.js';

/**
 * MVP WebGPU renderer abstraction.
 *
 * It detects WebGPU, configures the canvas context, and converts scene children
 * into serializable draw instructions. A worker bridge can consume those
 * instructions through OffscreenCanvas when the host provides a worker.
 */
export class WebGPURenderer {
  constructor({
    canvas,
    width = DEFAULT_RENDERER_CONFIG.width,
    height = DEFAULT_RENDERER_CONFIG.height,
    background = DEFAULT_RENDERER_CONFIG.background,
    store = null,
    navigatorRef = globalThis.navigator,
    gpu = navigatorRef?.gpu,
    workerFactory = null,
    metrics = null
  } = {}) {
    this.backend = 'webgpu';
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.background = background;
    this.store = store;
    this.gpu = gpu;
    this.workerFactory = workerFactory;
    this.metrics = metrics;
    this.adapter = null;
    this.device = null;
    this.context = null;
    this.format = null;
    this.workerBridge = null;
    this.lastInstructions = [];
    this.entityBuffer = null;
    this.entityFloat32 = null;
    this.entityBufferCapacityBytes = 0;
    this.pipelineDescriptor = create2DPipelineDescriptor();
    this.computeParticleDescriptor = createWebGPUComputeParticleDescriptor();
    this.pipeline = null;
    this.computeParticlePipeline = null;
    this.shaderCacheWarmed = false;
    this.destroyed = false;
  }

  static isSupported(navigatorRef = globalThis.navigator) {
    return Boolean(navigatorRef?.gpu?.requestAdapter);
  }

  async init() {
    if (!this.gpu?.requestAdapter) {
      throw createOmniError('Renderer', '当前浏览器不支持 WebGPU。');
    }
    this.context = this.canvas?.getContext?.('webgpu');
    if (!this.context) throw createOmniError('Renderer', '当前 Canvas 无法创建 WebGPU 上下文。');

    this.adapter = await this.gpu.requestAdapter();
    if (!this.adapter?.requestDevice) throw createOmniError('Renderer', 'WebGPU adapter 不可用。');
    this.device = await this.adapter.requestDevice();
    this.format = this.gpu.getPreferredCanvasFormat?.() || 'bgra8unorm';
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied'
    });
    this.pipeline = this._createPipeline();
    this.store?.injectBackend?.(this.backend);
    if (this.workerFactory) {
      this.workerBridge = new RenderWorkerBridge({
        workerFactory: this.workerFactory,
        canvas: this.canvas,
        width: this.width,
        height: this.height,
        backend: this.backend
      }).init();
    }
    return this;
  }

  renderScene(scene) {
    const render = () => {
      const drawInstructions = collectDrawInstructions(scene);
      const staticBatches = normalizeStaticBatchCommands(scene?.staticBatches || []);
      this.lastInstructions = [
        ...staticBatches,
        ...buildGPUBatches(drawInstructions, { maxBatches: 5 })
      ];
      this.mapEntityBuffer(drawInstructions);
      if (this.workerBridge) {
        this.workerBridge.frame(this.lastInstructions, {
          buffer: this.entityBuffer?.buffer || null,
          commandSource: 'worker',
          pipelineOwner: 'worker',
          batchCount: this.lastInstructions.length,
          entityCount: drawInstructions.length + staticBatches.reduce((sum, batch) => sum + (batch.spriteCount || 0), 0)
        });
      } else this.device?.queue?.submit?.([]);
    };
    if (this.metrics?.measure) this.metrics.measure('renderer.webgpu.renderScene', render);
    else render();
  }

  render(scene) {
    this.renderScene(scene);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.workerBridge?.resize(width, height);
  }

  mapEntityBuffer(entities = []) {
    const stride = 8;
    const count = entities.length;
    const bytes = Math.max(stride * Float32Array.BYTES_PER_ELEMENT, count * stride * Float32Array.BYTES_PER_ELEMENT);
    if (!this.entityBuffer?.buffer || this.entityBufferCapacityBytes < bytes) {
      const buffer = typeof SharedArrayBuffer !== 'undefined'
        ? new SharedArrayBuffer(bytes)
        : new ArrayBuffer(bytes);
      this.entityBuffer = {
        buffer,
        count: 0,
        stride,
        bytes: 0,
        capacityBytes: bytes,
        shared: typeof SharedArrayBuffer !== 'undefined' && buffer instanceof SharedArrayBuffer
      };
      this.entityBufferCapacityBytes = bytes;
    }
    const { buffer } = this.entityBuffer;
    const float32 = new Float32Array(buffer, 0, Math.max(stride, count * stride));
    entities.forEach((entity, index) => {
      const offset = index * stride;
      float32[offset] = finiteNumber(entity.x, 0);
      float32[offset + 1] = finiteNumber(entity.y, 0);
      float32[offset + 2] = finiteNumber(entity.width, 0);
      float32[offset + 3] = finiteNumber(entity.height, 0);
      float32[offset + 4] = finiteNumber(entity.rotation, 0);
      float32[offset + 5] = finiteNumber(entity.alpha, 1);
      float32[offset + 6] = packColorChannel(entity.color, 0);
      float32[offset + 7] = packColorChannel(entity.color, 1);
    });
    this.entityBuffer.count = count;
    this.entityBuffer.stride = stride;
    this.entityBuffer.bytes = bytes;
    this.entityFloat32 = float32;
    return {
      ...this.entityBuffer,
      float32
    };
  }

  fade(direction = 'out', duration = 250) {
    return new Promise((resolve) => {
      if (!duration) {
        resolve();
        return;
      }
      setTimeout(resolve, duration);
      this.store?.set?.('transition', { direction, duration, startedAt: Date.now() });
    });
  }

  destroy() {
    this.destroyed = true;
    this.workerBridge?.destroy();
    this.workerBridge = null;
    this.context = null;
    this.device = null;
    this.adapter = null;
    this.lastInstructions = [];
    this.entityBuffer = null;
    this.entityFloat32 = null;
    this.entityBufferCapacityBytes = 0;
    this.pipeline = null;
    this.computeParticlePipeline = null;
    this.shaderCacheWarmed = false;
  }

  prewarmShaderCache() {
    const pipelines = [];
    if (!this.pipeline) this.pipeline = this._createPipeline();
    if (this.pipeline) pipelines.push('2d-instanced');
    if (!this.computeParticlePipeline && this.device?.createComputePipeline) {
      this.createComputeParticlePipeline();
    }
    if (this.computeParticlePipeline) pipelines.push('compute-particles');
    this.shaderCacheWarmed = pipelines.length > 0;
    return {
      backend: this.backend,
      warmed: this.shaderCacheWarmed,
      pipelines
    };
  }

  createComputeParticlePipeline(options = {}) {
    this.computeParticleDescriptor = createWebGPUComputeParticleDescriptor(options);
    if (!this.device?.createShaderModule || !this.device?.createComputePipeline) {
      return {
        backend: this.backend,
        maxParticles: this.computeParticleDescriptor.maxParticles,
        pipeline: null,
        descriptor: this.computeParticleDescriptor
      };
    }
    const shaderModule = this.device.createShaderModule({
      label: 'omnicore-compute-particles-wgsl',
      code: this.computeParticleDescriptor.wgsl
    });
    this.computeParticlePipeline = this.device.createComputePipeline({
      label: 'omnicore-compute-particles',
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'cs_main'
      }
    });
    return {
      backend: this.backend,
      maxParticles: this.computeParticleDescriptor.maxParticles,
      pipeline: this.computeParticlePipeline,
      descriptor: this.computeParticleDescriptor
    };
  }

  _createPipeline() {
    if (!this.device?.createShaderModule || !this.device?.createRenderPipeline) return null;
    const shaderModule = this.device.createShaderModule({
      label: 'omnicore-2d-webgpu-wgsl',
      code: this.pipelineDescriptor.wgsl
    });
    return this.device.createRenderPipeline({
      label: 'omnicore-2d-webgpu-pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main'
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format || 'bgra8unorm' }]
      },
      primitive: { topology: 'triangle-list' }
    });
  }
}

export function createWebGPUComputeParticleDescriptor({ maxParticles = 8192, workgroupSize = 64 } = {}) {
  return {
    shaderLanguage: 'wgsl',
    maxParticles,
    workgroupSize,
    storageLayout: 'position.xy velocity.xy lifetime',
    wgsl: `
struct Particle {
  position: vec2f,
  velocity: vec2f,
  lifetime: f32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

@compute @workgroup_size(${workgroupSize})
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= ${maxParticles}u) {
    return;
  }
  particles[index].position = particles[index].position + particles[index].velocity;
  particles[index].lifetime = max(particles[index].lifetime - 0.016, 0.0);
}
`
  };
}

function normalizeStaticBatchCommands(batches = []) {
  if (!Array.isArray(batches)) return [];
  return batches.map((batch) => ({
    op: 'static-batch',
    type: 'static-batch',
    key: batch.key,
    texture: batch.texture || null,
    material: batch.material || batch.pluginName || 'batch',
    blendMode: batch.blendMode || 'normal',
    spriteCount: batch.spriteCount || 0,
    vertexCount: batch.vertexBuffer?.vertexCount || batch.vertices?.length || 0,
    bounds: batch.bounds || null,
    vertexBuffer: batch.vertexBuffer || null,
    immutable: batch.immutable !== false
  }));
}

export function collectDrawInstructions(scene) {
  const children = [...(scene?.children || [])]
    .filter((child) => child?.visible !== false)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  return children.map((child) => {
    if (child.drawCommand) return child.drawCommand;
    return {
      op: 'rect',
      x: child.x || 0,
      y: child.y || 0,
      width: child.width || 32,
      height: child.height || 32,
      color: child.color || '#38bdf8',
      alpha: child.alpha ?? 1,
      rotation: child.rotation || 0,
      texture: child.texture || null
    };
  });
}

/**
 * @param {object[]} instructions Draw instructions.
 * @param {object} options Batch options.
 * @returns {object[]} GPU batch commands.
 */
export function buildGPUBatches(instructions = [], options = {}) {
  const maxBatches = options.maxBatches ?? 5;
  if (instructions.length <= maxBatches) return instructions;
  const groups = new Map();
  for (const instruction of instructions) {
    const key = [
      instruction.texture || 'none',
      instruction.material || 'default',
      instruction.blendMode || 'normal'
    ].join('|');
    if (!groups.has(key)) {
      groups.set(key, {
        op: 'batch',
        type: 'batch',
        texture: instruction.texture || null,
        material: instruction.material || 'default',
        blendMode: instruction.blendMode || 'normal',
        count: 0,
        bounds: null
      });
    }
    const batch = groups.get(key);
    batch.count += 1;
    batch.bounds = mergeBounds(batch.bounds, instruction);
  }
  const batches = [...groups.values()];
  if (batches.length <= maxBatches) return batches;
  const primary = batches.slice(0, maxBatches - 1);
  const overflow = {
    op: 'batch',
    type: 'batch',
    texture: 'multi',
    material: 'multi',
    blendMode: 'normal',
    count: 0,
    bounds: null,
    mergedGroups: batches.length - primary.length
  };
  for (const batch of batches.slice(maxBatches - 1)) {
    overflow.count += batch.count;
    overflow.bounds = mergeBounds(overflow.bounds, batch.bounds || {});
  }
  return [...primary, overflow];
}

function mergeBounds(current, item = {}) {
  const x = Number(item.x || 0);
  const y = Number(item.y || 0);
  const width = Number(item.width || 0);
  const height = Number(item.height || 0);
  if (!current) return { x, y, width, height };
  const minX = Math.min(current.x, x);
  const minY = Math.min(current.y, y);
  const maxX = Math.max(current.x + current.width, x + width);
  const maxY = Math.max(current.y + current.height, y + height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function create2DPipelineDescriptor() {
  return {
    shaderLanguage: 'wgsl',
    vertexFormat: 'float32x4',
    instanceStrideFloats: 8,
    wgsl: `
struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 6>(
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
    vec2f(0.0, 1.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 0.0),
    vec2f(1.0, 1.0)
  );
  var out: VertexOut;
  let p = positions[vertexIndex];
  out.position = vec4f(p.x, p.y, 0.0, 1.0);
  out.color = vec4f(1.0, 1.0, 1.0, 1.0);
  return out;
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4f {
  return input.color;
}
`
  };
}

function packColorChannel(color, channel) {
  if (typeof color !== 'string' || !color.startsWith('#')) return channel === 0 ? 1 : 1;
  const clean = color.slice(1);
  if (clean.length < 6) return 1;
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  return channel === 0 ? r + g / 1000 : b;
}

function finiteNumber(value, fallback) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export default WebGPURenderer;
