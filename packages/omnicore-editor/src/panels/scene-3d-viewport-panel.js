export function createScene3DViewportRenderState(input = {}, options = {}) {
  const models = arrayFromValue(input.models || input.scene?.models).map((model) => ({
    ...clone(model),
    id: String(model.id || model.name || 'model'),
    url: model.url || model.path || model.gltf || model.glb || null,
    animations: stringList(model.animations || model.clips),
    activeAnimation: model.activeAnimation || model.animation || stringList(model.animations || model.clips)[0] || null
  }));
  const lights = arrayFromValue(input.lights || input.scene?.lights);
  const colliders = arrayFromValue(input.colliders).length
    ? arrayFromValue(input.colliders)
    : models.filter((model) => model.collider).map((model) => ({ modelId: model.id, ...clone(model.collider) }));
  const shadowLightCount = lights.filter((light) => light.castShadow).length;
  const animationTarget = models.find((model) => model.activeAnimation) || null;

  return {
    runtimeAdapter: options.runtimeAdapter || input.runtimeAdapter || 'three',
    renderMode: options.renderMode || input.renderMode || 'inspect',
    gltfPreloadQueue: [...new Set(models.map((model) => model.url).filter(Boolean))],
    animationPreview: animationTarget ? {
      modelId: animationTarget.id,
      clip: animationTarget.activeAnimation
    } : null,
    materialInspector: {
      editable: true,
      materialIds: arrayFromValue(input.materials || input.scene?.materials).map((material) => String(material.id || material.name || 'material'))
    },
    overlays: {
      colliders: colliders.length > 0,
      lights: lights.length > 0,
      shadows: shadowLightCount > 0
    },
    renderChecklist: [
      { id: 'three-adapter', ok: true, label: 'Three.js adapter' },
      { id: 'gltf-preload', ok: models.every((model) => !model.url || model.url.endsWith('.glb') || model.url.endsWith('.gltf')), label: 'GLTF/GLB preload' },
      { id: 'shadow-overlay', ok: shadowLightCount > 0, label: 'Light shadow overlay' },
      { id: 'collider-overlay', ok: colliders.length > 0, label: 'Collider overlay' }
    ]
  };
}

function arrayFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function stringList(value) {
  return arrayFromValue(value).map(String).filter(Boolean);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

export default createScene3DViewportRenderState;
