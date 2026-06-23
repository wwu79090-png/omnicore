import { createOmniError } from '../core/OmniError.js';

export class ThreeRuntimeAdapter {
  constructor({
    THREE,
    GLTFLoader = null,
    EffectComposer = null,
    RenderPass = null,
    canvas = null,
    width = 1280,
    height = 720,
    postprocess = []
  } = {}) {
    if (!THREE) throw createOmniError('ThreeRuntimeAdapter', 'THREE dependency is required.');
    this.THREE = THREE;
    this.GLTFLoader = GLTFLoader;
    this.EffectComposer = EffectComposer;
    this.RenderPass = RenderPass;
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.postprocess = Array.isArray(postprocess) ? postprocess : [];
    this.runtimeSnapshot = null;
    this.scene = null;
    this.renderer = null;
    this.composer = null;
    this.activeCamera = null;
    this.cameras = new Map();
    this.lights = new Map();
    this.materials = new Map();
    this.models = new Map();
    this.mixers = new Map();
  }

  async build(runtimeScene) {
    this.runtimeSnapshot = typeof runtimeScene?.createRuntimeSnapshot === 'function'
      ? runtimeScene.createRuntimeSnapshot()
      : clone(runtimeScene || {});
    this.scene = new this.THREE.Scene();
    if (this.THREE.Color) this.scene.background = new this.THREE.Color(this.runtimeSnapshot.background || '#000000');
    this.renderer = new this.THREE.WebGLRenderer({ antialias: true, canvas: this.canvas || undefined });
    this.renderer.setSize?.(this.width, this.height);
    if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = true;
    this.buildCameras();
    this.buildLights();
    this.buildMaterials();
    this.buildComposer();
    return this;
  }

  buildCameras() {
    const aspect = this.height > 0 ? this.width / this.height : 1;
    for (const camera of this.runtimeSnapshot.cameras || []) {
      const instance = new this.THREE.PerspectiveCamera(camera.fov || 60, aspect, camera.near || 0.1, camera.far || 1000);
      writeVector3(instance.position, camera.position);
      instance.lookAt?.(camera.target?.x || 0, camera.target?.y || 0, camera.target?.z || 0);
      this.cameras.set(camera.id, { descriptor: camera, instance });
      this.scene.add?.(instance);
      if (camera.id === this.runtimeSnapshot.activeCameraId || !this.activeCamera) this.activeCamera = instance;
    }
  }

  buildLights() {
    for (const light of this.runtimeSnapshot.lights || []) {
      const instance = new this.THREE.DirectionalLight(light.color || '#ffffff', light.intensity ?? 1);
      writeVector3(instance.position, light.position);
      instance.castShadow = Boolean(light.castShadow);
      if (instance.shadow?.mapSize?.set) instance.shadow.mapSize.set(light.shadow?.mapSize || 1024, light.shadow?.mapSize || 1024);
      this.lights.set(light.id, { descriptor: light, instance });
      this.scene.add?.(instance);
    }
  }

  buildMaterials() {
    for (const material of this.runtimeSnapshot.materials || []) {
      const instance = new this.THREE.MeshStandardMaterial({
        color: material.baseColor || '#ffffff',
        metalness: material.metallic ?? 0,
        roughness: material.roughness ?? 0.5,
        transparent: material.alphaMode === 'blend'
      });
      this.materials.set(material.id, { descriptor: material, instance });
    }
  }

  buildComposer() {
    if (!this.EffectComposer || !this.RenderPass || !this.renderer || !this.activeCamera || !this.postprocess.length) return;
    this.composer = new this.EffectComposer(this.renderer);
    this.composer.addPass?.(new this.RenderPass(this.scene, this.activeCamera));
  }

  async loadModels() {
    if (!this.GLTFLoader) return [];
    const loader = new this.GLTFLoader();
    const loaded = [];
    for (const model of this.runtimeSnapshot.models || []) {
      if (!model.url) continue;
      const gltf = await loader.loadAsync(model.url);
      const object = gltf.scene;
      writeVector3(object.position, model.position);
      writeVector3(object.rotation, model.rotation);
      writeVector3(object.scale, model.scale);
      object.traverse?.((child) => {
        if (child.isMesh || child.type === 'Mesh') {
          child.castShadow = Boolean(model.castShadow);
          child.receiveShadow = model.receiveShadow !== false;
          const material = this.materials.get(model.material);
          if (material) child.material = material.instance;
        }
      });
      this.scene.add?.(object);
      const clips = Array.isArray(gltf.animations) ? gltf.animations : [];
      const mixer = new this.THREE.AnimationMixer(object);
      const entry = {
        descriptor: model,
        object,
        clips,
        mixer,
        activeAnimation: null,
        loaded: true
      };
      this.models.set(model.id, entry);
      this.mixers.set(model.id, mixer);
      if (model.activeAnimation) this.playAnimation(model.id, model.activeAnimation);
      loaded.push(model.id);
    }
    return loaded;
  }

  playAnimation(modelId, clipName) {
    const model = this.models.get(modelId);
    if (!model) throw createOmniError('ThreeRuntimeAdapter', `3D model is not loaded: ${modelId}`);
    const clip = model.clips.find((candidate) => candidate.name === clipName) || { name: clipName };
    const action = model.mixer.clipAction(clip);
    action.play?.();
    model.activeAnimation = clip.name;
    model.descriptor.activeAnimation = clip.name;
    return { modelId, clip: clip.name };
  }

  renderFrame(delta = 1 / 60) {
    for (const mixer of this.mixers.values()) mixer.update?.(delta);
    if (this.composer) this.composer.render?.();
    else this.renderer?.render?.(this.scene, this.activeCamera);
    return this.createSnapshot();
  }

  createSnapshot() {
    const models = [...this.models.entries()].map(([id, model]) => ({
      id,
      url: model.descriptor.url,
      activeAnimation: model.activeAnimation || model.descriptor.activeAnimation || null,
      castShadow: Boolean(model.descriptor.castShadow),
      receiveShadow: model.descriptor.receiveShadow !== false,
      loaded: model.loaded
    }));
    return {
      schema: 'omnicore.three-runtime-adapter.v1',
      summary: {
        renderer: this.renderer?.type || this.renderer?.constructor?.name || 'WebGLRenderer',
        cameraCount: this.cameras.size,
        lightCount: this.lights.size,
        materialCount: this.materials.size,
        modelCount: models.length,
        gltfLoadedCount: models.filter((model) => model.loaded).length,
        mixerCount: this.mixers.size,
        composerEnabled: Boolean(this.composer),
        shadowMapEnabled: Boolean(this.renderer?.shadowMap?.enabled)
      },
      models
    };
  }
}

function writeVector3(target, value = {}) {
  if (!target?.set) return;
  target.set(Number(value.x || 0), Number(value.y || 0), Number(value.z || 0));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default ThreeRuntimeAdapter;
