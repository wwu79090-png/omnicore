export function createScene3DThreeRuntime({
  THREE,
  OrbitControls = null,
  TransformControls = null,
  canvas = null,
  scene = {},
  width = 1280,
  height = 720
} = {}) {
  if (!THREE) throw new Error('createScene3DThreeRuntime requires a THREE implementation.');

  return new Scene3DThreeRuntime({
    THREE,
    OrbitControls,
    TransformControls,
    canvas,
    scene,
    width,
    height
  });
}

class Scene3DThreeRuntime {
  constructor({
    THREE,
    OrbitControls,
    TransformControls,
    canvas,
    scene,
    width,
    height
  }) {
    this.THREE = THREE;
    this.OrbitControls = OrbitControls;
    this.TransformControls = TransformControls;
    this.canvas = canvas;
    this.descriptor = scene || {};
    this.width = width;
    this.height = height;
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.orbitControls = null;
    this.transformControls = null;
    this.raycaster = null;
    this.materials = new Map();
    this.models = new Map();
    this.mixers = new Map();
    this.selectedModelId = null;
    this.trace = [];
  }

  mount() {
    this.scene = new this.THREE.Scene();
    this.renderer = new this.THREE.WebGLRenderer({ antialias: true, canvas: this.canvas || undefined });
    this.renderer.setSize?.(this.width, this.height);
    if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = true;
    this.camera = this.createCamera(this.descriptor.cameras?.[0]);
    this.buildLights();
    this.buildMaterials();
    this.buildModels();
    this.orbitControls = this.OrbitControls ? new this.OrbitControls(this.camera, this.renderer.domElement || this.canvas) : null;
    this.transformControls = this.TransformControls ? new this.TransformControls(this.camera, this.renderer.domElement || this.canvas) : null;
    this.transformControls?.setMode?.('translate');
    this.raycaster = new this.THREE.Raycaster();
    this.trace.push({ type: 'mount', modelCount: this.models.size });

    return {
      renderer: this.renderer.constructor?.name || 'WebGLRenderer',
      orbitControls: Boolean(this.orbitControls),
      transformControls: Boolean(this.transformControls),
      raycaster: Boolean(this.raycaster),
      canvasId: this.canvas?.id || null
    };
  }

  selectByPointer(pointer = {}) {
    this.ensureMounted();
    const normalized = normalizePointer(pointer);
    this.raycaster.setFromCamera?.(normalized, this.camera);
    const objects = [...this.models.values()].map((entry) => entry.object);
    const hits = this.raycaster.intersectObjects?.(objects, true) || [];
    const hitObject = hits[0]?.object || null;
    const selected = hitObject ? this.findModelEntry(hitObject) : null;
    this.selectedModelId = selected?.id || null;
    if (selected) this.transformControls?.attach?.(selected.object);
    this.trace.push({ type: 'select-model', modelId: this.selectedModelId, pointer: normalized });
    return { selectedModelId: this.selectedModelId, hit: Boolean(selected) };
  }

  dragSelected(delta = {}) {
    this.ensureMounted();
    const selected = this.selectedModelId ? this.models.get(this.selectedModelId) : null;
    if (!selected) return { modelId: null, position: null };
    const position = addVector(selected.object.position, delta);
    writeVector3(selected.object.position, position);
    selected.descriptor.position = position;
    this.trace.push({ type: 'drag-model', modelId: selected.id, position: clone(position) });
    return { modelId: selected.id, position: clone(position) };
  }

  editMaterial(materialId, patch = {}) {
    this.ensureMounted();
    const material = this.materials.get(String(materialId));
    if (!material) return { materialId: String(materialId), material: null, changed: false };
    if (patch.baseColor || patch.color) {
      material.descriptor.baseColor = patch.baseColor || patch.color;
      material.instance.color = patch.baseColor || patch.color;
    }
    if (patch.roughness != null) {
      material.descriptor.roughness = Number(patch.roughness);
      material.instance.roughness = Number(patch.roughness);
    }
    if (patch.metallic != null || patch.metalness != null) {
      material.descriptor.metallic = Number(patch.metallic ?? patch.metalness);
      material.instance.metalness = Number(patch.metallic ?? patch.metalness);
    }
    this.trace.push({ type: 'edit-material', materialId: String(materialId), patch: clone(patch) });
    return {
      materialId: String(materialId),
      changed: true,
      material: {
        id: String(materialId),
        color: material.descriptor.baseColor,
        roughness: material.descriptor.roughness,
        metallic: material.descriptor.metallic
      }
    };
  }

  switchAnimation(modelId, clipName) {
    this.ensureMounted();
    const model = this.models.get(String(modelId));
    if (!model) return { modelId: String(modelId), clip: null, changed: false };
    const clip = model.clips.find((candidate) => candidate.name === clipName) || { name: String(clipName) };
    const mixer = model.mixer || null;
    const action = mixer?.clipAction?.(clip);
    action?.play?.();
    model.activeAnimation = clip.name;
    model.descriptor.activeAnimation = clip.name;
    this.trace.push({ type: 'switch-animation', modelId: model.id, clip: clip.name });
    return { modelId: model.id, clip: clip.name, changed: true };
  }

  renderFrame(delta = 1 / 60) {
    this.ensureMounted();
    for (const mixer of this.mixers.values()) mixer.update?.(delta);
    this.orbitControls?.update?.();
    this.renderer.render?.(this.scene, this.camera);
    this.trace.push({ type: 'render-frame', delta: Number(delta) });
    return this.createSnapshot();
  }

  createSnapshot() {
    return {
      schema: 'omnicore.scene-3d-three-runtime.v1',
      summary: {
        renderer: this.renderer?.constructor?.name || 'WebGLRenderer',
        modelCount: this.models.size,
        materialCount: this.materials.size,
        selectedModelId: this.selectedModelId,
        orbitControls: Boolean(this.orbitControls),
        transformControls: Boolean(this.transformControls),
        raycaster: Boolean(this.raycaster)
      },
      models: [...this.models.values()].map((entry) => ({
        id: entry.id,
        activeAnimation: entry.activeAnimation || entry.descriptor.activeAnimation || null,
        position: vectorToObject(entry.object.position),
        material: entry.descriptor.material || null
      })),
      trace: this.trace.map(clone)
    };
  }

  createCamera(camera = {}) {
    const aspect = this.height > 0 ? this.width / this.height : 1;
    const instance = new this.THREE.PerspectiveCamera(camera?.fov || 60, aspect, camera?.near || 0.1, camera?.far || 1000);
    writeVector3(instance.position, camera?.position || { x: 0, y: 2, z: 5 });
    instance.lookAt?.(camera?.target?.x || 0, camera?.target?.y || 0, camera?.target?.z || 0);
    this.scene.add?.(instance);
    return instance;
  }

  buildLights() {
    for (const light of arrayFromValue(this.descriptor.lights)) {
      const instance = new this.THREE.DirectionalLight(light.color || '#ffffff', light.intensity ?? 1);
      instance.castShadow = Boolean(light.castShadow);
      writeVector3(instance.position, light.position || { x: 2, y: 4, z: 3 });
      this.scene.add?.(instance);
    }
  }

  buildMaterials() {
    for (const material of arrayFromValue(this.descriptor.materials)) {
      const id = String(material.id || material.name || `material-${this.materials.size + 1}`);
      const descriptor = {
        ...clone(material),
        id,
        baseColor: material.baseColor || material.color || '#ffffff',
        roughness: material.roughness ?? 0.5,
        metallic: material.metallic ?? material.metalness ?? 0
      };
      const instance = new this.THREE.MeshStandardMaterial({
        color: descriptor.baseColor,
        roughness: descriptor.roughness,
        metalness: descriptor.metallic
      });
      this.materials.set(id, { id, descriptor, instance });
    }
  }

  buildModels() {
    for (const model of arrayFromValue(this.descriptor.models)) {
      const id = String(model.id || model.name || `model-${this.models.size + 1}`);
      const material = this.materials.get(String(model.material))?.instance
        || this.materials.values().next().value?.instance
        || new this.THREE.MeshStandardMaterial({ color: '#ffffff' });
      const object = new this.THREE.Mesh(new this.THREE.BoxGeometry(1, 1, 1), material);
      object.name = id;
      writeVector3(object.position, model.position);
      writeVector3(object.rotation, model.rotation);
      writeVector3(object.scale, model.scale || { x: 1, y: 1, z: 1 });
      object.castShadow = Boolean(model.castShadow);
      object.receiveShadow = model.receiveShadow !== false;
      this.scene.add?.(object);
      const clips = arrayFromValue(model.animations).map((name) => ({ name: String(name) }));
      const mixer = this.THREE.AnimationMixer ? new this.THREE.AnimationMixer(object) : null;
      if (mixer) this.mixers.set(id, mixer);
      this.models.set(id, {
        id,
        descriptor: { ...clone(model), id },
        object,
        clips,
        mixer,
        activeAnimation: model.activeAnimation || clips[0]?.name || null
      });
    }
  }

  findModelEntry(object) {
    for (const entry of this.models.values()) {
      if (entry.object === object || entry.object.children?.includes?.(object) || object.name === entry.id) return entry;
    }
    return null;
  }

  ensureMounted() {
    if (!this.scene || !this.renderer) this.mount();
  }
}

function normalizePointer(pointer = {}) {
  return {
    x: Number(pointer.x ?? 0),
    y: Number(pointer.y ?? 0)
  };
}

function writeVector3(target, value = {}) {
  if (!target?.set) return;
  target.set(Number(value?.x || 0), Number(value?.y || 0), Number(value?.z || 0));
}

function addVector(target, delta = {}) {
  return {
    x: Number(target?.x || 0) + Number(delta.x || 0),
    y: Number(target?.y || 0) + Number(delta.y || 0),
    z: Number(target?.z || 0) + Number(delta.z || 0)
  };
}

function vectorToObject(value = {}) {
  return {
    x: Number(value.x || 0),
    y: Number(value.y || 0),
    z: Number(value.z || 0)
  };
}

function arrayFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

export default createScene3DThreeRuntime;
