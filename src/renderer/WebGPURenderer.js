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
    this.textureAtlasDescriptor = createWebGPUTextureAtlasDescriptor();
    this.shaderVariantRegistry = createWebGPUShaderVariantRegistry();
    this.hardwareEvidence = null;
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

  createHardwareEvidence(options = {}) {
    this.hardwareEvidence = createWebGPUHardwareEvidencePayload({
      renderer: this.backend,
      preferredFormat: this.format,
      adapter: this.adapter,
      device: options.device || this.adapter?.info?.device || this.adapter?.name || null,
      browser: options.browser,
      gpu: options.gpu,
      checks: options.checks
    });
    return this.hardwareEvidence;
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

export function createWebGPUTextureAtlasDescriptor({
  maxTextures = 16,
  atlasSize = 2048,
  format = 'rgba8unorm',
  mipLevelCount = 1,
  sampler = {}
} = {}) {
  return {
    format: 'OmniCore.WebGPUTextureAtlasDescriptor',
    version: 1,
    maxTextures,
    atlasSize,
    textureFormat: format,
    mipLevelCount,
    sampler: {
      type: sampler.type || 'filtering',
      addressModeU: sampler.addressModeU || 'clamp-to-edge',
      addressModeV: sampler.addressModeV || 'clamp-to-edge',
      magFilter: sampler.magFilter || 'linear',
      minFilter: sampler.minFilter || 'linear'
    },
    texture: {
      dimension: '2d',
      sampleType: 'float',
      viewDimension: '2d-array',
      usage: ['TEXTURE_BINDING', 'COPY_DST', 'RENDER_ATTACHMENT']
    },
    bindGroupLayout: {
      label: 'omnicore-webgpu-texture-atlas',
      entries: [
        {
          binding: 0,
          visibility: 'fragment',
          sampler: { type: sampler.type || 'filtering' }
        },
        {
          binding: 1,
          visibility: 'fragment',
          texture: {
            sampleType: 'float',
            viewDimension: '2d-array',
            multisampled: false
          }
        }
      ]
    },
    atlasUniformLayout: {
      frame: 'xywh',
      uv: 'uvxy',
      layer: 'texture-array-layer',
      paddingPixels: 2
    }
  };
}

export function createWebGPUShaderVariantRegistry({
  colorFormat = 'bgra8unorm',
  hdrFormat = 'rgba16float'
} = {}) {
  return {
    format: 'OmniCore.WebGPUShaderVariantRegistry',
    version: 1,
    variants: {
      instancedSprite: {
        pipelineLabel: 'omnicore-webgpu-instanced-sprite',
        vertexLayout: 'position.xy size.xy rotation alpha color.rg',
        fragmentTargets: [colorFormat],
        features: ['instance-buffer', 'texture-atlas', 'blend-normal']
      },
      texturedSprite: {
        pipelineLabel: 'omnicore-webgpu-textured-sprite',
        vertexLayout: 'quad.xy uv.xy',
        fragmentTargets: [colorFormat],
        features: ['sampler', 'texture-array', 'premultiplied-alpha']
      },
      hd2d: {
        pipelineLabel: 'omnicore-webgpu-hd2d-filter',
        vertexLayout: 'fullscreen-triangle',
        fragmentTargets: [hdrFormat],
        features: ['tone-separation', 'edge-soften', 'dynamic-chromatic-aberration']
      },
      particleCompute: {
        pipelineLabel: 'omnicore-webgpu-compute-particles',
        workgroupSize: 64,
        storageLayout: 'position.xy velocity.xy lifetime',
        features: ['compute', 'storage-buffer', 'indirect-friendly']
      }
    },
    compatibility: {
      fallback: 'pixi-webgl',
      requires: ['navigator.gpu', 'GPUAdapter.requestDevice'],
      optional: ['timestamp-query', 'texture-compression-bc']
    }
  };
}

export function createWebGPUHardwareEvidencePayload({
  generatedAt = new Date().toISOString(),
  device = null,
  browser = null,
  gpu = null,
  renderer = 'webgpu',
  preferredFormat = 'bgra8unorm',
  adapter = null,
  checks = [],
  notes = []
} = {}) {
  const adapterInfo = normalizeAdapterInfo(adapter);
  return {
    format: 'OmniCore.WebGPUHardwareEvidence',
    version: 1,
    generatedAt,
    renderer,
    preferredFormat,
    hardware: {
      device: device || adapterInfo.device || null,
      browser,
      gpu: gpu || adapterInfo.gpu || {},
      adapter: adapterInfo
    },
    checks: checks.map((check) => ({
      name: String(check.name || 'unnamed-check'),
      fps: Number(check.fps || 0),
      frameMs: check.frameMs == null ? null : Number(check.frameMs),
      sprites: check.sprites == null ? null : Number(check.sprites),
      drawCalls: check.drawCalls == null ? null : Number(check.drawCalls),
      pass: Boolean(check.pass),
      notes: check.notes || ''
    })),
    captureInstructions: [
      'Run npm run webgpu:evidence -- --out dist/webgpu-hardware-evidence.json on target hardware.',
      'Attach browser version, GPU model, screenshot, FPS sample, and console error/warn status.',
      'If navigator.gpu is unavailable, record Pixi/WebGL fallback as the expected runtime path.'
    ],
    notes
  };
}

export function createWebGPUInstancingDescriptor({
  instances = [],
  strideFloats = 8,
  vertexCount = 6
} = {}) {
  const stride = Math.max(1, Number(strideFloats) || 8);
  const instanceCount = instances.length;
  return {
    format: 'OmniCore.WebGPUInstancingDescriptor',
    stepMode: 'instance',
    instanceCount,
    vertexCount,
    drawCalls: instanceCount > 0 ? 1 : 0,
    strideFloats: stride,
    bufferBytes: Math.max(stride, stride * instanceCount) * Float32Array.BYTES_PER_ELEMENT,
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x2', field: 'position' },
      { shaderLocation: 1, offset: 2 * Float32Array.BYTES_PER_ELEMENT, format: 'float32x2', field: 'size' },
      { shaderLocation: 2, offset: 4 * Float32Array.BYTES_PER_ELEMENT, format: 'float32', field: 'rotation' },
      { shaderLocation: 3, offset: 5 * Float32Array.BYTES_PER_ELEMENT, format: 'float32', field: 'alpha' },
      { shaderLocation: 4, offset: 6 * Float32Array.BYTES_PER_ELEMENT, format: 'float32x2', field: 'color' }
    ],
    data: instances.map((item) => ({
      x: finiteNumber(item.x, 0),
      y: finiteNumber(item.y, 0),
      width: finiteNumber(item.width, 0),
      height: finiteNumber(item.height, 0),
      rotation: finiteNumber(item.rotation, 0),
      alpha: finiteNumber(item.alpha, 1),
      color: item.color || '#ffffff'
    }))
  };
}

export function createWebGPUTextureArrayBatch(commands = [], {
  maxTextures = 16
} = {}) {
  const textureToLayer = new Map();
  const layers = [];
  const items = [];
  for (const command of commands) {
    const texture = command.texture || command.atlas || 'none';
    if (!textureToLayer.has(texture)) {
      if (textureToLayer.size >= maxTextures) {
        textureToLayer.set(texture, textureToLayer.size);
      } else {
        textureToLayer.set(texture, layers.length);
        layers.push({
          texture,
          layer: layers.length,
          commandIds: []
        });
      }
    }
    const layer = textureToLayer.get(texture);
    const item = {
      id: command.id,
      texture,
      layer,
      material: command.material || 'default',
      blendMode: command.blendMode || 'normal'
    };
    items.push(item);
    if (layers[layer]) layers[layer].commandIds.push(command.id);
  }
  return {
    format: 'OmniCore.WebGPUTextureArrayBatch',
    layers,
    items,
    drawCalls: commands.length > 0 ? Math.max(1, Math.ceil(layers.length / Math.max(1, Number(maxTextures) || 16))) : 0,
    maxTextures
  };
}

export function createWebGPUComputeDispatchPlan({
  task = 'generic',
  items = 0,
  workgroupSize = 64,
  main = 'cs_main'
} = {}) {
  const count = Math.max(0, Number(items) || 0);
  const groupSize = Math.max(1, Number(workgroupSize) || 64);
  return {
    format: 'OmniCore.WebGPUComputeDispatchPlan',
    task,
    items: count,
    workgroupSize: groupSize,
    workgroups: Math.ceil(count / groupSize),
    main,
    dispatch: [Math.ceil(count / groupSize), 1, 1]
  };
}

export function createWebGPUResourceLifecyclePlan({
  currentFrame = 0,
  idleFrameLimit = 120,
  memoryBudgetMB = 128,
  textures = [],
  buffers = []
} = {}) {
  const frame = Math.max(0, Number(currentFrame) || 0);
  const idleLimit = Math.max(1, Number(idleFrameLimit) || 120);
  const normalizedTextures = textures.map((texture) => normalizeGpuResource(texture, frame));
  const normalizedBuffers = buffers.map((buffer) => normalizeGpuResource(buffer, frame));
  const totalMemoryMB = round2(
    [...normalizedTextures, ...normalizedBuffers].reduce((sum, resource) => sum + resource.sizeMB, 0)
  );
  const toEvict = normalizedTextures
    .filter((texture) => texture.idleFrames > idleLimit)
    .map((texture) => texture.id);
  const mappedBuffers = normalizedBuffers.filter((buffer) => buffer.mapped).map((buffer) => buffer.id);
  const warnings = [];
  if (toEvict.length) warnings.push('texture-idle');
  if (totalMemoryMB > Number(memoryBudgetMB)) warnings.push('memory-budget');
  if (mappedBuffers.length) warnings.push('mapped-buffer-residency');
  return {
    format: 'OmniCore.WebGPUResourceLifecyclePlan',
    currentFrame: frame,
    totalMemoryMB,
    memoryBudgetMB: Number(memoryBudgetMB),
    textures: normalizedTextures,
    buffers: normalizedBuffers,
    toEvict,
    warnings,
    recommendations: [
      ...toEvict.map((id) => `evictTexture:${id}`),
      ...mappedBuffers.map((id) => `unmapBuffer:${id}`),
      ...(totalMemoryMB > Number(memoryBudgetMB) ? ['reduceAtlasSizeOrStreamingBudget'] : [])
    ]
  };
}

export function createWebGPUFrameBudgetReport({
  frameBudgetMs = 16.6,
  passes = [],
  drawCalls = 0,
  batchCount = 0,
  pipelineCache = {},
  deviceLost = false,
  fallbackOrder = ['webgpu', 'pixi', 'canvas']
} = {}) {
  const normalizedPasses = passes.map((pass) => ({
    name: String(pass.name || 'pass'),
    ms: round2(pass.ms)
  }));
  const totalMs = round2(normalizedPasses.reduce((sum, pass) => sum + pass.ms, 0));
  const budget = Number(frameBudgetMs) || 16.6;
  const hits = Math.max(0, Number(pipelineCache.hits) || 0);
  const misses = Math.max(0, Number(pipelineCache.misses) || 0);
  const pipelineCacheHitRate = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 100;
  const warnings = [];
  if (totalMs > budget) warnings.push('frame-budget-exceeded');
  if (deviceLost) warnings.push('device-lost');
  if (pipelineCacheHitRate < 80) warnings.push('pipeline-cache-cold');
  return {
    format: 'OmniCore.WebGPUFrameBudgetReport',
    frameBudgetMs: budget,
    totalMs,
    passes: normalizedPasses,
    drawCalls: Math.max(0, Number(drawCalls) || 0),
    batchCount: Math.max(0, Number(batchCount) || 0),
    pipelineCache: { hits, misses },
    pipelineCacheHitRate,
    fallbackNext: deviceLost ? fallbackOrder.find((backend) => backend !== 'webgpu') || null : null,
    warnings,
    recommendations: buildFrameBudgetRecommendations({ totalMs, budget, deviceLost, pipelineCacheHitRate })
  };
}

function normalizeAdapterInfo(adapter = null) {
  if (!adapter) return {};
  const info = adapter.info || adapter.adapterInfo || adapter;
  return {
    vendor: info.vendor || null,
    architecture: info.architecture || null,
    device: info.device || info.name || null,
    description: info.description || null,
    gpu: {
      vendor: info.vendor || null,
      architecture: info.architecture || null,
      device: info.device || info.name || null
    }
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

function normalizeGpuResource(resource = {}, currentFrame = 0) {
  const lastUsedFrame = Math.max(0, Number(resource.lastUsedFrame ?? currentFrame) || 0);
  return {
    id: String(resource.id || resource.name || 'resource'),
    sizeMB: round2(resource.sizeMB),
    lastUsedFrame,
    idleFrames: Math.max(0, currentFrame - lastUsedFrame),
    mapped: Boolean(resource.mapped),
    label: resource.label || null
  };
}

function buildFrameBudgetRecommendations({
  totalMs,
  budget,
  deviceLost,
  pipelineCacheHitRate
}) {
  const recommendations = [];
  if (totalMs > budget) recommendations.push('splitUploadPassOrReduceDrawCalls');
  if (pipelineCacheHitRate < 80) recommendations.push('prewarmPipelines');
  if (deviceLost) recommendations.push('fallbackRenderer:pixi');
  return recommendations;
}

function round2(value) {
  const number = Number(value) || 0;
  return Math.round(number * 100) / 100;
}

export default WebGPURenderer;
