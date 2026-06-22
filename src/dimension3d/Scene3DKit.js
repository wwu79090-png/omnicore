/**
 * Full 3D authoring kit for scene composition, free cameras, lights, shadows,
 * PBR materials, GLTF/GLB animation metadata, post effects, and asset validation.
 */
const DEFAULT_CAPABILITIES = [
  'full-3d-scene',
  'free-camera',
  'shadow-map',
  'pbr-material',
  'gltf-animation',
  'postprocessing',
  'physics-binding'
];

export class Scene3DKit {
  constructor({
    name = 'scene-3d',
    width = 1280,
    height = 720,
    background = '#000000'
  } = {}) {
    this.name = String(name);
    this.width = positiveNumber(width, 1280);
    this.height = positiveNumber(height, 720);
    this.background = background;
    this.cameras = new Map();
    this.lights = new Map();
    this.materials = new Map();
    this.models = new Map();
    this.postprocess = [];
    this.activeCameraId = null;
    this.capabilities = [...DEFAULT_CAPABILITIES];
  }

  setCamera(options = {}) {
    const id = String(options.id || 'main-camera');
    const camera = {
      id,
      type: 'camera',
      mode: options.mode || 'free',
      controls: normalizeArray(options.controls || ['orbit']),
      fov: positiveNumber(options.fov, 60),
      near: positiveNumber(options.near, 0.1),
      far: positiveNumber(options.far, 1000),
      position: normalizeVector3(options.position, { x: 0, y: 2, z: 6 }),
      target: normalizeVector3(options.target, { x: 0, y: 0, z: 0 })
    };
    this.cameras.set(id, camera);
    this.activeCameraId = id;
    return camera;
  }

  addLight(idOrType, options = {}) {
    const inferredType = options.type || idOrType || 'directional';
    const id = options.id || (options.type ? idOrType : `${inferredType}-${this.lights.size + 1}`);
    const light = {
      id: String(id),
      type: 'Light',
      lightType: String(inferredType),
      intensity: numberOr(options.intensity, 1),
      color: options.color || '#ffffff',
      castShadow: Boolean(options.castShadow),
      shadow: normalizeShadow(options.shadow),
      position: normalizeVector3(options.position, { x: 0, y: 4, z: 4 })
    };
    this.lights.set(light.id, light);
    return light;
  }

  addMaterial(id, options = {}) {
    const material = {
      id: String(id || `material-${this.materials.size + 1}`),
      type: options.type || 'pbr',
      workflow: options.workflow || 'metallic-roughness',
      baseColor: options.baseColor || options.color || '#ffffff',
      metallic: clamp01(options.metallic, 0),
      roughness: clamp01(options.roughness, 0.5),
      normalMap: options.normalMap || null,
      emissive: options.emissive || null,
      transparent: Boolean(options.transparent),
      opacity: clamp01(options.opacity, 1)
    };
    this.materials.set(material.id, material);
    return material;
  }

  addGLTFModel(options = {}) {
    const id = String(options.id || options.name || `model-${this.models.size + 1}`);
    const model = {
      id,
      type: 'Model',
      sourceType: 'gltf',
      url: String(options.url || options.path || ''),
      position: normalizeVector3(options.position),
      rotation: normalizeVector3(options.rotation),
      scale: normalizeVector3(options.scale, { x: 1, y: 1, z: 1 }),
      material: options.material || null,
      animations: normalizeArray(options.animations).map(String),
      activeAnimation: options.animation || normalizeArray(options.animations)[0] || null,
      physics: {
        rigidBody: normalizeRigidBody(options.rigidBody),
        collider: normalizeCollider(options.collider)
      },
      castShadow: options.castShadow !== false,
      receiveShadow: options.receiveShadow !== false
    };
    this.models.set(id, model);
    return model;
  }

  addPostProcess(options = {}) {
    const pass = {
      id: String(options.id || `${options.type || 'pass'}-${this.postprocess.length + 1}`),
      type: String(options.type || 'custom'),
      enabled: options.enabled !== false,
      budgetMs: numberOr(options.budgetMs, 0),
      order: numberOr(options.order, this.postprocess.length)
    };
    this.postprocess.push(pass);
    this.postprocess.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    return pass;
  }

  validateAssets({ availableAssets = [] } = {}) {
    const available = new Set(availableAssets.map(String));
    const requiredAssets = [];
    for (const model of this.models.values()) {
      if (model.url) requiredAssets.push({ type: 'model', owner: model.id, path: model.url });
    }
    for (const material of this.materials.values()) {
      if (material.normalMap) requiredAssets.push({ type: 'normalMap', owner: material.id, path: material.normalMap });
      if (material.emissive) requiredAssets.push({ type: 'emissive', owner: material.id, path: material.emissive });
    }
    const missingAssets = requiredAssets
      .filter((asset) => !available.has(asset.path))
      .map((asset) => asset.path);
    return {
      format: 'OmniCore.Scene3DAssetValidation',
      ok: missingAssets.length === 0,
      requiredAssets,
      missingAssets,
      modelCount: this.models.size,
      lightCount: this.lights.size,
      pbrMaterialCount: [...this.materials.values()].filter((material) => material.type === 'pbr').length,
      postprocessCount: this.postprocess.length
    };
  }

  createDebugDemo() {
    const activeCamera = this.cameras.get(this.activeCameraId) || null;
    return {
      format: 'OmniCore.Scene3DDebugDemo',
      scene: {
        name: this.name,
        width: this.width,
        height: this.height,
        background: this.background
      },
      activeCamera,
      cameras: [...this.cameras.values()],
      lights: [...this.lights.values()],
      materials: [...this.materials.values()],
      models: [...this.models.values()],
      postprocess: [...this.postprocess],
      debugDraw: [
        ...[...this.cameras.values()].map((camera) => ({
          type: 'camera-frustum',
          id: camera.id,
          position: camera.position,
          target: camera.target
        })),
        ...[...this.lights.values()].filter((light) => light.castShadow).map((light) => ({
          type: 'shadow-map',
          id: light.id,
          mapSize: light.shadow.mapSize
        })),
        ...[...this.models.values()].filter((model) => model.physics.collider).map((model) => ({
          type: 'collider',
          id: model.id,
          shape: model.physics.collider.shape,
          position: model.position
        }))
      ]
    };
  }
}

function normalizeRigidBody(value = null) {
  if (!value) return null;
  return {
    type: value.type || 'dynamic',
    mass: numberOr(value.mass, value.type === 'static' ? 0 : 1),
    linearDamping: numberOr(value.linearDamping, 0),
    angularDamping: numberOr(value.angularDamping, 0)
  };
}

function normalizeCollider(value = null) {
  if (!value) return null;
  return {
    shape: value.shape || value.type || 'box',
    radius: numberOr(value.radius, 0),
    height: numberOr(value.height, 0),
    width: numberOr(value.width, value.size?.[0], 1),
    depth: numberOr(value.depth, value.size?.[2], 1),
    sensor: Boolean(value.sensor || value.isSensor)
  };
}

function normalizeShadow(value = {}) {
  return {
    mapSize: positiveNumber(value.mapSize, 1024),
    bias: numberOr(value.bias, -0.0001),
    normalBias: numberOr(value.normalBias, 0)
  };
}

function normalizeVector3(value = {}, fallback = { x: 0, y: 0, z: 0 }) {
  if (typeof value === 'number') return { x: value, y: value, z: value };
  return {
    x: numberOr(value?.x, fallback.x),
    y: numberOr(value?.y, fallback.y),
    z: numberOr(value?.z, fallback.z)
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clamp01(value, fallback) {
  return Math.max(0, Math.min(1, numberOr(value, fallback)));
}

function positiveNumber(value, fallback) {
  return Math.max(0.0001, numberOr(value, fallback));
}

function numberOr(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

export default Scene3DKit;
