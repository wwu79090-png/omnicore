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

  createReadinessReport({ availableAssets = [], budgets = {} } = {}) {
    const validation = this.validateAssets({ availableAssets });
    const activeCamera = this.cameras.get(this.activeCameraId) || null;
    const models = [...this.models.values()];
    const lights = [...this.lights.values()];
    const enabledPostprocess = this.postprocess.filter((pass) => pass.enabled);
    const postprocessMs = roundSceneNumber(enabledPostprocess.reduce((total, pass) => total + numberOr(pass.budgetMs, 0), 0));
    const maxShadowMapSize = numberOrNull(budgets.maxShadowMapSize);
    const postprocessBudgetMs = numberOrNull(budgets.postprocessMs);
    const issues = [];

    for (const asset of validation.requiredAssets) {
      if (!validation.missingAssets.includes(asset.path)) continue;
      issues.push({
        id: `missing-asset:${asset.path}`,
        severity: 'error',
        type: 'missing-asset',
        path: asset.path,
        owner: asset.owner,
        assetType: asset.type,
        message: `3D asset is missing: ${asset.path}`
      });
    }

    for (const model of models) {
      if (model.material && !this.materials.has(model.material)) {
        issues.push({
          id: `missing-material:${model.id}:${model.material}`,
          severity: 'error',
          type: 'missing-material',
          modelId: model.id,
          materialId: model.material,
          message: `3D model ${model.id} references missing material ${model.material}.`
        });
      }
      if (model.physics.rigidBody && !model.physics.collider) {
        issues.push({
          id: `missing-collider:${model.id}`,
          severity: 'warning',
          type: 'missing-collider',
          modelId: model.id,
          rigidBodyType: model.physics.rigidBody.type,
          message: `3D model ${model.id} has a rigid body but no collider.`
        });
      }
    }

    for (const light of lights) {
      if (maxShadowMapSize !== null && light.castShadow && light.shadow.mapSize > maxShadowMapSize) {
        issues.push({
          id: `shadow-map-budget:${light.id}`,
          severity: 'warning',
          type: 'shadow-map-budget',
          lightId: light.id,
          mapSize: light.shadow.mapSize,
          budget: maxShadowMapSize,
          message: `Shadow map ${light.id} is ${light.shadow.mapSize}, above budget ${maxShadowMapSize}.`
        });
      }
    }

    if (postprocessBudgetMs !== null && postprocessMs > postprocessBudgetMs) {
      issues.push({
        id: 'postprocess-budget',
        severity: 'warning',
        type: 'postprocess-budget',
        postprocessMs,
        budget: postprocessBudgetMs,
        passes: enabledPostprocess.map((pass) => pass.id),
        message: `Postprocess cost ${postprocessMs}ms exceeds budget ${postprocessBudgetMs}ms.`
      });
    }

    const missingMaterialCount = issues.filter((issue) => issue.type === 'missing-material').length;
    const missingColliderCount = issues.filter((issue) => issue.type === 'missing-collider').length;
    const shadowBudgetIssueCount = issues.filter((issue) => issue.type === 'shadow-map-budget').length;
    const postprocessBudgetIssueCount = issues.filter((issue) => issue.type === 'postprocess-budget').length;
    const colliderCount = models.filter((model) => model.physics.collider).length;
    const dynamicBodyCount = models.filter((model) => model.physics.rigidBody?.type !== 'static' && model.physics.rigidBody).length;
    const debugDemo = this.createDebugDemo();

    return {
      format: 'OmniCore.Scene3DReadinessReport',
      ok: issues.length === 0,
      scene: debugDemo.scene,
      summary: {
        cameraCount: this.cameras.size,
        lightCount: lights.length,
        modelCount: models.length,
        materialCount: this.materials.size,
        colliderCount,
        dynamicBodyCount,
        shadowMapMaxSize: lights.reduce((max, light) => Math.max(max, light.castShadow ? light.shadow.mapSize : 0), 0),
        postprocessMs,
        issueCount: issues.length
      },
      gates: [
        createReadinessGate('camera', 'Active camera', Boolean(activeCamera), { cameraId: activeCamera?.id || null }),
        createReadinessGate('assets', 'Required 3D assets', validation.missingAssets.length === 0, { missingCount: validation.missingAssets.length }),
        createReadinessGate('materials', 'Model material references', missingMaterialCount === 0, { missingCount: missingMaterialCount }),
        createReadinessGate('shadow-map-budget', 'Shadow map budget', shadowBudgetIssueCount === 0, { budget: maxShadowMapSize }),
        createReadinessGate('postprocess-budget', 'Postprocess budget', postprocessBudgetIssueCount === 0, { budget: postprocessBudgetMs, totalMs: postprocessMs }),
        createReadinessGate('physics-binding', 'Rigid body collider bindings', missingColliderCount === 0, { missingCount: missingColliderCount })
      ],
      issues,
      recommendations: issues.map((issue) => createReadinessRecommendation(issue)),
      requiredAssets: validation.requiredAssets,
      missingAssets: validation.missingAssets,
      debugDraw: debugDemo.debugDraw,
      crossEngineProfile: {
        sources: [
          { engine: 'Godot', advantage: 'scene diagnostics should reveal missing resources and visible collision data before play' },
          { engine: 'Unity', advantage: 'lighting, shadow, material, and physics readiness should be checked at edit time' },
          { engine: 'Unreal', advantage: 'map checks should turn scene problems into actionable fix records' },
          { engine: 'Three.js', advantage: 'renderer-facing budgets should stay explicit for postprocess and shadow cost' }
        ],
        capabilities: [
          'scene-3d-readiness-report',
          '3d-asset-material-audit',
          'shadow-postprocess-budget-gates',
          'physics-collider-binding-check',
          'debug-draw-export'
        ]
      }
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

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundSceneNumber(value) {
  return Number(Number(value || 0).toFixed(6));
}

function createReadinessGate(id, label, ok, details = {}) {
  return {
    id,
    label,
    ok: Boolean(ok),
    ...details
  };
}

function createReadinessRecommendation(issue = {}) {
  if (issue.type === 'missing-asset') return `addAsset:${issue.path}`;
  if (issue.type === 'missing-material') return `createMaterial:${issue.materialId}`;
  if (issue.type === 'missing-collider') return `addCollider:${issue.modelId}`;
  if (issue.type === 'shadow-map-budget') return `reduceShadowMap:${issue.lightId}:${issue.budget}`;
  if (issue.type === 'postprocess-budget') return `optimizePostprocess:${issue.postprocessMs}>${issue.budget}`;
  return `inspect3DScene:${issue.id || issue.type || 'unknown'}`;
}

export default Scene3DKit;
