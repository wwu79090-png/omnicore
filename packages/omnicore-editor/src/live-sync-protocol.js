export function createEditorState(initial = {}) {
  return {
    connected: false,
    scene: initial.scene || { name: 'untitled', entities: [] },
    workspace: normalizeWorkspace(initial.workspace),
    selectedEntityId: initial.selectedEntityId || null,
    selectedEntityIds: normalizeSelection(initial.selectedEntityIds, initial.selectedEntityId),
    selectedPrefabId: initial.selectedPrefabId || null,
    gizmoMode: initial.gizmoMode || 'translate',
    collisionMode: Boolean(initial.collisionMode),
    selectedTile: initial.selectedTile ?? 1,
    prefabs: initial.prefabs || [],
    assets: initial.assets || [],
    assetPreview: initial.assetPreview || null,
    prefabPreview: initial.prefabPreview || null,
    playState: normalizePlayState(initial.playState),
    profilerFrame: normalizeProfilerFrame(initial.profilerFrame),
    database: normalizeDatabaseState(initial.database),
    projectFiles: normalizeProjectFiles(initial.projectFiles),
    globalSearch: normalizeGlobalSearch(initial.globalSearch),
    resourcePicker: normalizeResourcePicker(initial.resourcePicker),
    physicsView: normalizePhysicsView(initial.physicsView),
    prefabHotEdit: normalizePrefabHotEdit(initial.prefabHotEdit),
    buildSettings: normalizeBuildSettings(initial.buildSettings),
    lastCommandError: initial.lastCommandError || null,
    flowGraph: normalizeFlowGraph(initial.flowGraph),
    behaviorTree: initial.behaviorTree || null,
    visualScriptTrace: normalizeVisualScriptTrace(initial.visualScriptTrace),
    visualScriptValidation: normalizeVisualScriptValidation(initial.visualScriptValidation || initial.visualScriptTrace?.validation),
    uiLayout: normalizeUILayout(initial.uiLayout),
    tilemap: normalizeTilemap(initial.tilemap),
    dockLayout: normalizeDockLayout(initial.dockLayout),
    simulation: initial.simulation || { active: false, physics: false, logic: false },
    animations: initial.animations || {},
    gridSnap: normalizeGridSnap(initial.gridSnap),
    sceneOverlays: normalizeSceneOverlays(initial.sceneOverlays),
    commandPaletteOpen: Boolean(initial.commandPaletteOpen),
    sceneValidation: normalizeSceneValidation(initial.sceneValidation),
    sceneIssueTargetId: initial.sceneIssueTargetId || null,
    prefabHistory: normalizePrefabHistory(initial.prefabHistory),
    selectedAnimationKeyframe: normalizeSelectedAnimationKeyframe(initial.selectedAnimationKeyframe),
    particleEditor: normalizeParticleEditor(initial.particleEditor),
    spriteEditor: normalizeSpriteEditor(initial.spriteEditor),
    profilerOpen: Boolean(initial.profilerOpen),
    profilerHistory: normalizeProfilerHistory(initial.profilerHistory),
    sceneTabs: normalizeSceneTabs(initial.sceneTabs),
    activeSceneTabPath: initial.activeSceneTabPath || null,
    authoringHealth: normalizeAuthoringHealth(initial.authoringHealth),
    editorClosure: normalizeEditorClosure(initial.editorClosure),
    hotReload: normalizeHotReload(initial.hotReload),
    assetRegistryPanel: normalizeAssetRegistryPanel(initial.assetRegistryPanel),
    renderDiagnosticsPanel: normalizeRenderDiagnosticsPanel(initial.renderDiagnosticsPanel),
    renderOptimizationPlan: normalizeRenderOptimizationPlan(initial.renderOptimizationPlan),
    renderOptimizationVerification: normalizeRenderOptimizationVerification(initial.renderOptimizationVerification),
    renderOptimizationRemediationPlan: normalizeRenderOptimizationRemediationPlan(initial.renderOptimizationRemediationPlan),
    renderOptimizationRemediationApplyReport: normalizeRenderOptimizationRemediationApplyReport(initial.renderOptimizationRemediationApplyReport),
    renderOptimizationRemediationReverifyReport: normalizeRenderOptimizationRemediationReverifyReport(initial.renderOptimizationRemediationReverifyReport),
    scene3DReadiness: normalizeScene3DReadiness(initial.scene3DReadiness),
    scene3DFixPlan: normalizeScene3DFixPlan(initial.scene3DFixPlan),
    scene3DFixApplyReport: normalizeScene3DFixApplyReport(initial.scene3DFixApplyReport),
    assetRefresh: normalizeAssetRefresh(initial.assetRefresh),
    hotReloadEvents: normalizeHotReloadEvents(initial.hotReloadEvents),
    preview25D: initial.preview25D || null,
    coCreation25D: initial.coCreation25D || null,
    livingWorldPreview25D: initial.livingWorldPreview25D || null,
    worldMemoryPreview25D: initial.worldMemoryPreview25D || null,
    autoSave: normalizeAutoSave(initial.autoSave),
    pendingCommands: initial.pendingCommands || []
  };
}

export function createLiveSyncMessage(type, payload = {}, meta = {}) {
  return {
    type,
    payload,
    meta: {
      sentAt: meta.sentAt || new Date().toISOString(),
      source: meta.source || 'omnicore-editor'
    }
  };
}

export function applyLiveSyncMessage(state = createEditorState(), message = {}) {
  const next = {
    ...state,
    scene: { ...(state.scene || { entities: [] }) },
    pendingCommands: [...(state.pendingCommands || [])]
  };
  if (message.type === 'runtime:hello') next.connected = true;
  if (message.type === 'runtime:scene') next.scene = { entities: [], ...message.payload };
  if (message.type === 'runtime:tilemap') next.tilemap = { ...next.tilemap, ...message.payload };
  if (message.type === 'runtime:play-state') next.playState = normalizePlayState(message.payload);
  if (message.type === 'runtime:profiler-frame') next.profilerFrame = normalizeProfilerFrame(message.payload);
  if (message.type === 'runtime:profiler-frame') {
    next.profilerHistory = normalizeProfilerHistory([...(next.profilerHistory || []), message.payload]);
  }
  if (message.type === 'runtime:database') next.database = normalizeDatabaseState({ ...next.database, lastUpdate: message.payload });
  if (message.type === 'runtime:command-error') next.lastCommandError = { ...message.payload };
  if (message.type === 'runtime:prefabs') next.prefabs = Array.isArray(message.payload) ? message.payload : message.payload?.prefabs || [];
  if (message.type === 'editor:workspace-opened') next.workspace = normalizeWorkspace(message.payload);
  if (message.type === 'runtime:animations') next.animations = { ...message.payload };
  if (message.type === 'editor:update-entity') next.pendingCommands.push(message.payload);
  if (message.type === 'editor:select-entity') {
    next.selectedEntityId = message.payload?.id || null;
    next.selectedEntityIds = normalizeSelection(message.payload?.ids, next.selectedEntityId);
  }
  if (message.type === 'editor:gizmo-mode') next.gizmoMode = message.payload?.mode || 'translate';
  if (message.type === 'editor:dock-layout') next.dockLayout = normalizeDockLayout(message.payload);
  if (message.type === 'editor:grid-snap') next.gridSnap = normalizeGridSnap(message.payload);
  if (message.type === 'editor:scene-overlays') next.sceneOverlays = normalizeSceneOverlays(message.payload);
  if (message.type === 'editor:scene-validation') next.sceneValidation = normalizeSceneValidation(message.payload);
  if (message.type === 'editor:closure-report') next.editorClosure = normalizeEditorClosure(message.payload);
  if (message.type === 'editor:hot-reload') next.hotReload = normalizeHotReload(message.payload);
  if (message.type === 'editor:asset-registry-panel') next.assetRegistryPanel = normalizeAssetRegistryPanel(message.payload);
  if (message.type === 'editor:render-diagnostics-panel') next.renderDiagnosticsPanel = normalizeRenderDiagnosticsPanel(message.payload);
  if (message.type === 'editor:render-optimization-plan') next.renderOptimizationPlan = normalizeRenderOptimizationPlan(message.payload);
  if (message.type === 'editor:render-optimization-verification') {
    next.renderOptimizationVerification = normalizeRenderOptimizationVerification(message.payload);
  }
  if (message.type === 'editor:render-optimization-remediation-plan') {
    next.renderOptimizationRemediationPlan = normalizeRenderOptimizationRemediationPlan(message.payload);
  }
  if (message.type === 'editor:render-optimization-remediation-apply-report') {
    next.renderOptimizationRemediationApplyReport = normalizeRenderOptimizationRemediationApplyReport(message.payload);
  }
  if (message.type === 'editor:render-optimization-remediation-reverify-report') {
    next.renderOptimizationRemediationReverifyReport = normalizeRenderOptimizationRemediationReverifyReport(message.payload);
  }
  if (message.type === 'editor:scene-3d-readiness') {
    next.scene3DReadiness = normalizeScene3DReadiness(message.payload);
  }
  if (message.type === 'editor:scene-3d-readiness-fix-plan') {
    next.scene3DFixPlan = normalizeScene3DFixPlan(message.payload);
  }
  if (message.type === 'editor:scene-3d-readiness-fix-apply-report') {
    next.scene3DFixApplyReport = normalizeScene3DFixApplyReport(message.payload);
  }
  if (message.type === 'editor:render-optimization-runtime-plan') {
    next.renderOptimizationPlan = normalizeRenderOptimizationPlan(message.payload?.sourcePlan);
  }
  if (message.type === 'editor:render-diagnostics-quick-fix') {
    next.renderDiagnosticsPanel = normalizeRenderDiagnosticsPanel(message.payload?.panel);
    next.renderOptimizationPlan = normalizeRenderOptimizationPlan(message.payload?.plan);
  }
  if (message.type === 'editor:asset-refresh') next.assetRefresh = normalizeAssetRefresh(message.payload);
  if (message.type === 'editor:hot-reload-event-stream') next.hotReloadEvents = normalizeHotReloadEvents(message.payload?.events || message.payload);
  if (message.type === 'editor:asset-watch-refresh') {
    const refresh = normalizeAssetWatchRefresh(message.payload);
    next.assetRefresh = normalizeAssetRefresh(refresh.assetRefresh);
    next.hotReload = normalizeHotReload(refresh.hotReload);
    next.hotReloadEvents = appendHotReloadEvents(next.hotReloadEvents, refresh.events);
    next.assets = applyAssetWatchChangesToAssets(next.assets, refresh.assetChanges);
    next.assetRegistryPanel = normalizeAssetRegistryPanel(refresh.assetRegistryPanel);
  }
  if (message.type === 'editor:visual-script-validation') {
    next.visualScriptValidation = normalizeVisualScriptValidation(message.payload);
  }
  if (message.type === 'editor:visual-script-run' || message.type === 'runtime:visual-script-trace') {
    next.visualScriptTrace = normalizeVisualScriptTrace(message.payload);
    next.visualScriptValidation = normalizeVisualScriptValidation(message.payload?.validation);
  }
  return next;
}

function normalizeGridSnap(value = {}) {
  return {
    enabled: Boolean(value.enabled),
    size: Math.max(1, Number(value.size || 16))
  };
}

function normalizeSceneOverlays(value = {}) {
  return {
    collision: Boolean(value.collision),
    depth: Boolean(value.depth)
  };
}

function normalizeSceneValidation(value = null) {
  if (!value || typeof value !== 'object') return { ok: true, issues: [] };
  const issues = Array.isArray(value.issues) ? value.issues : [];
  return {
    ...value,
    ok: issues.length === 0,
    issues
  };
}

function normalizeVisualScriptValidation(value = null) {
  if (!value || typeof value !== 'object') {
    return {
      ok: true,
      summary: { nodeCount: 0, edgeCount: 0, eventCount: 0, issueCount: 0 },
      issues: []
    };
  }
  const issues = Array.isArray(value.issues) ? value.issues.map((issue) => ({ ...issue })) : [];
  return {
    ...value,
    ok: issues.length === 0 && value.ok !== false,
    summary: {
      nodeCount: Number(value.summary?.nodeCount || 0),
      edgeCount: Number(value.summary?.edgeCount || 0),
      eventCount: Number(value.summary?.eventCount || 0),
      issueCount: Number(value.summary?.issueCount ?? issues.length)
    },
    issues
  };
}

function normalizeVisualScriptTrace(value = null) {
  if (!value || typeof value !== 'object') {
    return {
      event: null,
      payload: {},
      variables: {},
      events: [],
      trace: [],
      graph: null,
      validation: normalizeVisualScriptValidation(),
      ranAt: null
    };
  }
  return {
    event: value.event || null,
    payload: clonePlain(value.payload || {}),
    variables: clonePlain(value.variables || {}),
    events: Array.isArray(value.events) ? value.events.map((event) => clonePlain(event)) : [],
    trace: Array.isArray(value.trace) ? value.trace.map((entry) => clonePlain(entry)) : [],
    graph: value.graph ? clonePlain(value.graph) : null,
    validation: normalizeVisualScriptValidation(value.validation),
    ranAt: value.ranAt || null
  };
}

function normalizePrefabHistory(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entries]) => [
    key,
    Array.isArray(entries) ? entries : []
  ]));
}

function normalizeSelectedAnimationKeyframe(value = null) {
  if (!value || typeof value !== 'object') return null;
  return {
    clipId: value.clipId || value.clip || null,
    track: value.track || value.property || null,
    frame: Number(value.frame || 0)
  };
}

function normalizeParticleEditor(value = {}) {
  if (!value || typeof value !== 'object') {
    value = {};
  }
  const curves = value.curves && typeof value.curves === 'object' ? value.curves : {};
  return {
    open: Boolean(value.open),
    config: {
      emissionRate: Number(value.config?.emissionRate ?? value.emissionRate ?? 30),
      lifetime: Number(value.config?.lifetime ?? value.lifetime ?? 1),
      initialVelocity: Number(value.config?.initialVelocity ?? value.initialVelocity ?? 120),
      gravity: Number(value.config?.gravity ?? value.gravity ?? 0),
      curves: Object.fromEntries(Object.entries(value.config?.curves || curves).map(([key, points]) => [
        key,
        normalizeCurvePoints(points)
      ])),
      gradient: normalizeGradient(value.config?.gradient || value.gradient)
    }
  };
}

function normalizeSpriteEditor(value = {}) {
  if (!value || typeof value !== 'object') return { open: false, source: null, nineSlice: {}, collider: null };
  return {
    open: Boolean(value.open),
    source: value.source || value.path || null,
    nineSlice: normalizeNineSlice(value.nineSlice),
    collider: value.collider && typeof value.collider === 'object' ? { ...value.collider } : null
  };
}

function normalizeProfilerHistory(value = []) {
  return (Array.isArray(value) ? value : [])
    .map(normalizeProfilerFrame)
    .filter(Boolean)
    .slice(-180);
}

function normalizeSceneTabs(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((tab) => tab && (tab.path || tab.id))
    .map((tab) => ({
      path: tab.path || tab.id,
      scene: normalizeSceneDocument(tab.scene),
      dirty: Boolean(tab.dirty)
    }));
}

function normalizeAuthoringHealth(value = {}) {
  return {
    open: Boolean(value.open),
    ok: value.ok !== false,
    checkedAt: value.checkedAt || null,
    issues: Array.isArray(value.issues) ? value.issues.map((issue) => ({ ...issue })) : [],
    hotspots: Array.isArray(value.hotspots) ? value.hotspots.map((hotspot) => ({ ...hotspot })) : [],
    counts: value.counts && typeof value.counts === 'object' ? { ...value.counts } : {}
  };
}

function normalizeEditorClosure(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeHotReload(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeAssetRegistryPanel(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeRenderDiagnosticsPanel(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeRenderOptimizationPlan(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeRenderOptimizationVerification(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeRenderOptimizationRemediationPlan(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeRenderOptimizationRemediationApplyReport(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeRenderOptimizationRemediationReverifyReport(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeScene3DReadiness(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeScene3DFixPlan(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeScene3DFixApplyReport(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeAssetRefresh(value = null) {
  if (!value || typeof value !== 'object') return null;
  return clonePlain(value);
}

function normalizeHotReloadEvents(value = []) {
  return (Array.isArray(value) ? value : []).map((event) => clonePlain(event));
}

function normalizeAssetWatchRefresh(value = {}) {
  if (!value || typeof value !== 'object') {
    return {
      schema: 'omnicore.editor-asset-watch-refresh.v1',
      source: null,
      files: [],
      conversions: [],
      changedAt: null,
      assetChanges: [],
      assetRefresh: null,
      hotReload: null,
      events: [],
      assetRegistryPanel: null
    };
  }
  return {
    schema: value.schema || 'omnicore.editor-asset-watch-refresh.v1',
    source: value.source || null,
    files: normalizeStringList(value.files),
    conversions: Array.isArray(value.conversions) ? value.conversions.map((conversion) => clonePlain(conversion)) : [],
    changedAt: value.changedAt || value.pushedAt || null,
    assetChanges: normalizeAssetWatchChanges(value.assetChanges || value.changes || []),
    assetRefresh: value.assetRefresh ? clonePlain(value.assetRefresh) : null,
    hotReload: value.hotReload ? clonePlain(value.hotReload) : null,
    events: normalizeHotReloadEvents(value.events || []),
    assetRegistryPanel: value.assetRegistryPanel ? clonePlain(value.assetRegistryPanel) : null
  };
}

function appendHotReloadEvents(currentEvents = [], incomingEvents = []) {
  const existing = normalizeHotReloadEvents(currentEvents);
  const startId = Number(existing.at(-1)?.id || 0) + 1;
  const nextEvents = normalizeHotReloadEvents(incomingEvents).map((event, index) => ({
    ...event,
    id: startId + index
  }));
  return [...existing, ...nextEvents].slice(-240);
}

function normalizeAssetWatchChanges(changes = []) {
  return (Array.isArray(changes) ? changes : [])
    .map((change) => ({
      kind: normalizeAssetChangeKind(change.kind || change.type),
      asset: normalizeResourcePath(change.asset || change.reference || change.to || change.from || change.rawAsset?.path),
      reference: normalizeResourcePath(change.reference || change.asset || change.rawAsset?.path),
      from: change.from ? normalizeResourcePath(change.from) : null,
      to: change.to ? normalizeResourcePath(change.to) : null,
      rawAsset: change.rawAsset && typeof change.rawAsset === 'object' ? clonePlain(change.rawAsset) : null
    }))
    .filter((change) => change.asset);
}

function applyAssetWatchChangesToAssets(assets = [], changes = []) {
  let nextAssets = (Array.isArray(assets) ? assets : [])
    .map((asset) => normalizeLiveAssetEntry(asset))
    .filter((asset) => asset.path);
  for (const change of normalizeAssetWatchChanges(changes)) {
    if (change.kind === 'deleted') {
      nextAssets = nextAssets.filter((asset) => !assetEntryMatchesReference(asset, change.asset));
      continue;
    }
    if (change.kind === 'moved') {
      const from = normalizeResourcePath(change.from || change.asset);
      const to = normalizeResourcePath(change.to || change.reference);
      if (!from || !to) continue;
      nextAssets = nextAssets.map((asset) => (assetEntryMatchesReference(asset, from)
        ? normalizeLiveAssetEntry({ ...asset, path: to, movedFrom: from, changeKind: 'moved' })
        : asset));
      continue;
    }
    const asset = normalizeLiveAssetEntry({
      ...(change.rawAsset || {}),
      path: normalizeResourcePath(change.rawAsset?.path || change.asset),
      type: change.rawAsset?.type || inferAssetType(change.asset),
      imported: change.kind === 'imported' || Boolean(change.rawAsset?.imported),
      changed: change.kind === 'modified' || Boolean(change.rawAsset?.changed),
      changeKind: change.kind
    });
    nextAssets = upsertLiveAssetEntry(nextAssets, asset);
  }
  return nextAssets;
}

function upsertLiveAssetEntry(assets = [], nextAsset = {}) {
  const path = normalizeResourcePath(nextAsset);
  if (!path) return assets;
  const index = assets.findIndex((asset) => assetEntryMatchesReference(asset, path));
  if (index < 0) return [...assets, normalizeLiveAssetEntry(nextAsset)];
  return assets.map((asset, assetIndex) => (assetIndex === index
    ? normalizeLiveAssetEntry({ ...asset, ...nextAsset, path })
    : asset));
}

function normalizeLiveAssetEntry(asset = {}) {
  const source = typeof asset === 'string' ? { path: asset } : { ...asset };
  const assetPath = normalizeResourcePath(source);
  return {
    ...source,
    path: assetPath,
    name: source.name || assetPath.split('/').pop() || assetPath,
    type: source.type || inferAssetType(assetPath)
  };
}

function assetEntryMatchesReference(asset = {}, reference = '') {
  const target = normalizeResourcePath(reference);
  if (!target) return false;
  const source = typeof asset === 'string' ? { path: asset } : asset;
  return [
    source.path,
    source.url,
    source.name,
    source.file,
    source.source,
    source.uid,
    source.address,
    source.primaryId,
    source.primaryAssetId,
    source.id,
    source.key
  ].some((value) => normalizeResourcePath(value) === target);
}

function normalizeAssetChangeKind(kind = 'modified') {
  const normalized = String(kind || 'modified').toLowerCase();
  if (['changed', 'updated', 'reimported'].includes(normalized)) return 'modified';
  if (['added', 'created'].includes(normalized)) return 'imported';
  if (['removed', 'missing'].includes(normalized)) return 'deleted';
  if (normalized === 'renamed') return 'moved';
  return normalized;
}

function normalizeResourcePath(value = '') {
  if (typeof value === 'string') return value.trim().replace(/\\/gu, '/').replace(/^\/+/u, '');
  if (!value || typeof value !== 'object') return '';
  return normalizeResourcePath(value.path || value.url || value.name || value.file || value.source || value.asset || '');
}

function normalizeStringList(value = []) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeResourcePath(item)).filter(Boolean);
}

function inferAssetType(file = '') {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(file)) return 'image';
  if (/\.(mp3|wav|ogg|m4a)$/iu.test(file)) return 'audio';
  if (/\.(glb|gltf|fbx|obj)$/iu.test(file)) return 'model';
  if (/(^|\/)prefabs\/.+\.json$/iu.test(file)) return 'prefab';
  if (/(^|\/)scenes\/.+\.json$/iu.test(file) || /\.scene\.json$/iu.test(file)) return 'scene';
  if (/\.json$/iu.test(file)) return 'json';
  return 'file';
}

function normalizeCurvePoints(points = []) {
  return (Array.isArray(points) ? points : [])
    .map((point) => ({ t: Number(point.t || 0), value: Number(point.value || 0) }));
}

function normalizeGradient(points = []) {
  return (Array.isArray(points) ? points : [])
    .map((point) => ({ t: Number(point.t || 0), color: point.color || '#ffffff' }));
}

function normalizeNineSlice(value = {}) {
  if (!value || typeof value !== 'object') {
    value = {};
  }
  return {
    left: Number(value.left || 0),
    right: Number(value.right || 0),
    top: Number(value.top || 0),
    bottom: Number(value.bottom || 0)
  };
}

function normalizeSceneDocument(scene = {}) {
  return {
    name: scene.name || 'untitled',
    entities: Array.isArray(scene.entities) ? scene.entities : []
  };
}

function normalizeWorkspace(value = {}) {
  if (!value || typeof value !== 'object') {
    return { root: null, name: null, directories: [], assets: [], sourceFiles: [], scenes: [] };
  }
  return {
    root: value.root || null,
    name: value.name || null,
    directories: Array.isArray(value.directories) ? value.directories : [],
    assets: Array.isArray(value.assets) ? value.assets : [],
    sourceFiles: Array.isArray(value.sourceFiles) ? value.sourceFiles : [],
    scenes: Array.isArray(value.scenes) ? value.scenes : [],
    scannedAt: value.scannedAt || null
  };
}

function normalizeAutoSave(value = {}) {
  return {
    enabled: value.enabled !== false,
    intervalMs: Math.max(1000, Number(value.intervalMs || 300000)),
    lastSavedAt: value.lastSavedAt || null,
    lastPath: value.lastPath || null
  };
}

export function serializeSceneForSync(scene = {}) {
  return {
    name: scene.name || 'untitled',
    entities: (scene.children || scene.entities || []).map((entity, index) => serializeEntity(entity, index))
  };
}

function normalizeTilemap(tilemap = {}) {
  const width = Number(tilemap.width || 16);
  const height = Number(tilemap.height || 12);
  const size = Math.max(0, width * height);
  const data = Array.isArray(tilemap.data) ? [...tilemap.data] : [];
  while (data.length < size) data.push(0);
  const layers = normalizeTilemapLayers(tilemap.layers, data, size);
  const activeLayerId = layers.some((layer) => layer.id === tilemap.activeLayerId)
    ? tilemap.activeLayerId
    : layers[0]?.id || 'tiles';
  return {
    width,
    height,
    tileWidth: Number(tilemap.tileWidth || tilemap.tilewidth || 16),
    tileHeight: Number(tilemap.tileHeight || tilemap.tileheight || 16),
    data: [...(layers[0]?.data || data.slice(0, size))],
    layers,
    activeLayerId,
    collisions: uniqueNumbers(tilemap.collisions),
    tilesets: normalizeTilesets(tilemap.tilesets || (tilemap.tileset ? [tilemap.tileset] : []), tilemap),
    ruleTiles: normalizeRuleTiles(tilemap.ruleTiles)
  };
}

function normalizeRuleTiles(ruleTiles = []) {
  return (Array.isArray(ruleTiles) ? ruleTiles : [])
    .filter((rule) => rule && rule.id != null)
    .map((rule) => ({
      ...clonePlain(rule),
      id: Number(rule.id),
      when: {
        ...(rule.when || {}),
        self: Number(rule.when?.self),
        adjacentAny: uniqueNumbers(rule.when?.adjacentAny)
      }
    }));
}

function normalizeTilemapLayers(layers, fallbackData, size) {
  const source = Array.isArray(layers) && layers.length > 0
    ? layers
    : [{ id: 'tiles', name: 'tiles', data: fallbackData }];
  return source.map((layer, index) => {
    const data = Array.isArray(layer.data) ? [...layer.data] : [];
    while (data.length < size) data.push(0);
    return {
      id: String(layer.id || layer.name || `layer-${index + 1}`),
      name: String(layer.name || layer.id || `Layer ${index + 1}`),
      visible: layer.visible !== false,
      opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1,
      data: data.slice(0, size)
    };
  });
}

function normalizeTilesets(tilesets, tilemap = {}) {
  return (Array.isArray(tilesets) ? tilesets : []).map((tileset, index) => {
    const tileWidth = Number(tileset.tileWidth || tileset.tilewidth || tilemap.tileWidth || tilemap.tilewidth || 16);
    const tileHeight = Number(tileset.tileHeight || tileset.tileheight || tilemap.tileHeight || tilemap.tileheight || 16);
    const firstgid = Number(tileset.firstgid || 1);
    const columns = Math.max(1, Number(tileset.columns || 1));
    const collisionTiles = uniqueNumbers(tileset.collisionTiles || tileset.solidTiles);
    const explicitTiles = Array.isArray(tileset.tiles) ? tileset.tiles : [];
    const tilecount = Math.max(
      Number(tileset.tilecount || tileset.tileCount || 0),
      explicitTiles.length,
      collisionTiles.length ? Math.max(...collisionTiles) - firstgid + 1 : 0
    );
    const byId = new Map();
    for (let offset = 0; offset < tilecount; offset += 1) {
      const id = firstgid + offset;
      byId.set(id, { id, solid: collisionTiles.includes(id), source: cropTile(id, { firstgid, columns, tileWidth, tileHeight }) });
    }
    for (const tile of explicitTiles) {
      const id = Number(tile.id ?? tile.gid);
      if (!Number.isFinite(id)) continue;
      byId.set(id, {
        ...byId.get(id),
        ...tile,
        id,
        solid: Boolean(tile.solid || tile.collision || collisionTiles.includes(id)),
        source: tile.source || cropTile(id, { firstgid, columns, tileWidth, tileHeight })
      });
    }
    return {
      name: String(tileset.name || `tileset-${index + 1}`),
      image: tileset.image || null,
      firstgid,
      columns,
      tileWidth,
      tileHeight,
      tilecount,
      collisionTiles,
      tiles: [...byId.values()]
    };
  });
}

function cropTile(tileId, tileset) {
  const local = Math.max(0, Number(tileId) - Number(tileset.firstgid || 1));
  const columns = Math.max(1, Number(tileset.columns || 1));
  const width = Number(tileset.tileWidth || 16);
  const height = Number(tileset.tileHeight || 16);
  return {
    x: (local % columns) * width,
    y: Math.floor(local / columns) * height,
    width,
    height
  };
}

function uniqueNumbers(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value)))];
}

function normalizeSelection(ids = [], fallbackId = null) {
  const values = Array.isArray(ids) ? ids : [];
  const unique = [...new Set(values.filter(Boolean).map(String))];
  if (!unique.length && fallbackId) unique.push(String(fallbackId));
  return unique;
}

function normalizePlayState(playState = {}) {
  const mode = ['editing', 'playing', 'paused'].includes(playState.mode) ? playState.mode : 'editing';
  return {
    ...playState,
    mode,
    frame: Number(playState.frame || 0),
    startedAt: playState.startedAt || null,
    pausedAt: playState.pausedAt || null,
    lastCommandId: playState.lastCommandId || null
  };
}

function normalizeProfilerFrame(frame = null) {
  if (!frame) return null;
  return {
    frame: Number(frame.frame || 0),
    time: Number(frame.time || 0),
    totalMs: Number(frame.totalMs || 0),
    sections: Array.isArray(frame.sections)
      ? frame.sections.map((section) => ({
        ...section,
        name: section.name || 'unknown',
        duration: Number(section.duration || 0)
      }))
      : [],
    memoryMB: Number(frame.memoryMB || frame.memory || 0),
    drawCalls: Number(frame.drawCalls || frame.drawcalls || 0)
  };
}

function normalizeDatabaseState(database = {}) {
  return {
    tables: database.tables || {},
    lastUpdate: database.lastUpdate || null
  };
}

function normalizeProjectFiles(projectFiles = {}) {
  if (!projectFiles || typeof projectFiles !== 'object' || Array.isArray(projectFiles)) return {};
  return Object.fromEntries(Object.entries(projectFiles).map(([filePath, content]) => [filePath, String(content ?? '')]));
}

function normalizeGlobalSearch(value = {}) {
  return {
    open: Boolean(value.open),
    query: value.query || '',
    replacement: value.replacement || '',
    results: Array.isArray(value.results) ? value.results : []
  };
}

function normalizeResourcePicker(value = {}) {
  return {
    open: Boolean(value.open),
    field: value.field || null,
    query: value.query || ''
  };
}

function normalizePhysicsView(value = {}) {
  return {
    open: Boolean(value.open)
  };
}

function normalizePrefabHotEdit(value = {}) {
  return {
    prefabId: value.prefabId || null,
    patch: value.patch || {},
    dirty: Boolean(value.dirty),
    promptOpen: Boolean(value.promptOpen)
  };
}

function normalizeBuildSettings(value = {}) {
  const targets = value.targets || {};
  const enabledTargets = Array.isArray(targets) ? new Set(targets) : null;
  const defaults = defaultBuildTargets();
  return {
    targets: Object.fromEntries(Object.entries(defaults).map(([platform, config]) => [
      platform,
      {
        ...config,
        ...(!enabledTargets ? (targets[platform] || {}) : {}),
        enabled: enabledTargets
          ? enabledTargets.has(platform)
          : Boolean(targets[platform]?.enabled ?? config.enabled)
      }
    ])),
    budgets: normalizeBuildBudgets(value.budgets || value)
  };
}

function defaultBuildTargets() {
  return {
    web: { enabled: true, compression: 'brotli', iconSize: 512, configStrategy: 'static' },
    wechat: { enabled: false, compression: 'zip', iconSize: 144, configStrategy: 'minigame' },
    electron: { enabled: false, compression: 'asar', iconSize: 256, configStrategy: 'desktop' },
    steam: { enabled: false, compression: 'store', iconSize: 256, configStrategy: 'depot' },
    itch: { enabled: false, compression: 'brotli', iconSize: 256, configStrategy: 'portable' }
  };
}

function normalizeBuildBudgets(value = {}) {
  return {
    maxBundleKb: Math.max(1, Number(value.maxBundleKb || 1024)),
    maxWechatBytes: Math.max(1, Number(value.maxWechatBytes || 4 * 1024 * 1024))
  };
}

function normalizeUILayout(uiLayout = {}) {
  const canvas = uiLayout.canvas || {};
  const elements = Array.isArray(uiLayout.elements) ? uiLayout.elements : [];
  return {
    format: 'OmniCore.UI_Layout',
    version: Number(uiLayout.version || 1),
    canvas: {
      width: Math.max(1, Number(canvas.width || uiLayout.width || 320)),
      height: Math.max(1, Number(canvas.height || uiLayout.height || 240))
    },
    elements: elements.map((element, index) => ({
      type: element.type || 'Button',
      id: String(element.id || `button-${index + 1}`),
      text: String(element.text ?? element.label ?? element.id ?? 'Button'),
      x: Number(element.x || 0),
      y: Number(element.y || 0),
      width: Math.max(1, Number(element.width || 160)),
      height: Math.max(1, Number(element.height || 40)),
      action: element.action || null
    }))
  };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function serializeEntity(entity = {}, index = 0) {
  const output = {};
  const seen = new WeakSet();
  for (const [key, value] of Object.entries(entity)) {
    if (key === 'parent' || key === 'game' || key === 'displayObject' || key.startsWith('__')) continue;
    const serialized = serializeValue(value, seen);
    if (serialized !== undefined) output[key] = serialized;
  }
  return {
    ...output,
    id: output.id || output.name || `entity-${index}`,
    name: output.name || output.id || `Entity ${index + 1}`,
    type: output.type || 'entity',
    texture: output.texture || output.sprite || null,
    x: output.x ?? 0,
    y: output.y ?? 0,
    width: output.width ?? 0,
    height: output.height ?? 0,
    rotation: output.rotation ?? 0,
    scaleX: output.scaleX ?? output.scale ?? 1,
    scaleY: output.scaleY ?? output.scale ?? 1
  };
}

function serializeValue(value, seen) {
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => serializeValue(item, seen))
      .filter((item) => item !== undefined);
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'parent' && key !== 'game' && key !== 'displayObject' && !key.startsWith('__'))
      .map(([key, item]) => [key, serializeValue(item, seen)])
      .filter(([, item]) => item !== undefined)
  );
}

function normalizeDockLayout(layout = {}) {
  const fallback = {
    left: ['hierarchy', 'prefabs', 'assets'],
    center: ['scene-view'],
    right: ['inspector'],
    bottom: ['animation-timeline', 'tilemap', 'flow-graph', 'profiler']
  };
  return Object.fromEntries(
    Object.entries(fallback).map(([region, panels]) => [
      region,
      Array.isArray(layout[region]) && layout[region].length ? [...layout[region]] : [...panels]
    ])
  );
}

function normalizeFlowGraph(flowGraph = {}) {
  return {
    variables: { ...(flowGraph.variables || {}) },
    nodes: (flowGraph.nodes || []).map((node, index) => ({
      id: String(node.id || `node-${index + 1}`),
      type: String(node.type || 'action'),
      label: node.label || node.id || `Node ${index + 1}`,
      x: Number(node.x || 0),
      y: Number(node.y || 0),
      scope: { ...(node.scope || {}) },
      data: { ...(node.data || {}) }
    })),
    edges: (flowGraph.edges || [])
      .filter((edge) => edge?.from && edge?.to)
      .map((edge) => ({
        from: String(edge.from),
        to: String(edge.to),
        ...(edge.pin ? { pin: String(edge.pin) } : {})
      }))
  };
}
