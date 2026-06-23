import { createOmniError } from '../core/OmniError.js';

export class WebGPUPipelineRuntime {
  constructor({ label = 'webgpu-pipeline-runtime' } = {}) {
    this.label = String(label);
    this.textures = new Map();
    this.buffers = new Map();
    this.bindGroups = new Map();
    this.pipelines = new Map();
    this.commandBuffers = [];
    this.uploadQueue = [];
    this.recoveries = [];
    this.deviceLost = false;
    this.deviceLostReason = null;
  }

  createTexture(options = {}) {
    const texture = {
      id: String(options.id || `texture-${this.textures.size + 1}`),
      width: positiveInteger(options.width, 1),
      height: positiveInteger(options.height, 1),
      depthOrArrayLayers: positiveInteger(options.depthOrArrayLayers, 1),
      format: options.format || 'rgba8unorm',
      usage: normalizeArray(options.usage || ['texture-binding', 'copy-dst']),
      mipLevelCount: positiveInteger(options.mipLevelCount, 1),
      uploadState: 'allocated',
      uploadedBytes: 0,
      source: null
    };
    this.textures.set(texture.id, texture);
    return clone(texture);
  }

  queueTextureUpload(textureId, upload = {}) {
    const texture = this.requireTexture(textureId);
    const queued = {
      textureId: texture.id,
      bytes: Math.max(0, Number(upload.bytes ?? texture.width * texture.height * 4) || 0),
      source: upload.source || null,
      state: 'queued'
    };
    texture.uploadState = 'queued';
    this.uploadQueue.push(queued);
    return clone(queued);
  }

  flushTextureUploads() {
    const flushed = [];
    for (const upload of this.uploadQueue) {
      const texture = this.requireTexture(upload.textureId);
      texture.uploadState = 'uploaded';
      texture.uploadedBytes += upload.bytes;
      texture.source = upload.source;
      flushed.push({ ...upload, state: 'uploaded' });
    }
    this.uploadQueue = [];
    return flushed.map(clone);
  }

  createBuffer(options = {}) {
    const buffer = {
      id: String(options.id || `buffer-${this.buffers.size + 1}`),
      size: positiveInteger(options.size, 4),
      usage: options.usage || 'storage',
      mapped: Boolean(options.mapped),
      lifecycle: options.mapped ? 'mapped' : 'allocated',
      version: positiveInteger(options.version, 1)
    };
    this.buffers.set(buffer.id, buffer);
    return clone(buffer);
  }

  createBindGroup(options = {}) {
    const resources = normalizeArray(options.resources).map(String);
    const missing = resources.filter((id) => !this.textures.has(id) && !this.buffers.has(id));
    const bindGroup = {
      id: String(options.id || `bind-group-${this.bindGroups.size + 1}`),
      layout: options.layout || null,
      resources,
      missingResources: missing,
      valid: missing.length === 0
    };
    this.bindGroups.set(bindGroup.id, bindGroup);
    return clone(bindGroup);
  }

  createPipeline(options = {}) {
    const id = String(options.id || `pipeline-${this.pipelines.size + 1}`);
    const previous = this.pipelines.get(id);
    const pipeline = {
      id,
      layout: options.layout || previous?.layout || 'auto',
      vertex: options.vertex || previous?.vertex || 'vs_main',
      fragment: options.fragment || previous?.fragment || 'fs_main',
      topology: options.topology || previous?.topology || 'triangle-list',
      cacheKey: createPipelineCacheKey(options),
      hits: previous ? previous.hits + 1 : 0,
      warmed: Boolean(previous || options.warmed)
    };
    this.pipelines.set(id, pipeline);
    return clone(pipeline);
  }

  encodeDraw(options = {}) {
    const pipeline = this.requirePipeline(options.pipeline);
    const bindGroup = this.requireBindGroup(options.bindGroup);
    pipeline.hits += 1;
    pipeline.warmed = true;
    const commandBuffer = {
      id: String(options.id || `command-buffer-${this.commandBuffers.length + 1}`),
      encoded: true,
      drawCalls: 1,
      pipeline: pipeline.id,
      bindGroup: bindGroup.id,
      vertexCount: positiveInteger(options.vertexCount, 0),
      instanceCount: positiveInteger(options.instanceCount, 1)
    };
    this.commandBuffers.push(commandBuffer);
    return clone(commandBuffer);
  }

  loseDevice(reason = 'unknown') {
    this.deviceLost = true;
    this.deviceLostReason = String(reason);
    return {
      deviceLost: true,
      reason: this.deviceLostReason
    };
  }

  recoverDevice({ strategy = 'recreate-device' } = {}) {
    const recovery = {
      id: `recovery-${this.recoveries.length + 1}`,
      strategy: String(strategy),
      reason: this.deviceLostReason,
      restoredTextures: this.textures.size,
      restoredBuffers: this.buffers.size,
      rewarmedPipelines: this.pipelines.size
    };
    this.deviceLost = false;
    this.deviceLostReason = null;
    this.recoveries.push(recovery);
    return clone(recovery);
  }

  createSnapshot() {
    const textures = [...this.textures.values()].map(clone);
    const buffers = [...this.buffers.values()].map(clone);
    const bindGroups = [...this.bindGroups.values()].map(clone);
    const pipelineCache = [...this.pipelines.values()].map(clone);
    const commandBuffers = this.commandBuffers.map(clone);
    return {
      schema: 'omnicore.webgpu-pipeline-runtime.v1',
      label: this.label,
      summary: {
        textureCount: textures.length,
        uploadedTextureCount: textures.filter((texture) => texture.uploadState === 'uploaded').length,
        bufferCount: buffers.length,
        bindGroupCount: bindGroups.length,
        pipelineCount: pipelineCache.length,
        commandCount: commandBuffers.length,
        recoveryCount: this.recoveries.length,
        deviceLost: this.deviceLost
      },
      textures,
      buffers,
      bindGroups,
      pipelineCache,
      commandBuffers,
      uploadQueue: this.uploadQueue.map(clone),
      recoveries: this.recoveries.map(clone),
      device: {
        lost: this.deviceLost,
        reason: this.deviceLostReason
      }
    };
  }

  requireTexture(id) {
    const texture = this.textures.get(String(id));
    if (!texture) throw createOmniError('WebGPUPipelineRuntime', `unknown WebGPU texture: ${id}`);
    return texture;
  }

  requireBuffer(id) {
    const buffer = this.buffers.get(String(id));
    if (!buffer) throw createOmniError('WebGPUPipelineRuntime', `unknown WebGPU buffer: ${id}`);
    return buffer;
  }

  requireBindGroup(id) {
    const bindGroup = this.bindGroups.get(String(id));
    if (!bindGroup) throw createOmniError('WebGPUPipelineRuntime', `unknown WebGPU bind group: ${id}`);
    return bindGroup;
  }

  requirePipeline(id) {
    const pipeline = this.pipelines.get(String(id));
    if (!pipeline) throw createOmniError('WebGPUPipelineRuntime', `unknown WebGPU pipeline: ${id}`);
    return pipeline;
  }
}

function createPipelineCacheKey(options = {}) {
  return [
    options.layout || 'auto',
    options.vertex || 'vs_main',
    options.fragment || 'fs_main',
    options.topology || 'triangle-list'
  ].join('|');
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default WebGPUPipelineRuntime;
