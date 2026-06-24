import { createScene3DThreeRuntime } from './scene-3d-three-runtime.js';

export function createScene3DEditorRuntimeSession({
  scene = {},
  viewport = {},
  adapters = {},
  sessionId = 'scene-3d-editor-session'
} = {}) {
  return new Scene3DEditorRuntimeSession({
    scene,
    viewport,
    adapters,
    sessionId
  });
}

class Scene3DEditorRuntimeSession {
  constructor({
    scene,
    viewport,
    adapters,
    sessionId
  }) {
    this.sessionId = String(sessionId || 'scene-3d-editor-session');
    this.sceneDescriptor = normalizeScene(scene);
    this.viewport = viewport || {};
    this.adapters = adapters || {};
    this.threeRuntime = null;
    this.importedAssets = [];
    this.resourceDatabase = [];
    this.rapierDebugDraw = null;
    this.webgpuHardware = null;
    this.trace = [];
  }

  mountViewport() {
    this.threeRuntime = createScene3DThreeRuntime({
      ...this.viewport,
      scene: this.sceneDescriptor
    });
    const viewport = this.threeRuntime.mount();
    this.record('mount-viewport', { viewport });
    return {
      schema: 'omnicore.editor-scene-3d-session-mount.v1',
      sessionId: this.sessionId,
      status: 'mounted',
      viewport
    };
  }

  importGLBAsset(file) {
    const importer = this.requireAdapter('importGLBFile');
    const result = importer({ file });
    if (result && typeof result.then === 'function') {
      return result.then((value) => this.applyImportedGLBResult(file, value));
    }
    return this.applyImportedGLBResult(file, result);
  }

  applyImportedGLBResult(file, result = {}) {
    const model = result.workflow?.sceneInsertion?.patch?.runtime?.models?.[0] || null;
    if (model) this.sceneDescriptor.models.push(model);
    const asset = {
      id: result.resourceRecord?.id || model?.id || normalizeModelId(file?.name || file?.path),
      path: result.resourceRecord?.path || file?.path || file?.name || 'asset.glb',
      type: result.resourceRecord?.type || 'model',
      byteLength: result.resourceRecord?.byteLength || 0
    };
    this.importedAssets.push(asset);
    this.resourceDatabase.push({
      ...asset,
      thumbnail: result.thumbnail || null,
      workflowSchema: result.workflow?.schema || null
    });
    this.record('import-glb', { asset, model });
    return {
      ...result,
      modelId: asset.id,
      resourceRecord: result.resourceRecord,
      scenePatch: result.workflow?.sceneInsertion?.patch || null
    };
  }

  selectByPointer(pointer = {}) {
    const runtime = this.requireThreeRuntime();
    const result = runtime.selectByPointer(pointer);
    this.record('select-model', result);
    return result;
  }

  dragSelected(delta = {}) {
    const runtime = this.requireThreeRuntime();
    const result = runtime.dragSelected(delta);
    updateModel(this.sceneDescriptor.models, result.modelId, { position: result.position });
    this.record('drag-model', result);
    return result;
  }

  editMaterial(materialId, patch = {}) {
    const runtime = this.requireThreeRuntime();
    const result = runtime.editMaterial(materialId, patch);
    updateMaterial(this.sceneDescriptor.materials, materialId, patch);
    this.record('edit-material', result);
    return result;
  }

  switchAnimation(modelId, clip) {
    const runtime = this.requireThreeRuntime();
    const result = runtime.switchAnimation(modelId, clip);
    updateModel(this.sceneDescriptor.models, modelId, { activeAnimation: result.clip });
    this.record('switch-animation', result);
    return result;
  }

  applyRapierDebugDraw(payload = {}) {
    const visualizer = this.requireAdapter('createRapierDebugDrawVisualization');
    const visualization = visualizer(payload);
    this.rapierDebugDraw = {
      ...visualization,
      summary: {
        ...visualization.summary,
        overlayCount: visualization.overlays?.length || 0
      }
    };
    this.record('rapier-debug-draw', this.rapierDebugDraw.summary);
    return this.rapierDebugDraw;
  }

  async captureWebGPUHardware(options = {}) {
    const runner = this.requireAdapter('runWebGPUHardwarePath');
    this.webgpuHardware = await runner(options);
    this.record('webgpu-hardware', this.webgpuHardware.validation?.summary || {});
    return this.webgpuHardware;
  }

  createSavePatch() {
    const runtimeSnapshot = this.threeRuntime?.createSnapshot?.() || null;
    const selectedModelId = runtimeSnapshot?.summary?.selectedModelId
      || this.sceneDescriptor.models.find((model) => model.selected)?.id
      || this.sceneDescriptor.models[0]?.id
      || null;
    const patch = {
      schema: 'omnicore.editor-scene-3d-save-patch.v1',
      sessionId: this.sessionId,
      runtime: {
        selectedModelId,
        models: runtimeSnapshot?.models || this.sceneDescriptor.models.map(clone),
        materials: this.sceneDescriptor.materials.map(clone),
        importedAssets: this.importedAssets.map(clone),
        resourceDatabase: this.resourceDatabase.map(clone),
        rapierDebugDraw: this.rapierDebugDraw?.summary || null,
        webgpuHardware: this.webgpuHardware?.validation?.summary || null
      }
    };
    this.record('save-patch', patch.runtime);
    return patch;
  }

  createExportPlan({ target = 'web' } = {}) {
    const normalizedTarget = String(target || 'web');
    const steps = [
      { id: 'write-scene', label: '写入场景 JSON', source: 'createSavePatch' },
      { id: 'bundle-assets', label: '打包 GLB/贴图资源', count: this.importedAssets.length },
      { id: 'include-rapier-debug', label: '附带 Rapier debug overlay', enabled: Boolean(this.rapierDebugDraw) },
      { id: 'include-webgpu-report', label: '附带 WebGPU 硬件报告', enabled: Boolean(this.webgpuHardware) },
      normalizedTarget === 'electron'
        ? { id: 'package-electron', label: '打包 Electron/EXE 项目', target: 'electron' }
        : { id: 'publish-web', label: '导出 Web 项目', target: normalizedTarget }
    ];
    const plan = {
      schema: 'omnicore.editor-scene-3d-export-plan.v1',
      sessionId: this.sessionId,
      target: normalizedTarget,
      steps,
      assets: this.importedAssets.map(clone)
    };
    this.record('export-plan', { target: normalizedTarget, stepCount: steps.length });
    return plan;
  }

  createSnapshot() {
    return {
      schema: 'omnicore.editor-scene-3d-runtime-session.v1',
      sessionId: this.sessionId,
      summary: {
        mounted: Boolean(this.threeRuntime),
        importedAssetCount: this.importedAssets.length,
        resourceCount: this.resourceDatabase.length,
        rapierOverlayCount: this.rapierDebugDraw?.summary?.overlayCount || 0,
        webgpuPassedCount: this.webgpuHardware?.validation?.summary?.webgpuPassedCount || 0
      },
      scene: clone(this.sceneDescriptor),
      importedAssets: this.importedAssets.map(clone),
      resourceDatabase: this.resourceDatabase.map(clone),
      rapierDebugDraw: this.rapierDebugDraw ? clone(this.rapierDebugDraw) : null,
      webgpuHardware: this.webgpuHardware ? clone(this.webgpuHardware) : null,
      trace: this.trace.map(clone)
    };
  }

  requireThreeRuntime() {
    if (!this.threeRuntime) this.mountViewport();
    return this.threeRuntime;
  }

  requireAdapter(name) {
    const adapter = this.adapters[name];
    if (typeof adapter !== 'function') throw new Error(`Scene3DEditorRuntimeSession missing adapter: ${name}`);
    return adapter;
  }

  record(type, payload = {}) {
    const entry = {
      type,
      index: this.trace.length + 1,
      payload: clone(payload)
    };
    this.trace.push(entry);
    return entry;
  }
}

function normalizeScene(scene = {}) {
  return {
    cameras: arrayFromValue(scene.cameras || scene.scene?.cameras).map(clone),
    lights: arrayFromValue(scene.lights || scene.scene?.lights).map(clone),
    materials: arrayFromValue(scene.materials || scene.scene?.materials).map(clone),
    models: arrayFromValue(scene.models || scene.scene?.models).map(clone),
    colliders: arrayFromValue(scene.colliders || scene.scene?.colliders).map(clone)
  };
}

function updateModel(models, modelId, patch = {}) {
  const id = String(modelId || '');
  const index = models.findIndex((model) => model.id === id);
  if (index === -1) return;
  models[index] = { ...models[index], ...clone(patch) };
}

function updateMaterial(materials, materialId, patch = {}) {
  const id = String(materialId || '');
  const index = materials.findIndex((material) => material.id === id);
  if (index === -1) return;
  materials[index] = {
    ...materials[index],
    ...clone(patch),
    baseColor: patch.baseColor || patch.color || materials[index].baseColor
  };
}

function normalizeModelId(value) {
  return String(value || 'model')
    .replace(/\.(glb|gltf)$/iu, '')
    .replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase() || 'model';
}

function arrayFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default createScene3DEditorRuntimeSession;
