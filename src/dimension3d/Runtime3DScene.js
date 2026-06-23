import { createOmniError } from '../core/OmniError.js';

const DEFAULT_CAMERA = {
  position: { x: 0, y: 2, z: 6 },
  target: { x: 0, y: 0, z: 0 },
  fov: 60,
  near: 0.1,
  far: 1000
};

export class Runtime3DScene {
  constructor({
    name = 'runtime-3d-scene',
    background = '#000000',
    units = 'meters'
  } = {}) {
    this.name = String(name);
    this.background = background;
    this.units = String(units);
    this.cameras = new Map();
    this.lights = new Map();
    this.materials = new Map();
    this.models = new Map();
    this.activeCameraId = null;
  }

  addCamera(options = {}) {
    const id = String(options.id || `camera-${this.cameras.size + 1}`);
    const camera = {
      id,
      type: 'Camera3D',
      mode: String(options.mode || 'orbit'),
      controls: normalizeStringArray(options.controls || [options.mode || 'orbit']),
      fov: positiveNumber(options.fov, DEFAULT_CAMERA.fov),
      near: positiveNumber(options.near, DEFAULT_CAMERA.near),
      far: positiveNumber(options.far, DEFAULT_CAMERA.far),
      position: normalizeVector3(options.position, DEFAULT_CAMERA.position),
      target: normalizeVector3(options.target, DEFAULT_CAMERA.target)
    };
    this.cameras.set(id, camera);
    this.activeCameraId = options.active === false && this.activeCameraId ? this.activeCameraId : id;
    return clone(camera);
  }

  addLight(options = {}) {
    const id = String(options.id || `${options.type || 'directional'}-${this.lights.size + 1}`);
    const light = {
      id,
      type: 'Light3D',
      lightType: String(options.type || options.lightType || 'directional'),
      color: options.color || '#ffffff',
      intensity: numberOr(options.intensity, 1),
      castShadow: Boolean(options.castShadow),
      shadow: {
        mapSize: positiveNumber(options.shadow?.mapSize, 1024),
        bias: numberOr(options.shadow?.bias, -0.0001)
      },
      position: normalizeVector3(options.position, { x: 0, y: 4, z: 4 }),
      target: normalizeVector3(options.target, { x: 0, y: 0, z: 0 })
    };
    this.lights.set(id, light);
    return clone(light);
  }

  addPBRMaterial(id, options = {}) {
    const material = {
      id: String(id || options.id || `pbr-material-${this.materials.size + 1}`),
      type: 'PBRMaterial',
      workflow: String(options.workflow || 'metallic-roughness'),
      baseColor: options.baseColor || options.color || '#ffffff',
      metallic: clamp01(options.metallic, 0),
      roughness: clamp01(options.roughness, 0.5),
      normalMap: options.normalMap || null,
      occlusionMap: options.occlusionMap || null,
      emissive: options.emissive || null,
      alphaMode: options.alphaMode || (options.transparent ? 'blend' : 'opaque')
    };
    this.materials.set(material.id, material);
    return clone(material);
  }

  addGLTFModel(options = {}) {
    const id = String(options.id || options.name || `gltf-model-${this.models.size + 1}`);
    const animations = normalizeStringArray(options.animations);
    const model = {
      id,
      type: 'GLTFModel',
      url: String(options.url || options.path || ''),
      material: options.material || null,
      position: normalizeVector3(options.position),
      rotation: normalizeVector3(options.rotation),
      scale: normalizeVector3(options.scale, { x: 1, y: 1, z: 1 }),
      animations,
      activeAnimation: options.animation || animations[0] || null,
      collider: normalizeCollider(options.collider),
      rigidBody: normalizeRigidBody(options.rigidBody),
      physicsBinding: normalizePhysicsBinding(options.physicsBinding),
      castShadow: Boolean(options.castShadow),
      receiveShadow: options.receiveShadow !== false
    };
    this.models.set(id, model);
    return clone(model);
  }

  playAnimation(modelId, animationName, options = {}) {
    const model = this.models.get(modelId);
    if (!model) throw createOmniError('Runtime3DScene', `unknown 3D model: ${modelId}`);
    const animation = String(animationName || '');
    if (!model.animations.includes(animation)) model.animations.push(animation);
    model.activeAnimation = animation;
    model.animationState = {
      loop: options.loop !== false,
      speed: positiveNumber(options.speed, 1),
      fadeMs: Math.max(0, numberOr(options.fadeMs, 0))
    };
    return clone(model);
  }

  bindPhysicsBody(modelId, binding = {}) {
    const model = this.models.get(modelId);
    if (!model) throw createOmniError('Runtime3DScene', `unknown 3D model: ${modelId}`);
    model.physicsBinding = normalizePhysicsBinding(binding);
    return clone(model.physicsBinding);
  }

  createDebugDraw() {
    const colliders = [...this.models.values()]
      .filter((model) => model.collider)
      .map((model) => ({
        id: `collider:${model.id}`,
        modelId: model.id,
        shape: model.collider.shape,
        position: clone(model.position),
        rotation: clone(model.rotation),
        scale: clone(model.scale),
        sensor: Boolean(model.collider.sensor),
        physicsBackend: model.physicsBinding?.backend || null
      }));

    const lights = [...this.lights.values()].map((light) => ({
      id: light.id,
      lightType: light.lightType,
      castShadow: light.castShadow,
      position: clone(light.position)
    }));

    return {
      schema: 'omnicore.runtime-3d-debug-draw.v1',
      colliders,
      lights
    };
  }

  createRuntimeSnapshot() {
    const cameras = [...this.cameras.values()].map(clone);
    const lights = [...this.lights.values()].map(clone);
    const materials = [...this.materials.values()].map(clone);
    const models = [...this.models.values()].map(clone);
    const debugDraw = this.createDebugDraw();
    return {
      schema: 'omnicore.runtime-3d-scene.v1',
      name: this.name,
      background: this.background,
      units: this.units,
      activeCameraId: this.activeCameraId,
      summary: {
        cameraCount: cameras.length,
        lightCount: lights.length,
        pbrMaterialCount: materials.filter((material) => material.type === 'PBRMaterial').length,
        gltfModelCount: models.filter((model) => model.type === 'GLTFModel').length,
        animatedModelCount: models.filter((model) => model.animations.length > 0).length,
        colliderCount: debugDraw.colliders.length,
        physicsBindingCount: models.filter((model) => model.physicsBinding).length,
        shadowCasterCount: lights.filter((light) => light.castShadow).length + models.filter((model) => model.castShadow).length
      },
      cameras,
      lights,
      materials,
      models,
      debugDraw
    };
  }
}

function normalizeCollider(value = null) {
  if (!value) return null;
  return {
    shape: String(value.shape || value.type || 'box'),
    width: positiveNumber(value.width ?? value.size?.x, 1),
    height: positiveNumber(value.height ?? value.size?.y, 1),
    depth: positiveNumber(value.depth ?? value.size?.z, 1),
    radius: numberOr(value.radius, 0),
    sensor: Boolean(value.sensor || value.isSensor)
  };
}

function normalizeRigidBody(value = null) {
  if (!value) return null;
  return {
    type: String(value.type || (value.static ? 'static' : 'dynamic')),
    mass: positiveNumber(value.mass, 1),
    friction: numberOr(value.friction, 0.5),
    restitution: numberOr(value.restitution, 0)
  };
}

function normalizePhysicsBinding(value = null) {
  if (!value) return null;
  return {
    backend: String(value.backend || 'arcade'),
    bodyId: String(value.bodyId || value.id || 'body'),
    colliderId: value.colliderId ? String(value.colliderId) : null
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

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value == null) return [];
  return [String(value)];
}

function clamp01(value, fallback) {
  return Math.max(0, Math.min(1, numberOr(value, fallback)));
}

function positiveNumber(value, fallback) {
  const number = numberOr(value, fallback);
  return number > 0 ? number : fallback;
}

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default Runtime3DScene;
