import inspectGLTFAsset from './GLTFAssetInspector.js';

export function createGLTFImportWorkflow(input = {}, options = {}) {
  const file = normalizeFile(input.file || input.asset || input);
  const inspection = inspectGLTFAsset({
    path: file.path,
    byteLength: file.byteLength,
    document: input.document || input.gltf || input.asset?.document || {}
  }, {
    collider: options.collider || input.collider || null,
    lods: options.lods || input.lods || [],
    compression: options.compression || input.compression || {}
  });
  const modelId = normalizeModelId(options.modelId || file.name);
  const animations = inspection.animationClips;
  const generatedCollider = options.collider || { shape: 'box', source: 'mesh-bounds' };
  const material = options.material || inspection.materials[0]?.name || 'default-pbr';

  return {
    schema: 'omnicore.gltf-import-workflow.v1',
    source: file,
    targetSceneId: options.targetSceneId || null,
    dropzone: {
      accept: ['.glb', '.gltf'],
      multiple: false,
      label: '拖入 GLB/GLTF'
    },
    inspection,
    inspectorTabs: [
      { id: 'summary', label: '检查报告', count: Object.keys(inspection.summary).length },
      { id: 'materials', label: '材质贴图', count: inspection.summary.materialCount },
      { id: 'animations', label: '动画片段', count: inspection.summary.animationClipCount },
      { id: 'repairs', label: '修复动作', count: inspection.repairActions.length }
    ],
    repairPlan: {
      id: `${modelId}-gltf-repair-plan`,
      actions: inspection.repairActions.map((action, index) => ({
        id: `${action.type}-${index + 1}`,
        ...action,
        status: 'ready'
      })),
      recommendations: [...inspection.recommendations]
    },
    sceneInsertion: {
      label: '一键导入到场景',
      patch: {
        runtime: {
          models: [{
            id: modelId,
            url: file.path,
            material,
            animations,
            activeAnimation: animations[0] || null,
            collider: generatedCollider,
            physicsBinding: {
              backend: options.physicsBackend || 'rapier3d-compat',
              bodyId: `${modelId}-body`,
              colliderId: `${modelId}-collider`
            }
          }]
        }
      }
    }
  };
}

function normalizeFile(file = {}) {
  const path = String(file.path || file.url || file.name || 'asset.glb');
  return {
    name: String(file.name || path.split('/').pop() || 'asset.glb'),
    path,
    byteLength: Number(file.byteLength || file.size || 0)
  };
}

function normalizeModelId(value) {
  return String(value || 'model')
    .replace(/\.(glb|gltf)$/iu, '')
    .replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase() || 'model';
}

export default createGLTFImportWorkflow;
