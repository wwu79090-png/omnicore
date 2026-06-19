export function buildEditorMarketReadiness({ app = null, bundle = null } = {}) {
  const evidence = {
    dockWorkbench: hasDockWorkbench(app),
    projectSave: typeof app?.saveSnapshot === 'function',
    undoRedo: typeof app?.undo === 'function' && typeof app?.redo === 'function',
    autoSaveRecovery: typeof app?.runAutoSave === 'function' && typeof app?.checkRecovery === 'function',
    lowCodeExports: hasLowCodeExports(app),
    authoringBundle: hasAuthoringBundle(app, bundle),
    profilerHotspots: hasProfilerHotspots(app),
    platformBuildSettings: hasPlatformBuildSettings(app)
  };
  const checks = Object.entries(evidence).map(([id, ok]) => ({
    id,
    ok,
    status: ok ? 'covered' : 'missing',
    action: editorReadinessAction(id)
  }));
  const covered = checks.filter((check) => check.ok).length;
  const score = Math.round((covered / checks.length) * 100);
  const gaps = checks.filter((check) => !check.ok).map((check) => check.id);
  return {
    target: 90,
    score,
    ready: score >= 90,
    evidence,
    gaps,
    checks,
    lowCodeExports: summarizeLowCodeExports(app),
    nextActions: checks.map((check) => ({
      id: check.id,
      status: check.status,
      action: check.action
    }))
  };
}

function hasDockWorkbench(app) {
  const layout = app?.getDockLayout?.();
  return Boolean(layout?.left?.length && layout?.center?.length && layout?.right?.length && layout?.bottom?.length);
}

function hasLowCodeExports(app) {
  const summary = summarizeLowCodeExports(app);
  return summary.eventSheetEvents > 0
    && summary.uiElements > 0
    && summary.dataTables > 0
    && summary.behaviorTreeNodes > 0;
}

function hasAuthoringBundle(app, bundle) {
  const exported = bundle || safeCall(() => app?.exportAuthoringBundle?.({ generatedAt: 'market-readiness' }));
  return Boolean(exported?.fileName && exported?.version && exported?.health);
}

function hasProfilerHotspots(app) {
  const hotspots = safeCall(() => app?.getProfilerHotspots?.({ warningMs: 8, criticalMs: 16 })) || [];
  return Array.isArray(hotspots) && hotspots.length > 0;
}

function hasPlatformBuildSettings(app) {
  const buildSettings = app?.getState?.()?.buildSettings || {};
  const targets = buildSettings.targets || {};
  const hasWeb = Array.isArray(targets) ? targets.includes('web') : targets.web?.enabled === true;
  const hasWechat = Array.isArray(targets) ? targets.includes('wechat') : targets.wechat?.enabled === true;
  return hasWeb
    && hasWechat
    && Number(buildSettings.budgets?.maxWechatBytes || 0) >= 4 * 1024 * 1024;
}

function summarizeLowCodeExports(app) {
  const eventSheet = safeCall(() => app?.exportFlowGraphEventSheet?.()) || {};
  const uiLayout = safeCall(() => app?.exportUILayoutJson?.()) || {};
  const data = safeCall(() => app?.exportDataJson?.()) || {};
  const behaviorTree = safeCall(() => app?.exportBehaviorTreeJson?.()) || {};
  return {
    eventSheetEvents: Array.isArray(eventSheet.events) ? eventSheet.events.length : 0,
    uiElements: Array.isArray(uiLayout.elements) ? uiLayout.elements.length : 0,
    dataTables: Object.keys(data || {}).length,
    behaviorTreeNodes: countBehaviorNodes(behaviorTree)
  };
}

function countBehaviorNodes(node) {
  if (!node || typeof node !== 'object') return 0;
  return 1 + (Array.isArray(node.children)
    ? node.children.reduce((sum, child) => sum + countBehaviorNodes(child), 0)
    : 0);
}

function editorReadinessAction(id) {
  const actions = {
    dockWorkbench: 'Keep dock layout, toolbar, and panel state covered by editor workflow tests.',
    projectSave: 'Expose project save/snapshot operations through the editor bridge.',
    undoRedo: 'Keep undo/redo commands wired to scene and inspector changes.',
    autoSaveRecovery: 'Verify autosave and recovery prompts with workspace fixtures.',
    lowCodeExports: 'Export EventSheet, BehaviorTree, UI_Layout, and config/data.json together.',
    authoringBundle: 'Package authoring assets with health checks for release handoff.',
    profilerHotspots: 'Record profiler frames and show hotspots before playtest export.',
    platformBuildSettings: 'Keep Web and WeChat build targets with package budgets visible in editor.'
  };
  return actions[id] || 'Add editor readiness evidence.';
}

function safeCall(fn) {
  try {
    return typeof fn === 'function' ? fn() : null;
  } catch {
    return null;
  }
}

export default buildEditorMarketReadiness;
