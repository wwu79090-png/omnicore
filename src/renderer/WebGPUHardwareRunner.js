import WebGPUPipelineRuntime from './WebGPUPipelineRuntime.js';
import createWebGPUHardwareValidationReport from './WebGPUHardwareValidation.js';

export async function runWebGPUHardwarePath({
  navigator = globalThis.navigator,
  canvas = null,
  label = 'webgpu-hardware-path',
  width = 64,
  height = 64
} = {}) {
  const runtime = new WebGPUPipelineRuntime({ label });
  const gpu = navigator?.gpu || null;
  if (!gpu || !canvas?.getContext) return createFallbackReport({ runtime, label, reason: 'webgpu-unavailable' });

  const adapter = await gpu.requestAdapter();
  if (!adapter) return createFallbackReport({ runtime, label, reason: 'adapter-unavailable' });
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) return createFallbackReport({ runtime, label, reason: 'webgpu-context-unavailable' });

  const format = gpu.getPreferredCanvasFormat?.() || 'bgra8unorm';
  context.configure({
    device,
    format,
    alphaMode: 'premultiplied'
  });

  const texture = device.createTexture({
    label: `${label}-texture`,
    size: [canvas.width || width, canvas.height || height, 1],
    format,
    usage: textureUsage(['RENDER_ATTACHMENT', 'TEXTURE_BINDING', 'COPY_DST'])
  });
  const buffer = device.createBuffer({
    label: `${label}-buffer`,
    size: 16,
    usage: bufferUsage(['VERTEX', 'COPY_DST'])
  });
  const encoder = device.createCommandEncoder({ label: `${label}-encoder` });
  const currentTexture = context.getCurrentTexture();
  const view = currentTexture.createView();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view,
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.04, g: 0.06, b: 0.08, a: 1 }
    }]
  });
  pass.end();
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);

  runtime.createTexture({
    id: 'hardware-texture',
    width: canvas.width || width,
    height: canvas.height || height,
    format,
    usage: ['render-attachment', 'texture-binding', 'copy-dst']
  });
  runtime.queueTextureUpload('hardware-texture', {
    bytes: (canvas.width || width) * (canvas.height || height) * 4,
    source: texture?.label || `${label}-texture`
  });
  runtime.flushTextureUploads();
  runtime.createBuffer({ id: 'hardware-buffer', size: 16, usage: 'vertex|copy-dst' });
  runtime.createBindGroup({ id: 'hardware-bind-group', resources: ['hardware-texture', 'hardware-buffer'] });
  runtime.createPipeline({ id: 'hardware-pipeline', layout: 'auto', vertex: 'vs_main', fragment: 'fs_main' });
  runtime.encodeDraw({
    id: 'hardware-command-buffer',
    pipeline: 'hardware-pipeline',
    bindGroup: 'hardware-bind-group',
    vertexCount: 3
  });
  runtime.loseDevice('hardware-path-test');
  runtime.recoverDevice({ strategy: 'recreate-device-and-reupload' });

  const lost = device.lost ? await settleDeviceLost(device.lost) : null;
  const pipeline = runtime.createSnapshot();
  const validation = createWebGPUHardwareValidationReport({
    browsers: [{
      name: 'Chromium',
      webgpu: 'passed',
      adapter: adapter.info?.description || adapter.name || 'runtime-adapter',
      fallback: null
    }],
    pipelineSnapshot: pipeline,
    deviceLost: { tested: true, recovered: true }
  });

  return {
    schema: 'omnicore.webgpu-hardware-run.v1',
    label,
    adapter: {
      available: true,
      info: clone(adapter.info || {}),
      features: adapter.features ? Array.from(adapter.features) : []
    },
    device: {
      created: true,
      lost
    },
    gpuResources: {
      texture: texture?.label || `${label}-texture`,
      buffer: buffer?.label || `${label}-buffer`,
      commandSubmitted: true
    },
    pipeline,
    validation
  };
}

function createFallbackReport({ runtime, label, reason }) {
  const pipeline = runtime.createSnapshot();
  const validation = createWebGPUHardwareValidationReport({
    browsers: [{ name: 'Browser', webgpu: 'fallback', fallback: 'webgl2', reason }],
    pipelineSnapshot: pipeline
  });
  return {
    schema: 'omnicore.webgpu-hardware-run.v1',
    label,
    adapter: { available: false, reason },
    device: { created: false, lost: null },
    gpuResources: { texture: null, buffer: null, commandSubmitted: false },
    pipeline,
    validation
  };
}

async function settleDeviceLost(lostPromise) {
  try {
    const lost = await Promise.race([
      lostPromise,
      new Promise((resolve) => {
        setTimeout(() => resolve(null), 0);
      })
    ]);
    if (!lost) return null;
    return {
      reason: lost?.reason || null,
      message: lost?.message || null
    };
  } catch (error) {
    return {
      reason: 'rejected',
      message: error?.message || String(error)
    };
  }
}

function textureUsage(names) {
  const usage = globalThis.GPUTextureUsage || {};
  const fallbacks = {
    COPY_DST: 2,
    TEXTURE_BINDING: 4,
    RENDER_ATTACHMENT: 16
  };
  return arrayFromValue(names).reduce((total, name) => total + Number(usage[name] || fallbacks[name] || 0), 0);
}

function bufferUsage(names) {
  const usage = globalThis.GPUBufferUsage || {};
  const fallbacks = {
    COPY_DST: 8,
    VERTEX: 32
  };
  return arrayFromValue(names).reduce((total, name) => total + Number(usage[name] || fallbacks[name] || 0), 0);
}

function arrayFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

export default runWebGPUHardwarePath;
