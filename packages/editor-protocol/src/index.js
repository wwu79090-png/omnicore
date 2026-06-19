export const EDITOR_PROTOCOL_NAME = 'OmniCore.EditorProtocol';

export function createEditorPatch({ id = `patch-${Date.now().toString(36)}`, targetId, set = {} } = {}) {
  if (!targetId) throw new Error('patch targetId is required');
  return {
    protocol: EDITOR_PROTOCOL_NAME,
    id,
    op: 'entity:set',
    targetId,
    set: { ...set }
  };
}

export function applyEditorPatch(scene, patch) {
  if (patch?.protocol !== EDITOR_PROTOCOL_NAME) throw new Error('unsupported editor protocol patch');
  const entity = scene.findEntity?.(patch.targetId)
    || (scene.entities || []).find((item) => item.id === patch.targetId);
  if (!entity) throw new Error(`patch target not found: ${patch.targetId}`);
  Object.assign(entity, patch.set);
  return {
    applied: true,
    patchId: patch.id,
    targetId: patch.targetId,
    entity
  };
}

export function createHotEditSession({ scene } = {}) {
  const appliedPatches = [];
  return {
    protocol: EDITOR_PROTOCOL_NAME,
    apply(patch) {
      const result = applyEditorPatch(scene, patch);
      appliedPatches.push({ patchId: patch.id, targetId: patch.targetId });
      return result;
    },
    summary() {
      return {
        protocol: EDITOR_PROTOCOL_NAME,
        appliedPatches: appliedPatches.length,
        patches: [...appliedPatches]
      };
    }
  };
}
