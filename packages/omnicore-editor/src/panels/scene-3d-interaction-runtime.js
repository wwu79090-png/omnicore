export function createScene3DInteractionRuntime(input = {}, options = {}) {
  const models = normalizeModels(input.models || input.scene?.models);
  const materials = normalizeMaterials(input.materials || input.scene?.materials);
  const camera = normalizeCamera(arrayFromValue(input.cameras || input.scene?.cameras)[0] || {}, options);
  const state = {
    schema: 'omnicore.editor-scene-3d-interaction.v1',
    selectedModelId: input.selectedModelId || options.selectedModelId || null,
    camera,
    models,
    materials,
    overlays: {
      colliders: input.overlays?.colliders ?? models.some((model) => model.collider),
      lights: input.overlays?.lights ?? arrayFromValue(input.lights || input.scene?.lights).length > 0,
      shadows: input.overlays?.shadows ?? arrayFromValue(input.lights || input.scene?.lights).some((light) => light.castShadow)
    },
    tools: createInteractionTools(models),
    trace: []
  };

  const api = {
    orbitCamera(delta = {}) {
      state.camera.orbit = {
        yaw: numberOr(state.camera.orbit.yaw + Number(delta.yaw || 0), state.camera.orbit.yaw),
        pitch: numberOr(state.camera.orbit.pitch + Number(delta.pitch || 0), state.camera.orbit.pitch),
        distance: Math.max(0.25, numberOr(state.camera.orbit.distance + Number(delta.distance || 0), state.camera.orbit.distance))
      };
      return record('orbit-camera', { camera: clone(state.camera) });
    },
    selectModel(modelId) {
      state.selectedModelId = String(modelId || '');
      state.models = state.models.map((model) => ({ ...model, selected: model.id === state.selectedModelId }));
      return record('select-model', {
        selectedModelId: state.selectedModelId,
        models: state.models.map(clone)
      });
    },
    dragSelected(delta = {}) {
      const modelId = state.selectedModelId || state.models[0]?.id || null;
      state.models = state.models.map((model) => {
        if (model.id !== modelId) return model;
        return {
          ...model,
          position: {
            x: numberOr(model.position.x + Number(delta.x || 0), model.position.x),
            y: numberOr(model.position.y + Number(delta.y || 0), model.position.y),
            z: numberOr(model.position.z + Number(delta.z || 0), model.position.z)
          },
          selected: true
        };
      });
      return record('drag-model', { selectedModelId: modelId, models: state.models.map(clone) });
    },
    editMaterial(materialId, patch = {}) {
      const id = String(materialId || state.materials[0]?.id || 'material');
      state.materials = upsertById(state.materials, { id, ...patch });
      return record('edit-material', { materials: state.materials.map(clone) });
    },
    switchAnimation(modelId, clip) {
      const id = String(modelId || state.selectedModelId || state.models[0]?.id || '');
      state.models = state.models.map((model) => (model.id === id ? { ...model, activeAnimation: String(clip || model.activeAnimation || '') } : model));
      return record('switch-animation', { models: state.models.map(clone) });
    },
    toggleColliderOverlay(visible = !state.overlays.colliders) {
      state.overlays = { ...state.overlays, colliders: Boolean(visible) };
      return record('toggle-collider-overlay', { overlays: clone(state.overlays) });
    },
    createSnapshot() {
      return clone({
        ...state,
        models: state.models,
        materials: state.materials,
        trace: state.trace
      });
    }
  };

  function record(type, patch) {
    const entry = {
      type,
      index: state.trace.length + 1,
      selectedModelId: state.selectedModelId || null
    };
    state.trace.push(entry);
    return { type, patch: clone(patch), trace: clone(state.trace) };
  }

  return api;
}

export function createScene3DInteractionSnapshot(input = {}, options = {}) {
  return createScene3DInteractionRuntime(input, options).createSnapshot();
}

function createInteractionTools(models) {
  const hasAnimation = models.some((model) => model.animations.length > 0 || model.activeAnimation);
  const hasCollider = models.some((model) => model.collider);
  return [
    { id: 'orbit-camera', label: '旋转视角', control: 'orbit' },
    { id: 'select-model', label: '点选模型', control: 'raycast-select' },
    { id: 'drag-model', label: '拖拽移动', control: 'transform' },
    { id: 'edit-material', label: '材质调参', control: 'material-inspector' },
    { id: 'switch-animation', label: '切换动画', control: 'animation-preview', enabled: hasAnimation },
    { id: 'toggle-collider-overlay', label: '碰撞体显示', control: 'debug-overlay', enabled: hasCollider }
  ];
}

function normalizeModels(models) {
  return arrayFromValue(models).map((model, index) => ({
    ...clone(model),
    id: String(model.id || model.name || `model-${index + 1}`),
    position: normalizeVector3(model.position),
    animations: stringList(model.animations || model.clips),
    activeAnimation: model.activeAnimation || model.animation || stringList(model.animations || model.clips)[0] || null,
    collider: model.collider ? clone(model.collider) : null,
    selected: Boolean(model.selected)
  }));
}

function normalizeMaterials(materials) {
  return arrayFromValue(materials).map((material, index) => ({
    ...clone(material),
    id: String(material.id || material.name || `material-${index + 1}`)
  }));
}

function normalizeCamera(camera, options = {}) {
  return {
    id: String(camera.id || 'main-camera'),
    mode: camera.mode || camera.controls || 'orbit',
    orbit: {
      yaw: numberOr(options.orbit?.yaw ?? camera.orbit?.yaw, 0),
      pitch: numberOr(options.orbit?.pitch ?? camera.orbit?.pitch, 0),
      distance: numberOr(options.orbit?.distance ?? camera.orbit?.distance, 4)
    }
  };
}

function upsertById(items, patch) {
  const next = items.map((item) => (item.id === patch.id ? { ...item, ...patch } : item));
  if (!next.some((item) => item.id === patch.id)) next.push({ ...patch });
  return next;
}

function normalizeVector3(value = {}) {
  return {
    x: numberOr(value.x, 0),
    y: numberOr(value.y, 0),
    z: numberOr(value.z, 0)
  };
}

function stringList(value) {
  return arrayFromValue(value).map(String).filter(Boolean);
}

function arrayFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

export default createScene3DInteractionRuntime;
