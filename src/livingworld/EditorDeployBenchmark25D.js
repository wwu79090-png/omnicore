const DEFAULT_WORKFLOW = ['plan', 'apply', 'save', 'export', 'readiness'];

function hasFile(files, predicate) {
  return files.some((file) => predicate(String(file.path || '')));
}

function pass(id, ok, evidence) {
  return {
    id,
    status: ok ? 'pass' : 'fail',
    evidence
  };
}

export function createEditorDeployBenchmark25D({
  demo = {},
  deployment = {},
  readiness = {},
  maxFiles = 12
} = {}) {
  const workflow = Array.isArray(demo.workflow) && demo.workflow.length ? demo.workflow : DEFAULT_WORKFLOW;
  const files = Array.isArray(deployment.files) ? deployment.files : [];
  const manifest = deployment.manifest || {};
  const stages = [
    pass('plan', workflow.includes('plan') && Boolean(demo.prompt || demo.plan), demo.prompt || demo.plan?.protocol || null),
    pass('apply', workflow.includes('apply') && Number(manifest.coCreationPlans || 0) > 0, manifest.coCreationPlans || 0),
    pass('save', workflow.includes('save') && Boolean(demo.snapshot || demo.savedSnapshot || workflow.includes('save')), demo.snapshot || demo.savedSnapshot || 'workflow:save'),
    pass('export', workflow.includes('export') && manifest.profile === '2.5d-editor-lite' && hasFile(files, (path) => path === 'manifests/deploy-lite.json'), manifest.profile || null),
    pass('readiness', workflow.includes('readiness') && readiness.ready === true, readiness.score ?? null)
  ];
  const overBudget = files.length > maxFiles;
  const failed = stages.filter((stage) => stage.status !== 'pass').length + (overBudget ? 1 : 0);
  const score = Math.max(0, Math.min(Number(readiness.score ?? 100), 100 - failed * 20));
  return {
    format: 'OmniCore.EditorDeployBenchmark25D',
    version: 1,
    ready: failed === 0,
    score,
    stages,
    budget: {
      profile: manifest.profile || 'unknown',
      maxFiles,
      fileCount: files.length,
      overBudget
    },
    evidence: {
      targets: Array.isArray(manifest.targets) ? manifest.targets : [],
      scenes: Number(manifest.scenes || 0),
      assets: Number(manifest.assets || 0),
      coCreationPlans: Number(manifest.coCreationPlans || 0)
    }
  };
}

export default createEditorDeployBenchmark25D;
