const TARGET = 95;

export function buildEditorLongTermMaturity({ app = null, target = TARGET } = {}) {
  const assetWorkflow = safeCall(() => app?.createAssetWorkflowIndex?.()) || null;
  const collaboration = safeCall(() => app?.createCollaborationHandoff?.({ generatedAt: 'maturity-check' })) || null;
  const governance = safeCall(() => app?.createProjectGovernanceReport?.()) || null;
  const bundle = safeCall(() => app?.exportMatureEditorBundle?.({ generatedAt: 'maturity-check' })) || null;
  const state = safeCall(() => app?.getState?.()) || {};
  const evidence = {
    assetWorkflowIndex: Boolean(assetWorkflow?.totalAssets > 0 && Array.isArray(assetWorkflow.sceneReferences)),
    collaborationHandoff: Boolean(collaboration?.format === 'OmniCore.EditorCollaborationHandoff' && collaboration?.readiness?.ready === true),
    projectGovernance: Boolean(governance?.format === 'OmniCore.EditorGovernanceReport' && governance?.ready === true),
    matureEditorBundle: Boolean(bundle?.format === 'OmniCore.MatureEditorBundle' && bundle?.assetWorkflow && bundle?.collaboration && bundle?.governance),
    workspaceCoverage: Boolean(state.workspace?.root || state.workspace?.name),
    editorAutomationSurface: hasEditorAutomationSurface(app)
  };
  const checks = Object.entries(evidence).map(([id, ok]) => ({
    id,
    ok,
    status: ok ? 'covered' : 'missing',
    action: actionFor(id)
  }));
  const covered = checks.filter((check) => check.ok).length;
  const score = Math.round((covered / checks.length) * 100);
  return {
    target,
    score,
    ready: score >= target,
    evidence,
    checks,
    gaps: checks.filter((check) => !check.ok).map((check) => check.id),
    assetWorkflow,
    collaboration,
    governance
  };
}

function hasEditorAutomationSurface(app) {
  return [
    'createAssetWorkflowIndex',
    'createCollaborationHandoff',
    'createProjectGovernanceReport',
    'exportMatureEditorBundle',
    'exportAuthoringBundle',
    'validateAuthoringAssets'
  ].every((method) => typeof app?.[method] === 'function');
}

function actionFor(id) {
  const actions = {
    assetWorkflowIndex: 'Keep asset type counts, scene references, and orphan assets exportable.',
    collaborationHandoff: 'Export reviewer-ready project handoff manifests.',
    projectGovernance: 'Expose project governance checklist and coverage counts.',
    matureEditorBundle: 'Bundle authoring, asset workflow, collaboration, and governance evidence.',
    workspaceCoverage: 'Open or scan a workspace before long-term maturity scoring.',
    editorAutomationSurface: 'Keep editor maturity APIs available for CI and release reports.'
  };
  return actions[id] || 'Add long-term editor maturity evidence.';
}

function safeCall(fn) {
  try {
    return typeof fn === 'function' ? fn() : null;
  } catch {
    return null;
  }
}

export default buildEditorLongTermMaturity;
