export class ApiSurfaceFocusLens {
  analyze({ coreWorkflows = [], apis = [] } = {}) {
    const workflows = coreWorkflows.map(String);
    const normalizedApis = apis.map(normalizeApi);
    const coveredWorkflows = new Set(
      normalizedApis.flatMap((api) => api.workflows).filter((workflow) => workflows.includes(workflow))
    );
    const weakCoreApis = normalizedApis
      .filter((api) => api.tier === 'core' && (!api.docs || !api.tests))
      .map((api) => api.name);
    const noisyApis = normalizedApis
      .filter((api) => api.tier !== 'core' && api.workflows.length === 0)
      .map((api) => api.name);
    const focusScore = Math.max(0, Math.round(100 - ((weakCoreApis.length + noisyApis.length) * 12.5)));

    return {
      summary: {
        apiCount: normalizedApis.length,
        coreWorkflowCount: workflows.length,
        coveredCoreWorkflowCount: coveredWorkflows.size,
        focusScore,
        ready: weakCoreApis.length === 0 && noisyApis.length === 0 && coveredWorkflows.size === workflows.length
      },
      weakCoreApis,
      noisyApis,
      recommendations: buildRecommendations(normalizedApis, weakCoreApis, noisyApis)
    };
  }

  createRecommendedPath({
    target = '2d-game',
    experience = 'beginner',
    engines = [],
    templates = [],
    apis = []
  } = {}) {
    const normalizedApis = apis.map(normalizeApi);
    const stableApis = normalizedApis
      .filter((api) => api.tier === 'core' && api.docs && api.tests)
      .map((api) => api.name);
    const recommendedTemplate = pickTemplate(target, templates);
    return {
      format: 'OmniCore.RecommendedApiPath',
      target,
      experience,
      steps: [
        {
          id: 'template',
          title: '从官方模板开始',
          recommendedTemplate,
          apis: ['create-omnicore-app', 'Templates']
        },
        {
          id: 'runtime',
          title: '只使用稳定运行时入口',
          apis: stableApis.length ? stableApis : ['Game.init', 'Scene', 'Sprite']
        },
        {
          id: 'editor',
          title: '用编辑器闭环管理资源和脚本',
          apis: ['AssetRegistry', 'PrefabRegistry', 'VisualScriptGraphRuntime']
        },
        {
          id: 'diagnostics',
          title: '先看诊断再扩展能力',
          apis: ['ApiSurfaceFocusLens', 'PerformanceDashboard', 'createWebGPUFrameBudgetReport']
        },
        {
          id: 'publish',
          title: '走发布证据链',
          apis: ['exportRunnableProject', 'release:readiness', 'engine-doctor']
        }
      ],
      stableApis,
      migrationNotes: buildMigrationNotes(engines),
      e2eChecklist: [
        { id: 'editor-open', label: '编辑器能打开并无 console error/warn' },
        { id: 'asset-import', label: '资源导入后 AssetRegistry 增量刷新' },
        { id: 'prefab-hot-reload', label: 'Prefab 修改触发热重载' },
        { id: 'template-run', label: '官方模板能启动运行' },
        { id: 'webgpu-fallback', label: 'WebGPU 不可用时回退 Pixi/Canvas' },
        { id: 'mobile-viewport', label: '移动端视口无遮挡和布局错位' }
      ]
    };
  }
}

function normalizeApi(api = {}) {
  return {
    name: String(api.name || 'api'),
    tier: String(api.tier || 'experimental'),
    workflows: normalizeArray(api.workflows).map(String),
    docs: Boolean(api.docs),
    tests: Boolean(api.tests)
  };
}

function buildRecommendations(apis, weakCoreApis, noisyApis) {
  const byName = new Map(apis.map((api) => [api.name, api]));
  const recommendations = [];
  for (const name of weakCoreApis) {
    const api = byName.get(name);
    if (!api?.docs) recommendations.push(`document:${name}`);
    if (!api?.tests) recommendations.push(`addTests:${name}`);
  }
  for (const name of noisyApis) recommendations.push(`hideOrMoveExperimental:${name}`);
  return recommendations;
}

function pickTemplate(target, templates) {
  const normalized = normalizeArray(templates).map(String);
  if (target.includes('platformer') && normalized.includes('platformer')) return 'platformer';
  if (target.includes('rpg') && normalized.includes('rpg-dialogue')) return 'rpg-dialogue';
  return normalized[0] || 'platformer';
}

function buildMigrationNotes(engines) {
  const notes = {
    phaser: 'Scene lifecycle + Arcade-style PhysicsWorld',
    godot: 'SceneDocument + PrefabRegistry + VisualScriptGraphRuntime',
    cocos: 'ComponentTreeRuntime + editor property panels + prefab variants',
    pixijs: 'PixiRenderer + PixiTextureLifecycle + BatchAtlasDiagnostics',
    three: 'Scene3DKit + Dimension3D + ThreePhysicsBridge'
  };
  return normalizeArray(engines).map(String).map((engine) => ({
    engine,
    use: notes[engine.toLowerCase()] || 'Game + Scene + AssetRegistry recommended path'
  }));
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default ApiSurfaceFocusLens;
