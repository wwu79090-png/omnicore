import {
  EditorCoCreator25D,
  SocialAwareness25D,
  WorldMemory25D
} from './living-world-25d.js';
import { createEditorState, createLiveSyncMessage } from './live-sync-protocol.js';
import LiveSyncClient from './live-sync-client.js';
import AITilemapGenerator from './ai-tilemap-generator.js';

const PANEL_TITLES = {
  hierarchy: 'Scene Hierarchy',
  inspector: 'Inspector',
  'scene-view': 'Scene View',
  tilemap: 'Tilemap',
  prefabs: 'Prefabs',
  assets: 'Assets',
  database: 'Database',
  'ai-assistant': 'AI Assistant',
  'animation-timeline': 'Animation Timeline',
  'flow-graph': 'Flow Graph',
  'graph-editor': 'Graph Editor',
  'ui-editor': 'UI Editor',
  'global-search': 'Global Search',
  'physics-view': 'Physics View',
  'build-settings': 'Build Settings',
  profiler: 'Profiler'
};

const NUMERIC_FIELDS = new Set(['x', 'y', 'width', 'height', 'rotation', 'scale', 'scaleX', 'scaleY', 'alpha']);
const DOCK_REGIONS = ['left', 'center', 'right', 'bottom'];
const DEFAULT_DOCK_LAYOUT = {
  left: ['hierarchy', 'prefabs', 'assets'],
  center: ['scene-view'],
  right: ['inspector', 'build-settings'],
  bottom: ['animation-timeline', 'tilemap', 'flow-graph', 'graph-editor', 'ui-editor', 'global-search', 'profiler']
};
const TOOLBAR_ACTIONS = [
  { id: 'open-project', label: 'Open Project', shortcut: 'Ctrl+O' },
  { id: 'save', label: 'Save', shortcut: 'Ctrl+S' },
  { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z' },
  { id: 'play', label: 'Play' },
  { id: 'pause', label: 'Pause' },
  { id: 'step', label: 'Step' },
  { id: 'profiler', label: 'Profiler' },
  { id: 'dock-reset', label: 'Reset Dock' }
];

export function createInputFocusManager({ root = null } = {}) {
  let gizmoShortcutsEnabled = true;

  const api = {
    enableGizmoShortcuts() {
      gizmoShortcutsEnabled = true;
      return gizmoShortcutsEnabled;
    },
    disableGizmoShortcuts() {
      gizmoShortcutsEnabled = false;
      return gizmoShortcutsEnabled;
    },
    areGizmoShortcutsEnabled() {
      return gizmoShortcutsEnabled;
    },
    isTextInputTarget: isTextEditingTarget,
    destroy() {
      root?.removeEventListener?.('mousedown', onPointerDown, true);
      root?.removeEventListener?.('focusin', onFocusIn, true);
    }
  };

  function onPointerDown(event) {
    if (isTextEditingTarget(event.target)) {
      api.disableGizmoShortcuts();
      return;
    }
    if (isSceneCanvasTarget(event.target)) api.enableGizmoShortcuts();
  }

  function onFocusIn(event) {
    if (isTextEditingTarget(event.target)) api.disableGizmoShortcuts();
  }

  root?.addEventListener?.('mousedown', onPointerDown, true);
  root?.addEventListener?.('focusin', onFocusIn, true);
  return api;
}

function asElement(target) {
  if (!target) return null;
  if (target.nodeType === 1) return target;
  return target.parentElement || null;
}

function isTextEditingTarget(target) {
  let element = asElement(target);
  while (element) {
    const tagName = String(element.tagName || '').toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
    const editable = element.getAttribute?.('contenteditable');
    if (editable != null && String(editable).toLowerCase() !== 'false') return true;
    element = element.parentElement;
  }
  return false;
}

function isSceneCanvasTarget(target) {
  const element = asElement(target);
  return Boolean(element?.closest?.('.scene-canvas, [data-scene-drop-zone]'));
}

export function createEditorApp(root = document.querySelector('#app'), {
  state = createEditorState(),
  syncUrl = null,
  transport = null,
  localization = null,
  autoSaveIntervalMs = null,
  autoCheckRecovery = true
} = {}) {
  let current = createEditorState(state);
  let dragSession = null;
  let marqueeSession = null;
  let tilePaintSession = false;
  let autoSaveTimer = null;
  let recoveryChecked = false;
  let clipboard = [];
  let copySerial = 1;
  let editorFeedback = null;
  let lastSavedSnapshot = null;
  let savedVersions = [];
  let saveVersionSerial = 1;
  let debugTimeline = { events: [], frames: [] };
  let history = [cloneState(current)];
  let historyLabels = ['Initial scene'];
  let historyIndex = 0;
  const sceneBaselines = new Map();
  const t = createTextResolver(localization);
  const ownerWindow = root.ownerDocument?.defaultView || globalThis.window;
  const bridge = ownerWindow?.omnicoreEditor || null;
  current = {
    ...current,
    autoSave: {
      ...(current.autoSave || {}),
      intervalMs: Math.max(1000, Number(autoSaveIntervalMs || current.autoSave?.intervalMs || 300000))
    }
  };
  root.className = 'omnicore-desktop-editor';
  root.dataset.editorTheme = 'omnicore-unified';
  root.innerHTML = `
    <style>${EDITOR_CSS}</style>
    <div class="editor-frame">
      <nav class="editor-toolbar" data-editor-toolbar data-editor-surface="topbar" aria-label="Editor toolbar"></nav>
      <div class="editor-shell" data-dock-layout></div>
      <footer class="editor-statusbar" data-editor-statusbar></footer>
    </div>
  `;
  const toolbar = root.querySelector('[data-editor-toolbar]');
  const shell = root.querySelector('.editor-shell');
  const statusbar = root.querySelector('[data-editor-statusbar]');
  const client = syncUrl ? new LiveSyncClient({ url: syncUrl, onState: (next) => update(next) }).connect() : null;
  const inputFocusManager = createInputFocusManager({ root });

  const api = {
    update,
    getState: () => current,
    getDockLayout: () => cloneState(current.dockLayout),
    setDockLayout,
    movePanelToRegion,
    openProjectWorkspace,
    checkRecovery,
    runAutoSave,
    setAutoSaveInterval,
    getAutoSaveIntervalMs: () => current.autoSave.intervalMs,
    InputFocusManager: inputFocusManager,
    EditorAPI: createEditorAPI(),
    undo,
    redo,
    copySelection,
    pasteSelection,
    deleteSelection,
    setGridSnap,
    openCommandPalette,
    closeCommandPalette,
    runCommand,
    validateScene,
    locateSceneIssue,
    selectAnimationKeyframe,
    setAnimationCurve,
    addAnimationEvent,
    previewAnimationFrame,
    exportAnimationClip,
    selectPrefab,
    writePrefabOverrideToBase,
    resetPrefabOverride,
    openParticleEditor,
    setParticleParameter,
    setParticleCurve,
    setParticleGradient,
    exportParticleConfig,
    openSpriteEditor,
    setNineSliceGuides,
    autoGenerateSpriteCollider,
    setSpriteMaterial,
    exportSpriteMeta,
    openProfiler,
    recordProfilerFrame,
    openSceneTab,
    switchSceneTab,
    instantiateSubScene,
    captureSceneBaseline,
    getSceneDiff,
    createPrefabSnapshot,
    getPrefabHistory,
    toggleSceneOverlays,
    saveSnapshot,
    listSaveVersions,
    diffSaveVersions,
    rollbackToSaveVersion,
    exportTiledJson,
    exportFlowGraphEventSheet,
    exportBehaviorTreeJson,
    exportUILayoutJson,
    exportDataJson,
    createRuntimeSyncPayload,
    applyRuntimeSyncPayload,
    create25DPreview,
    drag25DNode,
    generateFakeShadows,
    plan25DCoCreation,
    apply25DCoCreationPlan,
    previewLivingWorld25D,
    previewWorldMemory25D,
    buildAssetDependencyGraph,
    replaceAssetReferences,
    runIncrementalCompile,
    recordDebugEvent,
    exportDebugTimeline,
    exportAnimationStateMachine,
    instantiateNestedScene,
    validateAuthoringAssets,
    exportAuthoringBundle,
    exportLightweightDeploymentBundle,
    create25DProductionReadinessReport,
    create25DVisualEvidence,
    exportProductionDeploymentBundle,
    createAssetWorkflowIndex,
    createCollaborationHandoff,
    createProjectGovernanceReport,
    exportMatureEditorBundle,
    getProfilerHotspots,
    destroy,
    sync: client
  };
  if (ownerWindow) {
    ownerWindow.OmniCore = ownerWindow.OmniCore || {};
    ownerWindow.OmniCore.EditorAPI = api.EditorAPI;
  }

  ownerWindow?.addEventListener?.('mousemove', onPointerMove);
  ownerWindow?.addEventListener?.('mouseup', onPointerUp);
  ownerWindow?.addEventListener?.('keydown', onKeyDown);
  const unsubscribeWorkspace = bridge?.onWorkspaceOpened?.((workspace) => applyWorkspace(workspace));
  const unsubscribeMenu = bridge?.onMenuCommand?.((payload) => runMenuCommand(payload?.command));
  scheduleAutoSave();
  if (shouldAutoCheckRecovery()) queueMicrotask(() => checkRecovery());
  update(current);
  return api;

  function update(next = current) {
    current = createEditorState({
      ...current,
      ...next,
      scene: normalizeScene(next.scene || current.scene),
      workspace: normalizeWorkspaceState(next.workspace || current.workspace),
      tilemap: next.tilemap || current.tilemap,
      flowGraph: normalizeFlowGraph(next.flowGraph || current.flowGraph),
      prefabs: next.prefabs || current.prefabs,
      assets: next.assets || current.assets,
      assetPreview: next.assetPreview ?? current.assetPreview,
      prefabPreview: next.prefabPreview ?? current.prefabPreview,
      playState: next.playState || current.playState,
      profilerFrame: next.profilerFrame || current.profilerFrame,
      database: next.database || current.database,
      projectFiles: normalizeProjectFilesState(next.projectFiles || current.projectFiles),
      globalSearch: normalizeGlobalSearchState(next.globalSearch || current.globalSearch),
      resourcePicker: normalizeResourcePickerState(next.resourcePicker || current.resourcePicker),
      physicsView: normalizePhysicsViewState(next.physicsView || current.physicsView),
      prefabHotEdit: normalizePrefabHotEditState(next.prefabHotEdit || current.prefabHotEdit),
      buildSettings: normalizeBuildSettingsState(next.buildSettings || current.buildSettings),
      uiLayout: normalizeUILayoutState(next.uiLayout || current.uiLayout),
      behaviorTree: next.behaviorTree || current.behaviorTree || null,
      lastCommandError: next.lastCommandError || current.lastCommandError,
      dockLayout: normalizeDockLayout(next.dockLayout || current.dockLayout),
      gridSnap: next.gridSnap || current.gridSnap,
      sceneOverlays: next.sceneOverlays || current.sceneOverlays,
      commandPaletteOpen: next.commandPaletteOpen ?? current.commandPaletteOpen,
      sceneValidation: next.sceneValidation || current.sceneValidation,
      sceneIssueTargetId: next.sceneIssueTargetId ?? current.sceneIssueTargetId,
      prefabHistory: next.prefabHistory || current.prefabHistory,
      selectedAnimationKeyframe: next.selectedAnimationKeyframe ?? current.selectedAnimationKeyframe,
      particleEditor: next.particleEditor || current.particleEditor,
      spriteEditor: next.spriteEditor || current.spriteEditor,
      profilerOpen: next.profilerOpen ?? current.profilerOpen,
      profilerHistory: next.profilerHistory || current.profilerHistory,
      sceneTabs: next.sceneTabs || current.sceneTabs,
      activeSceneTabPath: next.activeSceneTabPath ?? current.activeSceneTabPath,
      authoringHealth: next.authoringHealth || current.authoringHealth,
      autoSave: normalizeAutoSaveState(next.autoSave || current.autoSave)
    });
    renderToolbar();
    shell.textContent = '';
    const panels = {
      hierarchy: renderPanel('hierarchy', renderHierarchy()),
      'scene-view': renderPanel('scene-view', renderSceneView()),
      inspector: renderPanel('inspector', renderInspector()),
      database: renderPanel('database', renderDatabase()),
      'ai-assistant': renderPanel('ai-assistant', renderAIAssistant()),
      prefabs: renderPanel('prefabs', renderPrefabs()),
      assets: renderPanel('assets', renderAssets()),
      tilemap: renderPanel('tilemap', renderTilemap()),
      'animation-timeline': renderPanel('animation-timeline', renderTimeline()),
      'flow-graph': renderPanel('flow-graph', renderFlowGraph()),
      'graph-editor': renderPanel('graph-editor', renderGraphEditor()),
      'ui-editor': renderPanel('ui-editor', renderUIEditor()),
      'global-search': renderPanel('global-search', renderGlobalSearch()),
      'physics-view': renderPanel('physics-view', renderPhysicsView()),
      'build-settings': renderPanel('build-settings', renderBuildSettings()),
      profiler: renderPanel('profiler', renderProfiler())
    };
    for (const region of DOCK_REGIONS) {
      const regionNode = document.createElement('div');
      regionNode.className = `dock-region dock-${region}`;
      regionNode.dataset.dockRegion = region;
      regionNode.dataset.editorSurface = region === 'center' ? 'canvas' : 'sidebar';
      regionNode.addEventListener('dragover', (event) => event.preventDefault());
      regionNode.addEventListener('drop', (event) => {
        event.preventDefault();
        const panelName = event.dataTransfer?.getData('application/x-omnicore-dock-panel');
        if (panelName) movePanelToRegion(panelName, region);
      });
      for (const panelName of current.dockLayout[region] || []) {
        if (panels[panelName]) regionNode.appendChild(panels[panelName]);
      }
      shell.appendChild(regionNode);
    }
    renderStatusbar();
    renderTransientSurfaces();
    return current;
  }

  function setDockLayout(layout = DEFAULT_DOCK_LAYOUT) {
    current = { ...current, dockLayout: normalizeDockLayout(layout) };
    emit('editor:dock-layout', current.dockLayout);
    persistDockLayout();
    update(current);
    return current.dockLayout;
  }

  function movePanelToRegion(panelName, region, index = null) {
    if (!PANEL_TITLES[panelName] || !DOCK_REGIONS.includes(region)) return current.dockLayout;
    const nextLayout = normalizeDockLayout(current.dockLayout);
    for (const key of DOCK_REGIONS) {
      nextLayout[key] = nextLayout[key].filter((panel) => panel !== panelName);
    }
    const target = nextLayout[region];
    const insertAt = Number.isFinite(Number(index)) ? Math.max(0, Math.min(target.length, Number(index))) : target.length;
    target.splice(insertAt, 0, panelName);
    current = { ...current, dockLayout: nextLayout };
    emit('editor:dock-panel-move', { panel: panelName, region, index: insertAt });
    persistDockLayout();
    update(current);
    return current.dockLayout;
  }

  function pushHistory(next, label = 'Scene change') {
    const snapshot = cloneState(next);
    history = history.slice(0, historyIndex + 1);
    historyLabels = historyLabels.slice(0, historyIndex + 1);
    history.push(snapshot);
    historyLabels.push(label);
    if (history.length > 100) {
      history.shift();
      historyLabels.shift();
    }
    historyIndex = history.length - 1;
    return snapshot;
  }

  function undo() {
    if (historyIndex <= 0) return current;
    historyIndex -= 1;
    current = cloneState(history[historyIndex]);
    emit('editor:undo', { historyIndex });
    return update(current);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return current;
    historyIndex += 1;
    current = cloneState(history[historyIndex]);
    emit('editor:redo', { historyIndex });
    return update(current);
  }

  function saveSnapshot(name = 'scene') {
    const id = `save-${String(saveVersionSerial).padStart(3, '0')}`;
    saveVersionSerial += 1;
    const snapshot = {
      id,
      name,
      version: 1,
      savedAt: new Date().toISOString(),
      scene: cloneState(current.scene),
      workspace: cloneState(current.workspace),
      tilemap: cloneState(current.tilemap),
      prefabs: cloneState(current.prefabs),
      assets: cloneState(current.assets),
      flowGraph: cloneState(current.flowGraph),
      behaviorTree: cloneState(current.behaviorTree),
      uiLayout: cloneState(current.uiLayout),
      database: cloneState(current.database),
      playState: cloneState(current.playState),
      animations: cloneState(current.animations),
      selectedAnimationKeyframe: cloneState(current.selectedAnimationKeyframe),
      particleEditor: cloneState(current.particleEditor),
      spriteEditor: cloneState(current.spriteEditor),
      profilerFrame: cloneState(current.profilerFrame),
      profilerHistory: cloneState(current.profilerHistory || []),
      sceneTabs: cloneState(current.sceneTabs || []),
      activeSceneTabPath: current.activeSceneTabPath || null,
      coCreation25D: cloneState(current.coCreation25D || null),
      preview25D: cloneState(current.preview25D || null)
    };
    lastSavedSnapshot = snapshot;
    savedVersions = [...savedVersions, cloneState(snapshot)].slice(-50);
    emit('editor:save-snapshot', snapshot);
    showEditorFeedback(`Saved ${name}`, 'success');
    update(current);
    return snapshot;
  }

  function listSaveVersions() {
    return savedVersions.map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      version: snapshot.version,
      savedAt: snapshot.savedAt,
      scene: snapshot.scene?.name || 'untitled',
      entities: (snapshot.scene?.entities || []).length,
      coCreatedEntities: (snapshot.scene?.entities || []).filter((entity) => entity.coCreated).length
    }));
  }

  function diffSaveVersions(fromId, toId) {
    const from = findSaveVersion(fromId);
    const to = findSaveVersion(toId);
    if (!from || !to) return null;
    const fromEntities = new Map((from.scene?.entities || []).map((entity) => [String(entity.id), entity]));
    const toEntities = new Map((to.scene?.entities || []).map((entity) => [String(entity.id), entity]));
    const addedEntities = [];
    const removedEntities = [];
    const changedEntities = [];

    for (const [id, entity] of toEntities) {
      if (!fromEntities.has(id)) {
        addedEntities.push(cloneState(entity));
      } else if (entitySignature(fromEntities.get(id)) !== entitySignature(entity)) {
        changedEntities.push({
          id,
          before: cloneState(fromEntities.get(id)),
          after: cloneState(entity)
        });
      }
    }
    for (const [id, entity] of fromEntities) {
      if (!toEntities.has(id)) removedEntities.push(cloneState(entity));
    }

    return {
      format: 'OmniCore.EditorSaveVersionDiff',
      from: from.id,
      to: to.id,
      scene: to.scene?.name || from.scene?.name || 'untitled',
      addedEntities: addedEntities.sort((left, right) => String(left.id).localeCompare(String(right.id))),
      removedEntities: removedEntities.sort((left, right) => String(left.id).localeCompare(String(right.id))),
      changedEntities: changedEntities.sort((left, right) => left.id.localeCompare(right.id))
    };
  }

  function rollbackToSaveVersion(id) {
    const snapshot = findSaveVersion(id);
    if (!snapshot) return null;
    const scene = normalizeScene(snapshot.scene);
    current = {
      ...current,
      scene,
      workspace: cloneState(snapshot.workspace || current.workspace),
      tilemap: cloneState(snapshot.tilemap || current.tilemap),
      prefabs: cloneState(snapshot.prefabs || current.prefabs),
      assets: cloneState(snapshot.assets || current.assets),
      flowGraph: cloneState(snapshot.flowGraph || current.flowGraph),
      behaviorTree: cloneState(snapshot.behaviorTree || current.behaviorTree),
      uiLayout: cloneState(snapshot.uiLayout || current.uiLayout),
      database: cloneState(snapshot.database || current.database),
      playState: cloneState(snapshot.playState || current.playState),
      animations: cloneState(snapshot.animations || current.animations),
      selectedAnimationKeyframe: cloneState(snapshot.selectedAnimationKeyframe || current.selectedAnimationKeyframe),
      particleEditor: cloneState(snapshot.particleEditor || current.particleEditor),
      spriteEditor: cloneState(snapshot.spriteEditor || current.spriteEditor),
      profilerFrame: cloneState(snapshot.profilerFrame || current.profilerFrame),
      profilerHistory: cloneState(snapshot.profilerHistory || []),
      sceneTabs: restoreSnapshotSceneTabs(snapshot, scene),
      activeSceneTabPath: snapshot.activeSceneTabPath || current.activeSceneTabPath || null,
      coCreation25D: cloneState(snapshot.coCreation25D || null),
      preview25D: cloneState(snapshot.preview25D || null)
    };
    lastSavedSnapshot = null;
    emit('editor:rollback-save-version', { id: snapshot.id, name: snapshot.name });
    pushHistory(current, `Rollback to ${snapshot.name}`);
    showEditorFeedback(`Rolled back to ${snapshot.name}`, 'success');
    update(current);
    return cloneState(snapshot);
  }

  function findSaveVersion(id) {
    return savedVersions.find((snapshot) => snapshot.id === id || snapshot.name === id) || null;
  }

  function restoreSnapshotSceneTabs(snapshot, scene) {
    const tabs = cloneState(snapshot.sceneTabs || current.sceneTabs || []);
    const activePath = snapshot.activeSceneTabPath || current.activeSceneTabPath || null;
    if (!activePath) return tabs;
    let restored = false;
    const nextTabs = tabs.map((tab) => {
      if (tab.path !== activePath) return tab;
      restored = true;
      return {
        ...tab,
        scene: normalizeScene(scene),
        dirty: true
      };
    });
    if (!restored) {
      nextTabs.push({
        path: activePath,
        scene: normalizeScene(scene),
        dirty: true
      });
    }
    return nextTabs;
  }

  async function openProjectWorkspace() {
    const workspace = await bridge?.openProjectFolder?.();
    if (!workspace || workspace.canceled) return null;
    return applyWorkspace(workspace);
  }

  function applyWorkspace(workspace = {}) {
    const normalized = normalizeWorkspaceState(workspace);
    current = {
      ...current,
      workspace: normalized,
      assets: normalized.assets,
      assetPreview: null,
      prefabPreview: null
    };
    emit('editor:workspace-opened', normalized);
    update(current);
    return normalized;
  }

  async function checkRecovery() {
    if (recoveryChecked) return null;
    recoveryChecked = true;
    if (typeof bridge?.readPendingRecovery !== 'function') return null;
    const recovery = await bridge.readPendingRecovery({ root: current.workspace?.root || null });
    if (!recovery?.exists || !recovery.snapshot) return recovery || null;
    const shouldRecover = typeof ownerWindow?.confirm === 'function'
      ? ownerWindow.confirm('发现上次异常退出留下的 OmniCore Editor 自动备份，是否恢复？')
      : true;
    if (!shouldRecover) {
      await bridge.clearAutoSave?.({ root: current.workspace?.root || null });
      return recovery;
    }
    const snapshot = recovery.snapshot.state || recovery.snapshot;
    current = createEditorState({
      ...current,
      ...snapshot
    });
    await bridge.clearAutoSave?.({ root: current.workspace?.root || null });
    update(current);
    return recovery;
  }

  async function runAutoSave(reason = 'timer') {
    const snapshot = {
      reason,
      intervalMs: current.autoSave.intervalMs,
      savedAt: new Date().toISOString(),
      root: current.workspace?.root || null,
      state: cloneState(current)
    };
    const result = typeof bridge?.writeAutoSave === 'function'
      ? await bridge.writeAutoSave(snapshot)
      : emit('editor:autosave', snapshot);
    current = {
      ...current,
      autoSave: {
        ...current.autoSave,
        lastSavedAt: snapshot.savedAt,
        lastPath: result?.path || current.autoSave.lastPath || null
      }
    };
    update(current);
    return snapshot;
  }

  function setAutoSaveInterval(intervalMs) {
    current = {
      ...current,
      autoSave: {
        ...current.autoSave,
        intervalMs: Math.max(1000, Number(intervalMs || 300000))
      }
    };
    scheduleAutoSave();
    update(current);
    return current.autoSave;
  }

  function scheduleAutoSave() {
    if (autoSaveTimer != null) ownerWindow?.clearInterval?.(autoSaveTimer);
    if (current.autoSave?.enabled === false || typeof ownerWindow?.setInterval !== 'function') return;
    autoSaveTimer = ownerWindow.setInterval(() => {
      runAutoSave('timer');
    }, current.autoSave.intervalMs);
  }

  function persistDockLayout() {
    const payload = {
      root: current.workspace?.root || null,
      layout: cloneState(current.dockLayout)
    };
    if (typeof bridge?.saveDockLayout === 'function') bridge.saveDockLayout(payload);
    else emit('editor:save-dock-layout', payload);
    return payload;
  }

  function destroy() {
    if (autoSaveTimer != null) ownerWindow?.clearInterval?.(autoSaveTimer);
    inputFocusManager.destroy();
    ownerWindow?.removeEventListener?.('mousemove', onPointerMove);
    ownerWindow?.removeEventListener?.('mouseup', onPointerUp);
    ownerWindow?.removeEventListener?.('keydown', onKeyDown);
    unsubscribeWorkspace?.();
    unsubscribeMenu?.();
    client?.close?.();
    if (ownerWindow?.OmniCore?.EditorAPI === api.EditorAPI) delete ownerWindow.OmniCore.EditorAPI;
    root.textContent = '';
  }

  function shouldAutoCheckRecovery() {
    return Boolean(
      autoCheckRecovery
      && typeof bridge?.readPendingRecovery === 'function'
      && (current.workspace?.root || bridge.autoCheckRecovery === true)
    );
  }

  function createEditorAPI() {
    return {
      getSelectedEntity: () => cloneState(findSelectedEntity(current)),
      getSceneTree: () => current.scene.entities.map((entity) => cloneState(entity)),
      patchInspector(patch = {}) {
        const selected = findSelectedEntity(current);
        if (!selected) return null;
        return patchEntity(selected.id, normalizeInspectorPatch(patch));
      },
      openEntityScript(entityOrId = current.selectedEntityId, symbol = null, options = {}) {
        return openEntityScript(entityOrId, symbol, options);
      },
      createPrefabVariant(prefabId, overrides = {}, options = {}) {
        const prefab = current.prefabs.find((item) => item.id === prefabId || item.name === prefabId);
        if (!prefab) return null;
        const overrideFields = Object.fromEntries(
          Object.entries(cloneState(overrides)).filter(([key]) => key !== 'id' && key !== 'extends')
        );
        const variant = {
          ...cloneState(prefab),
          ...cloneState(overrides),
          id: options.id || overrides.id || `${prefab.id || prefab.name}-variant`,
          extends: prefab.id || prefab.name,
          overrides: {
            ...(overrides.overrides || {}),
            ...overrideFields
          }
        };
        current = { ...current, prefabs: [...current.prefabs, variant] };
        emit('editor:create-prefab-variant', variant);
        pushHistory(current, `Create prefab variant ${variant.id}`);
        update(current);
        return variant;
      },
      markBasePrefab(prefabId) {
        return markBasePrefab(prefabId);
      },
      updatePrefabProperties(prefabId, patch = {}) {
        return updatePrefabProperties(prefabId, patch);
      },
      createNPCProximityRecipe(options = {}) {
        return createNPCProximityRecipe(options);
      },
      addUIButton(button = {}) {
        return addUIButton(button);
      },
      applyRuleTiles() {
        return applyRuleTiles();
      },
      updateDatabaseCell(table, id, field, value) {
        return updateDatabaseRecord(table, id, field, value);
      },
      openGlobalSearch(query = '') {
        return openGlobalSearch(query);
      },
      searchProject(query) {
        return searchProject(query);
      },
      replaceProject(query, replacement, options = {}) {
        return replaceProject(query, replacement, options);
      },
      openResourcePicker(field, options = {}) {
        return openResourcePicker(field, options);
      },
      selectResourceForField(field, assetPath) {
        return selectResourceForField(field, assetPath);
      },
      openPhysicsView() {
        return openPhysicsView();
      },
      editPrefabVariantRuntime(prefabId, patch = {}) {
        return editPrefabVariantRuntime(prefabId, patch);
      },
      exitPrefabHotEdit() {
        return exitPrefabHotEdit();
      },
      savePrefabHotEdit() {
        return savePrefabHotEdit();
      },
      setBuildTarget(platform, enabled = true) {
        return setBuildTarget(platform, enabled);
      },
      exportBuildSettings() {
        return exportBuildSettings();
      },
      generateWithAI(prompt, options = {}) {
        return generateWithAI(prompt, options);
      }
    };
  }

  function createNPCProximityRecipe({
    npcId = 'npc',
    playerId = 'player',
    animation = 'talk',
    dialog = '',
    distance = 48
  } = {}) {
    const graph = {
      nodes: [
        {
          id: 'npc-proximity-event',
          type: 'event',
          label: 'NPC Proximity',
          x: 24,
          y: 32,
          data: { when: { onUpdate: true } }
        },
        {
          id: 'npc-near-condition',
          type: 'condition',
          label: 'NPC Nearby',
          x: 220,
          y: 32,
          data: {
            op: 'distanceLessThan',
            left: playerId,
            right: npcId,
            value: Number(distance || 48)
          }
        },
        {
          id: 'npc-play-animation',
          type: 'action',
          label: 'Play Animation',
          x: 440,
          y: 8,
          data: {
            op: 'playAnimation',
            target: npcId,
            animation
          }
        },
        {
          id: 'npc-show-dialog',
          type: 'action',
          label: 'Show Dialog',
          x: 440,
          y: 96,
          data: {
            op: 'showDialog',
            target: npcId,
            text: dialog
          }
        }
      ],
      edges: [
        { from: 'npc-proximity-event', to: 'npc-near-condition' },
        { from: 'npc-near-condition', to: 'npc-play-animation' },
        { from: 'npc-near-condition', to: 'npc-show-dialog' }
      ]
    };
    current = {
      ...current,
      flowGraph: normalizeFlowGraph(graph),
      behaviorTree: flowGraphToBehaviorTree(graph)
    };
    emit('editor:graph-recipe', { recipe: 'npc-proximity', npcId, playerId });
    pushHistory(current, 'Create NPC proximity graph');
    update(current);
    return current.flowGraph;
  }

  function addUIButton(button = {}) {
    const uiLayout = normalizeUILayoutState(current.uiLayout);
    const element = normalizeUIElement({
      type: 'Button',
      width: 160,
      height: 40,
      ...button
    }, uiLayout.elements.length);
    const existingIndex = uiLayout.elements.findIndex((item) => item.id === element.id);
    const elements = [...uiLayout.elements];
    if (existingIndex >= 0) elements[existingIndex] = element;
    else elements.push(element);
    current = {
      ...current,
      uiLayout: {
        ...uiLayout,
        elements
      }
    };
    emit('editor:update-ui-layout', current.uiLayout);
    pushHistory(current, `Add UI button ${element.id}`);
    update(current);
    return element;
  }

  function openGlobalSearch(query = '') {
    current = {
      ...current,
      globalSearch: {
        ...normalizeGlobalSearchState(current.globalSearch),
        open: true,
        query: String(query || current.globalSearch?.query || '')
      },
      dockLayout: ensurePanelInDock(current.dockLayout, 'global-search', 'bottom')
    };
    emit('editor:open-global-search', { query: current.globalSearch.query });
    update(current);
    return current.globalSearch;
  }

  function searchProject(query = current.globalSearch?.query || '') {
    const normalizedQuery = String(query || '');
    const results = [];
    if (normalizedQuery) {
      for (const [filePath, content] of Object.entries(normalizeProjectFilesState(current.projectFiles))) {
        if (!isSearchableProjectFile(filePath)) continue;
        const lines = String(content).split(/\r?\n/u);
        lines.forEach((line, index) => {
          const column = line.toLowerCase().indexOf(normalizedQuery.toLowerCase());
          if (column >= 0) {
            results.push({
              path: filePath,
              line: index + 1,
              column: column + 1,
              preview: line.trim()
            });
          }
        });
      }
    }
    current = {
      ...current,
      globalSearch: {
        ...normalizeGlobalSearchState(current.globalSearch),
        open: true,
        query: normalizedQuery,
        results
      },
      dockLayout: ensurePanelInDock(current.dockLayout, 'global-search', 'bottom')
    };
    emit('editor:global-search', { query: normalizedQuery, count: results.length });
    update(current);
    return results;
  }

  function replaceProject(query, replacement, options = {}) {
    const normalizedQuery = String(query || '');
    if (!normalizedQuery) return { changedFiles: [], projectFiles: cloneState(current.projectFiles || {}) };
    const allowedPaths = options.paths ? new Set(options.paths) : null;
    const files = normalizeProjectFilesState(current.projectFiles);
    const changedFiles = [];
    const pattern = new RegExp(escapeRegExp(normalizedQuery), 'gu');
    for (const [filePath, content] of Object.entries(files)) {
      if (!isSearchableProjectFile(filePath) || (allowedPaths && !allowedPaths.has(filePath))) continue;
      const nextContent = String(content).replace(pattern, String(replacement ?? ''));
      if (nextContent !== content) {
        files[filePath] = nextContent;
        changedFiles.push(filePath);
      }
    }
    current = {
      ...current,
      projectFiles: files,
      globalSearch: {
        ...normalizeGlobalSearchState(current.globalSearch),
        replacement: String(replacement ?? ''),
        results: []
      }
    };
    emit('editor:replace-project', { query: normalizedQuery, replacement, changedFiles });
    pushHistory(current, `Replace ${normalizedQuery} in project`);
    update(current);
    return { changedFiles, projectFiles: cloneState(files) };
  }

  function openResourcePicker(field, { query = '' } = {}) {
    current = {
      ...current,
      resourcePicker: {
        open: true,
        field,
        query
      }
    };
    emit('editor:open-resource-picker', { field, query });
    update(current);
    return current.resourcePicker;
  }

  function selectResourceForField(field, assetPath) {
    const selected = findSelectedEntity(current);
    if (!selected || !field || !assetPath) return null;
    const entity = patchEntity(selected.id, { [field]: assetPath });
    current = {
      ...current,
      resourcePicker: {
        ...normalizeResourcePickerState(current.resourcePicker),
        open: false
      }
    };
    emit('editor:select-resource', { field, assetPath, entityId: selected.id });
    update(current);
    return entity;
  }

  function openPhysicsView() {
    current = {
      ...current,
      physicsView: { open: true },
      dockLayout: ensurePanelInDock(current.dockLayout, 'physics-view', 'center')
    };
    emit('editor:open-physics-view', { bodies: physicsBodies(current).length });
    update(current);
    return current.physicsView;
  }

  function editPrefabVariantRuntime(prefabId, patch = {}) {
    const existing = current.prefabs.find((prefab) => (prefab.id || prefab.name) === prefabId);
    if (!existing) return null;
    current = {
      ...current,
      prefabHotEdit: {
        prefabId,
        patch: cloneState(patch),
        dirty: current.playState?.mode === 'paused',
        promptOpen: false
      }
    };
    emit('editor:prefab-hot-edit', { prefabId, patch });
    update(current);
    return current.prefabHotEdit;
  }

  function exitPrefabHotEdit() {
    const hotEdit = normalizePrefabHotEditState(current.prefabHotEdit);
    if (!hotEdit.dirty) return hotEdit;
    current = {
      ...current,
      prefabHotEdit: {
        ...hotEdit,
        promptOpen: true
      }
    };
    emit('editor:prefab-hot-edit-save-prompt', { prefabId: hotEdit.prefabId });
    update(current);
    return current.prefabHotEdit;
  }

  function savePrefabHotEdit() {
    const hotEdit = normalizePrefabHotEditState(current.prefabHotEdit);
    if (!hotEdit.prefabId || !hotEdit.dirty) return null;
    const prefabs = current.prefabs.map((prefab) => {
      const id = prefab.id || prefab.name;
      if (id !== hotEdit.prefabId) return prefab;
      return {
        ...prefab,
        ...cloneState(hotEdit.patch),
        overrides: {
          ...(prefab.overrides || {}),
          ...cloneState(hotEdit.patch)
        }
      };
    });
    current = {
      ...current,
      prefabs,
      prefabHotEdit: { prefabId: null, patch: {}, dirty: false, promptOpen: false }
    };
    emit('editor:save-prefab-hot-edit', { prefabId: hotEdit.prefabId, patch: hotEdit.patch });
    pushHistory(current, `Save prefab hot edit ${hotEdit.prefabId}`);
    update(current);
    return current.prefabs.find((prefab) => (prefab.id || prefab.name) === hotEdit.prefabId) || null;
  }

  function setBuildTarget(platform, enabled = true) {
    const buildSettings = normalizeBuildSettingsState(current.buildSettings);
    if (!buildSettings.targets[platform]) return buildSettings;
    current = {
      ...current,
      buildSettings: {
        ...buildSettings,
        targets: {
          ...buildSettings.targets,
          [platform]: {
            ...buildSettings.targets[platform],
            enabled: Boolean(enabled)
          }
        }
      },
      dockLayout: ensurePanelInDock(current.dockLayout, 'build-settings', 'right')
    };
    emit('editor:set-build-target', { platform, enabled: Boolean(enabled) });
    update(current);
    return current.buildSettings;
  }

  function exportBuildSettings() {
    return cloneState(normalizeBuildSettingsState(current.buildSettings));
  }

  function markBasePrefab(prefabId) {
    let updated = null;
    const prefabs = current.prefabs.map((prefab) => {
      if ((prefab.id || prefab.name) !== prefabId) return prefab;
      updated = { ...prefab, isBasePrefab: true };
      return updated;
    });
    current = { ...current, prefabs };
    emit('editor:mark-base-prefab', { prefabId });
    pushHistory(current, `Mark base prefab ${prefabId}`);
    update(current);
    return updated;
  }

  function updatePrefabProperties(prefabId, patch = {}) {
    const safePatch = cloneState(patch);
    const descendants = collectPrefabDescendants(prefabId, current.prefabs);
    const affected = new Set([prefabId, ...descendants]);
    const prefabs = current.prefabs.map((prefab) => {
      const id = prefab.id || prefab.name;
      if (!affected.has(id)) return prefab;
      if (id === prefabId) return { ...prefab, ...safePatch };
      const overrides = prefab.overrides || {};
      const inheritedPatch = Object.fromEntries(
        Object.entries(safePatch).filter(([key]) => !Object.prototype.hasOwnProperty.call(overrides, key))
      );
      return { ...prefab, ...inheritedPatch };
    });
    current = { ...current, prefabs };
    emit('editor:update-prefab-properties', { prefabId, patch: safePatch, affected: [...affected] });
    pushHistory(current, `Update prefab ${prefabId}`);
    update(current);
    return current.prefabs.find((prefab) => (prefab.id || prefab.name) === prefabId) || null;
  }

  function collectPrefabDescendants(prefabId, prefabs) {
    const childrenByParent = new Map();
    for (const prefab of prefabs) {
      if (!prefab.extends) continue;
      const parent = String(prefab.extends);
      if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
      childrenByParent.get(parent).push(prefab.id || prefab.name);
    }
    const output = [];
    const queue = [...(childrenByParent.get(prefabId) || [])];
    while (queue.length) {
      const id = queue.shift();
      if (output.includes(id)) continue;
      output.push(id);
      queue.push(...(childrenByParent.get(id) || []));
    }
    return output;
  }

  function selectAnimationKeyframe(clipId, track, frame) {
    current = {
      ...current,
      selectedAnimationKeyframe: {
        clipId: String(clipId),
        track: String(track),
        frame: Number(frame || 0)
      }
    };
    emit('editor:select-animation-keyframe', current.selectedAnimationKeyframe);
    update(current);
    return current.selectedAnimationKeyframe;
  }

  function setAnimationCurve(clipId, track, frame, curve = {}) {
    const animations = cloneState(current.animations || {});
    const clip = ensureAnimationClip(animations, clipId);
    const trackData = ensureAnimationTrack(clip, track);
    const keyframe = ensureAnimationKeyframe(trackData, frame);
    keyframe.easing = curve.preset || curve.easing || keyframe.easing || 'Linear';
    keyframe.handles = cloneState(curve.handles || keyframe.handles || {});
    current = {
      ...current,
      animations,
      selectedAnimationKeyframe: {
        clipId: String(clipId),
        track: String(track),
        frame: Number(frame || 0)
      }
    };
    emit('editor:set-animation-curve', {
      clipId,
      track,
      frame: Number(frame || 0),
      easing: keyframe.easing,
      handles: keyframe.handles
    });
    pushHistory(current, `Set animation curve ${clipId}.${track}.${frame}`);
    update(current);
    return cloneState(keyframe);
  }

  function addAnimationEvent(clipId, frame, name, payload = {}) {
    const animations = cloneState(current.animations || {});
    const clip = ensureAnimationClip(animations, clipId);
    const eventFrame = Number(frame || 0);
    const events = Array.isArray(clip.events) ? clip.events : [];
    const event = { frame: eventFrame, name: String(name), payload: cloneState(payload || {}) };
    clip.events = [...events.filter((item) => !(item.frame === eventFrame && item.name === event.name)), event]
      .sort((left, right) => Number(left.frame || 0) - Number(right.frame || 0));
    current = { ...current, animations };
    emit('editor:add-animation-event', { clipId, event });
    pushHistory(current, `Add animation event ${event.name}`);
    update(current);
    return cloneState(event);
  }

  function previewAnimationFrame(clipId, frame, options = {}) {
    const clip = current.animations?.[clipId];
    if (!clip) return [];
    const eventFrame = Number(frame || 0);
    const events = (Array.isArray(clip.events) ? clip.events : [])
      .filter((event) => Number(event.frame || 0) === eventFrame);
    for (const event of events) {
      const payload = {
        ...(event.payload || {}),
        clipId,
        frame: eventFrame,
        event: cloneState(event)
      };
      options.eventBus?.emit?.(event.name, payload);
      ownerWindow?.EventBus?.emit?.(event.name, payload);
    }
    emit('editor:preview-animation-frame', { clipId, frame: eventFrame, events });
    return cloneState(events);
  }

  function exportAnimationClip(clipId) {
    return cloneState(current.animations?.[clipId] || null);
  }

  function selectPrefab(prefabId) {
    current = { ...current, selectedPrefabId: prefabId || null };
    emit('editor:select-prefab', { prefabId: current.selectedPrefabId });
    update(current);
    return findPrefab(prefabId);
  }

  function writePrefabOverrideToBase(variantId, field) {
    const variant = findPrefab(variantId);
    if (!variant?.extends || !field) return null;
    const baseId = variant.extends;
    const value = cloneState(variant[field]);
    const prefabs = current.prefabs.map((prefab) => {
      const id = prefab.id || prefab.name;
      if (id === baseId) return { ...prefab, [field]: value };
      if (id !== variantId) return prefab;
      const overrides = { ...(prefab.overrides || {}) };
      delete overrides[field];
      return { ...prefab, overrides };
    });
    current = { ...current, prefabs };
    emit('editor:write-prefab-override', { variantId, baseId, field, value });
    pushHistory(current, `Write prefab override ${variantId}.${field}`);
    update(current);
    return findPrefab(baseId);
  }

  function resetPrefabOverride(variantId, field) {
    const variant = findPrefab(variantId);
    const base = variant?.extends ? findPrefab(variant.extends) : null;
    if (!variant || !base || !field) return null;
    const value = cloneState(base[field]);
    const prefabs = current.prefabs.map((prefab) => {
      const id = prefab.id || prefab.name;
      if (id !== variantId) return prefab;
      const overrides = { ...(prefab.overrides || {}) };
      delete overrides[field];
      return { ...prefab, [field]: value, overrides };
    });
    current = { ...current, prefabs };
    emit('editor:reset-prefab-override', { variantId, field, value });
    pushHistory(current, `Reset prefab override ${variantId}.${field}`);
    update(current);
    return findPrefab(variantId);
  }

  function openParticleEditor(config = {}) {
    current = {
      ...current,
      particleEditor: {
        open: true,
        config: normalizeParticleConfig({
          ...(current.particleEditor?.config || {}),
          ...config
        })
      }
    };
    emit('editor:open-particle-editor', current.particleEditor.config);
    update(current);
    return current.particleEditor;
  }

  function setParticleParameter(field, value) {
    const editor = ensureParticleEditor();
    const config = normalizeParticleConfig(editor.config);
    config[field] = Number.isFinite(Number(value)) ? Number(value) : value;
    current = { ...current, particleEditor: { ...editor, open: true, config } };
    emit('editor:set-particle-parameter', { field, value: config[field] });
    pushHistory(current, `Set particle ${field}`);
    update(current);
    return config[field];
  }

  function setParticleCurve(name, points = []) {
    const editor = ensureParticleEditor();
    const config = normalizeParticleConfig(editor.config);
    config.curves = {
      ...(config.curves || {}),
      [name]: normalizeCurvePoints(points)
    };
    current = { ...current, particleEditor: { ...editor, open: true, config } };
    emit('editor:set-particle-curve', { name, points: config.curves[name] });
    pushHistory(current, `Set particle curve ${name}`);
    update(current);
    return config.curves[name];
  }

  function setParticleGradient(points = []) {
    const editor = ensureParticleEditor();
    const config = normalizeParticleConfig(editor.config);
    config.gradient = normalizeGradientPoints(points);
    current = { ...current, particleEditor: { ...editor, open: true, config } };
    emit('editor:set-particle-gradient', config.gradient);
    pushHistory(current, 'Set particle gradient');
    update(current);
    return config.gradient;
  }

  function exportParticleConfig(fileName = 'particle_config.json') {
    return {
      fileName,
      config: cloneState(normalizeParticleConfig(current.particleEditor?.config || {}))
    };
  }

  function openSpriteEditor(assetPath) {
    const source = slash(assetPath || current.assetPreview?.path || '');
    if (!source) return null;
    current = {
      ...current,
      spriteEditor: {
        open: true,
        source,
        nineSlice: normalizeNineSlice(current.spriteEditor?.nineSlice || {}),
        collider: current.spriteEditor?.collider || null
      }
    };
    emit('editor:open-sprite-editor', { source });
    update(current);
    return current.spriteEditor;
  }

  function setNineSliceGuides(guides = {}) {
    const editor = ensureSpriteEditor();
    if (!editor) return null;
    current = {
      ...current,
      spriteEditor: {
        ...editor,
        nineSlice: normalizeNineSlice({ ...(editor.nineSlice || {}), ...guides })
      }
    };
    emit('editor:set-nine-slice', current.spriteEditor.nineSlice);
    pushHistory(current, 'Set sprite nine-slice');
    update(current);
    return current.spriteEditor.nineSlice;
  }

  function autoGenerateSpriteCollider() {
    const editor = ensureSpriteEditor();
    if (!editor) return null;
    const right = Number(editor.nineSlice?.right || 64);
    const bottom = Number(editor.nineSlice?.bottom || 64);
    const collider = {
      type: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: right, y: 0 },
        { x: right, y: bottom },
        { x: 0, y: bottom }
      ]
    };
    current = { ...current, spriteEditor: { ...editor, collider } };
    emit('editor:auto-generate-sprite-collider', collider);
    pushHistory(current, 'Generate sprite collider');
    update(current);
    return collider;
  }

  function setSpriteMaterial(entityId, material = {}) {
    const entities = current.scene.entities.map((entity) => (
      entity.id === entityId
        ? { ...entity, material: normalizeSpriteMaterial({ ...(entity.material || {}), ...material }) }
        : entity
    ));
    const scene = { ...current.scene, entities };
    current = { ...current, scene, sceneTabs: updateActiveSceneTab(scene) };
    emit('editor:set-sprite-material', { entityId, material: findEntity(entityId)?.material || material });
    pushHistory(current, `Set sprite material ${entityId}`);
    update(current);
    return findEntity(entityId)?.material || null;
  }

  function exportSpriteMeta() {
    const editor = current.spriteEditor || {};
    const source = editor.source || '';
    const name = source.split('/').pop()?.replace(/\.(png|jpg|jpeg|webp)$/iu, '') || 'sprite';
    return {
      fileName: `${name}.sprite.json`,
      meta: {
        source,
        nineSlice: cloneState(normalizeNineSlice(editor.nineSlice || {})),
        collider: cloneState(editor.collider || null)
      }
    };
  }

  function openProfiler() {
    current = { ...current, profilerOpen: true };
    emit('editor:open-profiler', { open: true });
    update(current);
    return current.profilerFrame;
  }

  function recordProfilerFrame(frame = {}) {
    const sample = normalizeProfilerSample(frame);
    current = {
      ...current,
      profilerOpen: true,
      profilerFrame: sample,
      profilerHistory: [...(current.profilerHistory || []), sample].slice(-180)
    };
    emit('editor:record-profiler-frame', sample);
    update(current);
    return sample;
  }

  function openSceneTab(tab = {}) {
    const path = slash(tab.path || tab.id || '');
    if (!path) return null;
    const scene = normalizeScene(tab.scene || { name: path.split('/').pop(), entities: [] });
    const sceneTabs = upsertSceneTab({ path, scene, dirty: Boolean(tab.dirty) }, current.sceneTabs);
    current = {
      ...current,
      sceneTabs,
      activeSceneTabPath: path,
      scene
    };
    emit('editor:open-scene-tab', { path });
    update(current);
    return sceneTabs.find((item) => item.path === path) || null;
  }

  function switchSceneTab(path) {
    const normalized = slash(path || '');
    const tab = current.sceneTabs.find((item) => item.path === normalized);
    if (!tab) return null;
    current = {
      ...current,
      activeSceneTabPath: tab.path,
      scene: normalizeScene(tab.scene)
    };
    emit('editor:switch-scene-tab', { path: tab.path });
    update(current);
    return tab;
  }

  function instantiateSubScene(path, point = {}) {
    const normalized = slash(path || '');
    const source = findSceneSource(normalized);
    if (!source) return null;
    const snapped = snapPoint(point, current);
    const idRoot = normalized.split('/').pop()?.replace(/\.json$/iu, '') || 'scene';
    const entity = {
      id: `subscene-${idRoot}-${Date.now().toString(36)}`,
      name: source.scene.name || idRoot,
      type: 'subscene',
      scenePath: normalized,
      scene: cloneState(source.scene),
      x: snapped.x,
      y: snapped.y,
      width: Number(source.scene.width || 0),
      height: Number(source.scene.height || 0),
      rotation: 0,
      scaleX: 1,
      scaleY: 1
    };
    const scene = {
      ...current.scene,
      entities: [...current.scene.entities, entity]
    };
    current = {
      ...current,
      scene,
      sceneTabs: updateActiveSceneTab(scene),
      selectedEntityId: entity.id,
      selectedEntityIds: [entity.id]
    };
    emit('editor:instantiate-subscene', { path: normalized, entity });
    pushHistory(current, `Instantiate subscene ${normalized}`);
    update(current);
    return entity;
  }

  function ensureAnimationClip(animations, clipId) {
    const key = String(clipId);
    animations[key] = animations[key] || { id: key, duration: 0, tracks: {}, events: [] };
    animations[key].id = animations[key].id || key;
    animations[key].tracks = animations[key].tracks || {};
    animations[key].events = Array.isArray(animations[key].events) ? animations[key].events : [];
    return animations[key];
  }

  function ensureAnimationTrack(clip, track) {
    const key = String(track);
    clip.tracks[key] = clip.tracks[key] || { keyframes: [] };
    clip.tracks[key].keyframes = Array.isArray(clip.tracks[key].keyframes) ? clip.tracks[key].keyframes : [];
    return clip.tracks[key];
  }

  function ensureAnimationKeyframe(trackData, frame) {
    const frameNumber = Number(frame || 0);
    let keyframe = trackData.keyframes.find((item) => Number(item.frame || 0) === frameNumber);
    if (!keyframe) {
      keyframe = { frame: frameNumber, value: 0, easing: 'Linear' };
      trackData.keyframes.push(keyframe);
      trackData.keyframes.sort((left, right) => Number(left.frame || 0) - Number(right.frame || 0));
    }
    return keyframe;
  }

  function findPrefab(prefabId) {
    return current.prefabs.find((prefab) => (prefab.id || prefab.name) === prefabId) || null;
  }

  function findEntity(entityId) {
    return current.scene.entities.find((entity) => entity.id === entityId) || null;
  }

  function ensureParticleEditor() {
    return current.particleEditor?.open
      ? current.particleEditor
      : openParticleEditor();
  }

  function normalizeParticleConfig(config = {}) {
    return {
      emissionRate: Number(config.emissionRate ?? 30),
      lifetime: Number(config.lifetime ?? 1),
      initialVelocity: Number(config.initialVelocity ?? 120),
      gravity: Number(config.gravity ?? 0),
      curves: Object.fromEntries(Object.entries(config.curves || {}).map(([key, points]) => [
        key,
        normalizeCurvePoints(points)
      ])),
      gradient: normalizeGradientPoints(config.gradient || [])
    };
  }

  function normalizeCurvePoints(points = []) {
    return (Array.isArray(points) ? points : []).map((point) => ({
      t: Number(point.t || 0),
      value: Number(point.value || 0)
    }));
  }

  function normalizeGradientPoints(points = []) {
    return (Array.isArray(points) ? points : []).map((point) => ({
      t: Number(point.t || 0),
      color: point.color || '#ffffff'
    }));
  }

  function ensureSpriteEditor() {
    if (current.spriteEditor?.open && current.spriteEditor.source) return current.spriteEditor;
    const imageAsset = current.assets.find((asset) => assetType(asset) === 'image');
    const source = typeof imageAsset === 'string' ? imageAsset : imageAsset?.path;
    return source ? openSpriteEditor(source) : null;
  }

  function normalizeNineSlice(value = {}) {
    return {
      left: Number(value.left || 0),
      right: Number(value.right || 0),
      top: Number(value.top || 0),
      bottom: Number(value.bottom || 0)
    };
  }

  function normalizeSpriteMaterial(material = {}) {
    return {
      alphaClip: Number(material.alphaClip ?? 0),
      colorTint: material.colorTint || '#ffffff',
      normalMap: material.normalMap || null
    };
  }

  function normalizeProfilerSample(frame = {}) {
    return {
      frame: Number(frame.frame || 0),
      time: Number(frame.time || 0),
      totalMs: Number(frame.totalMs || 0),
      sections: (Array.isArray(frame.sections) ? frame.sections : []).map((section) => ({
        name: section.name || 'unknown',
        duration: Number(section.duration || 0)
      })),
      memoryMB: Number(frame.memoryMB || frame.memory || 0),
      drawCalls: Number(frame.drawCalls || frame.drawcalls || 0)
    };
  }

  function upsertSceneTab(tab, tabs = []) {
    const next = (Array.isArray(tabs) ? tabs : []).filter((item) => item.path !== tab.path);
    next.push({
      path: tab.path,
      scene: normalizeScene(tab.scene),
      dirty: Boolean(tab.dirty)
    });
    return next;
  }

  function updateActiveSceneTab(scene) {
    if (!current.activeSceneTabPath) return current.sceneTabs || [];
    return (current.sceneTabs || []).map((tab) => (
      tab.path === current.activeSceneTabPath
        ? { ...tab, scene: normalizeScene(scene), dirty: true }
        : tab
    ));
  }

  function findSceneSource(path) {
    const tab = (current.sceneTabs || []).find((item) => item.path === path);
    if (tab) return { path, scene: normalizeScene(tab.scene) };
    const asset = (current.assets || [])
      .map((item) => (typeof item === 'string' ? { path: item } : item))
      .find((item) => slash(item.path || item.url || item.name || '') === path);
    const scene = asset?.data || asset?.scene || null;
    return scene ? { path, scene: normalizeScene(scene) } : null;
  }

  function validateAuthoringAssets(options = {}) {
    const report = buildAuthoringHealthReport({ ...options, open: options.open !== false });
    current = { ...current, authoringHealth: report };
    emit('editor:authoring-health', report);
    update(current);
    return cloneState(report);
  }

  function exportAuthoringBundle(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const files = [];
    for (const [clipId, clip] of Object.entries(current.animations || {}).sort(([left], [right]) => left.localeCompare(right))) {
      files.push({ path: `animations/${clipId}.animation.json`, data: cloneState(clip) });
    }
    if (current.particleEditor?.open || current.particleEditor?.config) {
      files.push({ path: 'particles/particle_config.json', data: cloneState(normalizeParticleConfig(current.particleEditor?.config || {})) });
    }
    for (const tab of [...(current.sceneTabs || [])].sort((left, right) => left.path.localeCompare(right.path))) {
      const name = tab.path.split('/').pop()?.replace(/\.json$/iu, '') || 'scene';
      files.push({ path: `scenes/${name}.scene.json`, data: cloneState(normalizeScene(tab.scene)) });
    }
    if (current.spriteEditor?.source) {
      const spriteMeta = exportSpriteMeta();
      files.push({ path: `sprites/${spriteMeta.fileName}`, data: spriteMeta.meta });
    }
    files.sort((left, right) => left.path.localeCompare(right.path));
    const manifest = {
      animations: files.filter((file) => file.path.startsWith('animations/')).length,
      particles: files.filter((file) => file.path.startsWith('particles/')).length,
      scenes: files.filter((file) => file.path.startsWith('scenes/')).length,
      sprites: files.filter((file) => file.path.startsWith('sprites/')).length
    };
    return {
      fileName: 'omnicore_authoring_bundle.json',
      version: 1,
      generatedAt,
      manifest,
      health: buildAuthoringHealthReport({ ...options, checkedAt: generatedAt, open: false }),
      files
    };
  }

  function exportLightweightDeploymentBundle(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const authoring = exportAuthoringBundle({ ...options, generatedAt });
    const files = [...authoring.files.map((file) => ({ path: file.path, data: cloneState(file.data) }))];
    if (!files.some((file) => file.path.startsWith('scenes/'))) {
      files.push({ path: `scenes/${sceneFileStem(current.scene)}.scene.json`, data: cloneState(normalizeScene(current.scene)) });
    }
    const sceneFiles = files
      .filter((file) => file.path.startsWith('scenes/'))
      .sort((left, right) => left.path.localeCompare(right.path));
    const coCreationFiles = appliedCoCreationPlans().map(({ entityId, plan }) => ({
      path: `plans/25d-cocreation/${entityId}.json`,
      data: cloneState(plan)
    }));
    const assetPaths = deploymentAssetPaths();
    const targets = enabledBuildTargets();
    const manifestData = {
      format: 'OmniCore.DeployLiteManifest',
      version: 1,
      profile: '2.5d-editor-lite',
      generatedAt,
      entryScene: sceneFiles[0]?.path || null,
      scenes: sceneFiles.map((file) => file.path),
      assets: assetPaths,
      targets,
      coCreationPlans: coCreationFiles.map((file) => file.path)
    };
    const deployFiles = [
      ...files,
      ...coCreationFiles,
      { path: 'manifests/deploy-lite.json', data: manifestData }
    ].sort((left, right) => left.path.localeCompare(right.path));
    return {
      format: 'OmniCore.LightweightDeploymentBundle',
      version: 1,
      generatedAt,
      manifest: {
        profile: manifestData.profile,
        targets,
        entryScene: manifestData.entryScene,
        scenes: manifestData.scenes.length,
        assets: manifestData.assets.length,
        coCreationPlans: manifestData.coCreationPlans.length
      },
      files: deployFiles
    };
  }

  function create25DProductionReadinessReport(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const deployment = options.deploymentBundle || exportLightweightDeploymentBundle({ ...options, generatedAt });
    const readiness = collect25DProductionReadiness({ deployment });
    const { blockers, warnings } = readiness;
    const score = Math.max(0, 100 - blockers.length * 25 - warnings.length * 5);
    return {
      format: 'OmniCore.Editor25DProductionReadiness',
      version: 1,
      generatedAt,
      ready: blockers.length === 0,
      score,
      blockers,
      warnings,
      evidence: readiness.evidence,
      nextActions: next25DProductionActions(blockers, warnings)
    };
  }

  function exportProductionDeploymentBundle(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const deployment = exportLightweightDeploymentBundle({ ...options, generatedAt });
    const readiness = create25DProductionReadinessReport({ ...options, generatedAt, deploymentBundle: deployment });
    const visualEvidence = create25DVisualEvidence({ ...options, generatedAt });
    const files = [
      ...deployment.files.map((file) => ({ path: file.path, data: cloneState(file.data) })),
      { path: 'reports/25d-production-readiness.json', data: cloneState(readiness) },
      { path: 'reports/25d-visual-evidence.json', data: cloneState(visualEvidence) }
    ].sort((left, right) => left.path.localeCompare(right.path));
    return {
      format: 'OmniCore.ProductionDeploymentBundle',
      version: 1,
      generatedAt,
      productionReady: readiness.ready,
      readiness,
      visualEvidence,
      deployment,
      files
    };
  }

  function create25DVisualEvidence(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const coCreatedEntities = (current.scene?.entities || [])
      .filter((entity) => entity?.coCreated || entity?.coCreationPlan)
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    const layers = [];
    for (const entity of coCreatedEntities) {
      layers.push({
        type: 'entity',
        entityId: entity.id,
        label: entity.name || entity.id,
        bounds: entityBounds(entity),
        placement: cloneState(entity.placement || {})
      });
      for (const occlusion of entity.occlusion || entity.coCreationPlan?.occlusion || []) {
        layers.push({
          type: 'occlusion',
          entityId: entity.id,
          baselineY: Number(occlusion.baselineY ?? entity.placement?.baselineY ?? entity.y ?? 0),
          anchor: entity.placement?.anchor || entity.coCreationPlan?.intent?.placement?.anchor || null
        });
      }
      const shadow = entity.fakeShadow || entity.coCreationPlan?.shadows?.[0] || null;
      if (shadow) {
        layers.push({
          type: 'shadow',
          entityId: entity.id,
          shadow: cloneState(shadow)
        });
      }
      const eventGraph = entity.eventGraph || entity.coCreationPlan?.eventGraph || null;
      for (const node of eventGraph?.nodes || []) {
        layers.push({
          type: 'event',
          entityId: entity.id,
          eventId: node.id || node.label || 'event',
          label: node.label || node.id || 'event',
          action: cloneState(node.data || {})
        });
      }
    }
    const summary = {
      coCreatedEntities: coCreatedEntities.length,
      occlusionLayers: layers.filter((layer) => layer.type === 'occlusion').length,
      shadowLayers: layers.filter((layer) => layer.type === 'shadow').length,
      eventLayers: layers.filter((layer) => layer.type === 'event').length
    };
    return {
      format: 'OmniCore.Editor25DVisualEvidence',
      version: 1,
      generatedAt,
      ready: summary.coCreatedEntities > 0
        && summary.occlusionLayers > 0
        && summary.shadowLayers > 0
        && summary.eventLayers > 0,
      scene: current.scene?.name || 'untitled',
      summary,
      layers,
      preview: {
        mode: '2.5d-editor-proof',
        screenshotHint: `${sceneFileStem(current.scene)}-25d-production-preview.png`,
        viewport: {
          width: Number(current.scene?.width || 960),
          height: Number(current.scene?.height || 540)
        }
      }
    };
  }

  function collect25DProductionReadiness({ deployment }) {
    const blockers = [];
    const warnings = [];
    const appliedPlans = appliedCoCreationPlans();
    const targets = enabledBuildTargets();
    const authoring = buildAuthoringHealthReport({ open: false });
    const deploymentManifest = deployment.files.find((file) => file.path === 'manifests/deploy-lite.json')?.data || {};
    const saved = Boolean(lastSavedSnapshot && sceneSignature(lastSavedSnapshot.scene) === sceneSignature(current.scene));
    const hasPendingPlan = Boolean(current.coCreation25D);
    if (hasPendingPlan && appliedPlans.length === 0) {
      blockers.push({
        code: 'cocreation-not-applied',
        severity: 'error',
        message: 'A 2.5D co-creation plan exists but has not been applied to the scene.'
      });
    }
    if (appliedPlans.length > 0 && !saved) {
      blockers.push({
        code: 'scene-not-saved',
        severity: 'error',
        message: 'Applied 2.5D scene changes must be saved before production export.'
      });
    }
    if (!targets.length) {
      blockers.push({
        code: 'build-target-missing',
        severity: 'error',
        message: 'At least one lightweight deployment target must be enabled.'
      });
    }
    if (!deploymentManifest.entryScene || !deploymentManifest.scenes?.length) {
      blockers.push({
        code: 'deploy-manifest-incomplete',
        severity: 'error',
        message: 'The deploy-lite manifest must include an entry scene.'
      });
    }
    for (const issue of authoring.issues || []) {
      if (issue.severity === 'critical' || issue.severity === 'error') {
        blockers.push({
          code: `authoring-${issue.code}`,
          severity: issue.severity,
          message: issue.message
        });
      } else {
        warnings.push({
          code: `authoring-${issue.code}`,
          severity: issue.severity || 'warning',
          message: issue.message
        });
      }
    }
    if (appliedPlans.length === 0 && !hasPendingPlan) {
      warnings.push({
        code: 'no-25d-cocreation',
        severity: 'warning',
        message: 'No applied 2.5D co-creation plan is present in the current scene.'
      });
    }
    return {
      blockers,
      warnings,
      evidence: {
        scene: current.scene?.name || 'untitled',
        entities: (current.scene?.entities || []).length,
        appliedCoCreationPlans: appliedPlans.length,
        saved,
        deploymentBundle: deployment.manifest?.profile || null,
        entryScene: deployment.manifest?.entryScene || null,
        targets,
        files: deployment.files.length,
        authoringIssues: authoring.issues.length
      }
    };
  }

  function appliedCoCreationPlans() {
    return (current.scene?.entities || [])
      .filter((entity) => entity?.coCreated && entity.coCreationPlan)
      .map((entity) => ({
        entityId: entity.id,
        plan: entity.coCreationPlan
      }))
      .sort((left, right) => left.entityId.localeCompare(right.entityId));
  }

  function deploymentAssetPaths() {
    const paths = new Set(getWorkflowAssets().map((asset) => asset.path).filter(Boolean));
    for (const reference of collectSceneAssetReferences()) {
      if (reference.path) paths.add(reference.path);
    }
    for (const { plan } of appliedCoCreationPlans()) {
      for (const asset of plan.assets || []) {
        if (asset.reuseAssetId) paths.add(slash(asset.reuseAssetId));
      }
    }
    return [...paths].sort((left, right) => left.localeCompare(right));
  }

  function createAssetWorkflowIndex() {
    const assets = getWorkflowAssets();
    const assetPaths = new Set(assets.map((asset) => asset.path).filter(Boolean));
    const byType = {};
    for (const asset of assets) byType[asset.type] = (byType[asset.type] || 0) + 1;
    const sceneReferences = collectSceneAssetReferences().map((reference) => ({
      ...reference,
      resolved: assetPaths.has(reference.path)
    }));
    const referencedPaths = new Set(sceneReferences.map((reference) => reference.path));
    const orphanAssets = assets
      .filter((asset) => asset.path && asset.type !== 'scene' && !referencedPaths.has(asset.path))
      .map((asset) => asset.path)
      .sort((left, right) => left.localeCompare(right));
    return {
      format: 'OmniCore.AssetWorkflowIndex',
      generatedAt: new Date().toISOString(),
      totalAssets: assets.length,
      byType,
      assets: assets.map((asset) => cloneState(asset)),
      sceneReferences,
      unresolvedReferences: sceneReferences.filter((reference) => !reference.resolved),
      orphanAssets
    };
  }

  function createCollaborationHandoff(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const readiness = buildAuthoringHealthReport({ checkedAt: generatedAt, open: false, warningMs: options.warningMs ?? 12 });
    const assetWorkflow = createAssetWorkflowIndex();
    const buildTargets = enabledBuildTargets();
    return {
      format: 'OmniCore.EditorCollaborationHandoff',
      generatedAt,
      author: options.author || null,
      reviewer: options.reviewer || null,
      note: options.note || '',
      workspace: cloneState(current.workspace || {}),
      scene: {
        name: current.scene?.name || 'untitled',
        entityCount: (current.scene?.entities || []).length
      },
      readiness: {
        ready: readiness.ok && assetWorkflow.unresolvedReferences.length === 0,
        issues: readiness.issues,
        unresolvedReferences: assetWorkflow.unresolvedReferences
      },
      files: {
        projectFiles: Object.keys(normalizeProjectFilesState(current.projectFiles)).length,
        assets: assetWorkflow.totalAssets,
        scenes: countSceneAssets(assetWorkflow.assets),
        sourceFiles: (current.workspace?.sourceFiles || []).length
      },
      buildTargets
    };
  }

  function createProjectGovernanceReport() {
    const assetWorkflow = createAssetWorkflowIndex();
    const buildTargets = enabledBuildTargets();
    const projectFiles = Object.keys(normalizeProjectFilesState(current.projectFiles));
    const checklist = [
      checkItem('workspace-opened', Boolean(current.workspace?.root || current.workspace?.name), 'Open or scan a project workspace.'),
      checkItem('asset-workflow-index', assetWorkflow.totalAssets > 0, 'Index project assets and scene references.'),
      checkItem('collaboration-handoff', true, 'Export collaboration handoff before review.'),
      checkItem('project-files-present', projectFiles.length > 0, 'Track project files in the editor workspace.'),
      checkItem('platform-targets', buildTargets.includes('web') && buildTargets.includes('wechat'), 'Keep Web and WeChat targets configured.'),
      checkItem('authoring-health', assetWorkflow.unresolvedReferences.length === 0, 'Resolve missing scene asset references.')
    ];
    return {
      format: 'OmniCore.EditorGovernanceReport',
      generatedAt: new Date().toISOString(),
      workspace: cloneState(current.workspace || {}),
      coverage: {
        projectFiles: projectFiles.length,
        assets: assetWorkflow.totalAssets,
        sceneReferences: assetWorkflow.sceneReferences.length,
        unresolvedReferences: assetWorkflow.unresolvedReferences.length,
        buildTargets
      },
      checklist,
      ready: checklist.every((item) => item.status === 'covered')
    };
  }

  function exportMatureEditorBundle(options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    return {
      format: 'OmniCore.MatureEditorBundle',
      version: 1,
      generatedAt,
      authoring: exportAuthoringBundle({ ...options, generatedAt }),
      assetWorkflow: createAssetWorkflowIndex(),
      collaboration: createCollaborationHandoff({ ...options, generatedAt }),
      governance: createProjectGovernanceReport()
    };
  }

  function getWorkflowAssets() {
    const candidates = [
      ...(Array.isArray(current.assets) ? current.assets : []),
      ...(Array.isArray(current.workspace?.assets) ? current.workspace.assets : []),
      ...(Array.isArray(current.workspace?.scenes) ? current.workspace.scenes : [])
    ].map(normalizeAssetEntry);
    const byPath = new Map();
    for (const asset of candidates) {
      if (!asset.path || byPath.has(asset.path)) continue;
      byPath.set(asset.path, asset);
    }
    return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  }

  function collectSceneAssetReferences() {
    const references = [];
    for (const entity of current.scene?.entities || []) {
      for (const [field, value] of Object.entries(entity)) {
        if (!isAssetReferenceField(field, value)) continue;
        references.push({
          entityId: entity.id || null,
          entityName: entity.name || null,
          field,
          path: slash(value)
        });
      }
      for (const [field, value] of Object.entries(entity.material || {})) {
        if (!isAssetReferenceField(field, value)) continue;
        references.push({
          entityId: entity.id || null,
          entityName: entity.name || null,
          field: `material.${field}`,
          path: slash(value)
        });
      }
    }
    return references.sort((left, right) => `${left.path}:${left.entityId}`.localeCompare(`${right.path}:${right.entityId}`));
  }

  function enabledBuildTargets() {
    const settings = normalizeBuildSettingsState(current.buildSettings);
    return Object.entries(settings.targets || {})
      .filter(([, config]) => config.enabled)
      .map(([target]) => target)
      .sort((left, right) => left.localeCompare(right));
  }

  function countSceneAssets(assets) {
    return assets.filter((asset) => asset.type === 'scene').length || (current.workspace?.scenes || []).length || (current.sceneTabs || []).length;
  }

  function checkItem(id, ok, action) {
    return {
      id,
      status: ok ? 'covered' : 'missing',
      action
    };
  }

  function getProfilerHotspots(options = {}) {
    const warningMs = Number(options.warningMs ?? 10);
    const criticalMs = Number(options.criticalMs ?? 16);
    return (current.profilerFrame?.sections || [])
      .map((section) => ({ name: section.name || 'unknown', duration: Number(section.duration || 0) }))
      .filter((section) => section.duration >= warningMs)
      .sort((left, right) => right.duration - left.duration)
      .map((section) => ({
        ...section,
        severity: section.duration >= criticalMs ? 'critical' : 'warning',
        suggestion: profilerSuggestion(section.name, section.duration)
      }));
  }

  function buildAuthoringHealthReport(options = {}) {
    const issues = [];
    const assets = new Set((current.assets || []).map((asset) => slash(typeof asset === 'string' ? asset : asset.path || asset.url || asset.name || '')));
    const addIssue = (code, message, detail = {}) => {
      issues.push({ code, message, severity: detail.severity || 'error', ...detail });
    };

    const particleConfig = current.particleEditor?.config ? normalizeParticleConfig(current.particleEditor.config) : null;
    if (particleConfig) {
      if (!(particleConfig.lifetime > 0)) addIssue('particle-lifetime-invalid', 'Particle lifetime must be greater than 0.', { field: 'lifetime' });
      if (particleConfig.emissionRate < 0 || particleConfig.emissionRate > 1000) addIssue('particle-emission-rate-invalid', 'Particle emission rate must stay between 0 and 1000.', { field: 'emissionRate' });
      for (const [curveName, points] of Object.entries(particleConfig.curves || {})) {
        for (let index = 1; index < points.length; index += 1) {
          if (points[index].t < points[index - 1].t) {
            addIssue('particle-curve-order-invalid', `Particle curve ${curveName} must be sorted by t.`, { field: `curves.${curveName}` });
            break;
          }
        }
      }
      for (const point of particleConfig.gradient || []) {
        if (!isHexColor(point.color)) addIssue('particle-gradient-color-invalid', `Particle gradient color is invalid: ${point.color}`, { field: 'gradient' });
      }
    }

    const spriteEditor = current.spriteEditor || {};
    if (spriteEditor.source) {
      if (!assets.has(slash(spriteEditor.source))) addIssue('sprite-source-missing', `Sprite source is missing: ${spriteEditor.source}`, { path: spriteEditor.source });
      const nineSlice = normalizeNineSlice(spriteEditor.nineSlice || {});
      if (nineSlice.left < 0 || nineSlice.top < 0 || nineSlice.right < 0 || nineSlice.bottom < 0 || (nineSlice.right > 0 && nineSlice.left > nineSlice.right) || (nineSlice.bottom > 0 && nineSlice.top > nineSlice.bottom)) {
        addIssue('sprite-nine-slice-invalid', 'Sprite nine-slice guides are inverted or negative.', { field: 'nineSlice' });
      }
    }

    for (const entity of current.scene.entities || []) {
      if (!entity.material) continue;
      const alphaClip = Number(entity.material.alphaClip ?? 0);
      if (alphaClip < 0 || alphaClip > 1) addIssue('sprite-alpha-clip-invalid', 'Sprite alpha clip must be between 0 and 1.', { entityId: entity.id, field: 'material.alphaClip' });
      if (entity.material.colorTint && !isHexColor(entity.material.colorTint)) addIssue('sprite-color-tint-invalid', `Sprite color tint is invalid: ${entity.material.colorTint}`, { entityId: entity.id, field: 'material.colorTint' });
      if (entity.material.normalMap && !assets.has(slash(entity.material.normalMap))) addIssue('sprite-normal-map-missing', `Sprite normal map is missing: ${entity.material.normalMap}`, { entityId: entity.id, path: entity.material.normalMap });
    }

    for (const [clipId, clip] of Object.entries(current.animations || {})) {
      const duration = Number(clip.duration || 0);
      for (const event of clip.events || []) {
        const frame = Number(event.frame || 0);
        if (!event.name) addIssue('animation-event-name-missing', `Animation event name is missing in ${clipId}.`, { clipId, frame });
        if (frame < 0 || frame > duration) addIssue('animation-event-out-of-range', `Animation event ${event.name || '(unnamed)'} is outside ${clipId} duration.`, { clipId, frame, duration });
      }
    }

    const prefabIds = new Set((current.prefabs || []).map((prefab) => prefab.id || prefab.name));
    for (const prefab of current.prefabs || []) {
      if (prefab.extends && !prefabIds.has(prefab.extends)) addIssue('prefab-base-missing', `Prefab base is missing: ${prefab.extends}`, { prefabId: prefab.id || prefab.name });
    }

    const hotspots = getProfilerHotspots({ warningMs: options.profilerWarningMs ?? options.warningMs, criticalMs: options.profilerCriticalMs ?? options.criticalMs });
    for (const hotspot of hotspots) addIssue(`profiler-hotspot-${hotspot.severity}`, hotspot.suggestion, { severity: hotspot.severity, subsystem: hotspot.name, duration: hotspot.duration });

    return {
      open: Boolean(options.open),
      ok: issues.length === 0,
      checkedAt: options.checkedAt || new Date().toISOString(),
      counts: {
        animations: Object.keys(current.animations || {}).length,
        particles: particleConfig ? 1 : 0,
        sprites: spriteEditor.source ? 1 : 0,
        scenes: (current.sceneTabs || []).length,
        prefabs: (current.prefabs || []).length
      },
      issues,
      hotspots
    };
  }

  function isHexColor(value) {
    return /^#[0-9a-f]{6}$/iu.test(String(value || ''));
  }

  function profilerSuggestion(name, duration) {
    const label = String(name || 'unknown');
    if (/collision/iu.test(label)) return `Collision is taking ${duration}ms; inspect collider density, broadphase filters, and 2.5D projection overlap.`;
    if (/render|renderer|draw/iu.test(label)) return `${label} is taking ${duration}ms; inspect batching, material state changes, and draw-call count.`;
    if (/update|script|logic/iu.test(label)) return `${label} is taking ${duration}ms; inspect per-frame scripts and avoid allocations in update loops.`;
    return `${label} is taking ${duration}ms; inspect this subsystem in the profiler flame graph.`;
  }

  function openEntityScript(entityOrId, symbol = null, options = {}) {
    const entity = typeof entityOrId === 'string'
      ? current.scene.entities.find((item) => item.id === entityOrId)
      : entityOrId;
    const binding = resolveScriptBinding(entity, symbol, options);
    if (!binding) return null;
    const payload = {
      entityId: entity.id,
      entityName: entity.name || entity.id,
      ...binding
    };
    emit('editor:open-code', payload);
    return payload;
  }

  function patchEntity(id, patch) {
    const entities = current.scene.entities.map((entity) => (
      entity.id === id ? { ...entity, ...patch } : entity
    ));
    current = {
      ...current,
      scene: { ...current.scene, entities }
    };
    emit('editor:update-entity', { id, patch, commandId: createCommandId('entity') });
    pushHistory(current, `Patch ${id}`);
    update(current);
    return entities.find((entity) => entity.id === id) || null;
  }

  function selectEntity(id, { append = false, ids = null } = {}) {
    const nextIds = ids
      ? [...new Set(ids.filter(Boolean).map(String))]
      : resolveNextSelection(id, append, current);
    current = {
      ...current,
      selectedEntityId: nextIds.at(-1) || null,
      selectedEntityIds: nextIds
    };
    emit('editor:select-entity', { id: current.selectedEntityId, ids: nextIds });
    emit('editor:highlight-entity', { id: current.selectedEntityId });
    update(current);
  }

  function setGridSnap(options = {}) {
    current = {
      ...current,
      gridSnap: {
        enabled: Boolean(options.enabled),
        size: Math.max(1, Number(options.size || current.gridSnap?.size || 16))
      }
    };
    emit('editor:grid-snap', current.gridSnap);
    update(current);
    return current.gridSnap;
  }

  function openCommandPalette() {
    current = { ...current, commandPaletteOpen: true };
    update(current);
    return current.commandPaletteOpen;
  }

  function closeCommandPalette() {
    current = { ...current, commandPaletteOpen: false };
    update(current);
    return current.commandPaletteOpen;
  }

  function runCommand(commandId) {
    const normalized = String(commandId || '').trim().toLowerCase();
    const command = normalized === 'validate' || normalized === 'scene validation'
      ? 'scene:validate'
      : normalized;
    if (command === 'scene:validate') return validateScene();
    if (command === 'overlay:collision-depth') return toggleSceneOverlays({ collision: true, depth: true });
    return {
      ok: false,
      command,
      error: 'unknown-command'
    };
  }

  function validateScene() {
    const issues = [];
    const ids = new Map();
    for (const entity of current.scene.entities) {
      const id = String(entity.id || '');
      if (ids.has(id)) {
        issues.push({
          code: 'duplicate-entity-id',
          severity: 'error',
          entityId: id,
          message: `Duplicate entity id: ${id}`
        });
      }
      ids.set(id, true);
      if ((entity.type === 'sprite' || entity.sprite) && !entity.texture && !entity.sprite) {
        issues.push({
          code: 'missing-texture',
          severity: 'warning',
          entityId: id,
          message: `Sprite entity ${id} has no texture.`
        });
      }
      if (Number(entity.x) < 0 || Number(entity.y) < 0) {
        issues.push({
          code: 'negative-position',
          severity: 'warning',
          entityId: id,
          message: `Entity ${id} is outside the positive scene plane.`
        });
      }
    }
    const result = {
      ok: issues.length === 0,
      checkedAt: new Date().toISOString(),
      issues
    };
    current = {
      ...current,
      commandPaletteOpen: false,
      sceneValidation: result
    };
    emit('editor:scene-validation', result);
    update(current);
    return result;
  }

  function locateSceneIssue(issue = {}) {
    if (!issue.entityId) return null;
    current = { ...current, sceneIssueTargetId: issue.entityId };
    selectEntity(issue.entityId);
    return issue;
  }

  function captureSceneBaseline(name = 'baseline') {
    const snapshot = cloneState(current.scene);
    sceneBaselines.set(name, snapshot);
    emit('editor:scene-baseline', { name, entityCount: snapshot.entities.length });
    return snapshot;
  }

  function getSceneDiff(name = 'baseline') {
    const baseline = sceneBaselines.get(name) || { entities: [] };
    return diffScenes(baseline, current.scene);
  }

  function createPrefabSnapshot(entityId = current.selectedEntityId, meta = {}) {
    const entity = current.scene.entities.find((item) => item.id === entityId);
    if (!entity) return null;
    const previous = current.prefabHistory?.[entityId] || [];
    const snapshot = {
      id: `${entityId}@${previous.length + 1}`,
      entityId,
      version: previous.length + 1,
      createdAt: new Date().toISOString(),
      note: meta.note || '',
      entity: cloneState(entity)
    };
    current = {
      ...current,
      prefabHistory: {
        ...(current.prefabHistory || {}),
        [entityId]: [...previous, snapshot]
      }
    };
    emit('editor:prefab-snapshot', { entityId, version: snapshot.version });
    update(current);
    return snapshot;
  }

  function getPrefabHistory(entityId = current.selectedEntityId) {
    return cloneState(current.prefabHistory?.[entityId] || []);
  }

  function toggleSceneOverlays(overlays = {}) {
    current = {
      ...current,
      sceneOverlays: {
        ...(current.sceneOverlays || {}),
        ...overlays
      }
    };
    emit('editor:scene-overlays', current.sceneOverlays);
    update(current);
    return current.sceneOverlays;
  }

  function copySelection() {
    const ids = selectedIds(current);
    clipboard = current.scene.entities
      .filter((entity) => ids.includes(entity.id))
      .map((entity) => cloneState(entity));
    emit('editor:copy-entities', { ids, count: clipboard.length });
    return clipboard.map((entity) => cloneState(entity));
  }

  function pasteSelection() {
    if (!clipboard.length) return [];
    const existingIds = new Set(current.scene.entities.map((entity) => entity.id));
    const copies = clipboard.map((entity) => {
      const id = uniqueEntityId(`${entity.id || entity.name || 'entity'}-copy-${copySerial}`, existingIds);
      copySerial += 1;
      existingIds.add(id);
      return {
        ...cloneState(entity),
        id,
        name: `${entity.name || entity.id || 'Entity'} Copy`,
        x: Number(entity.x || 0) + 16,
        y: Number(entity.y || 0) + 16
      };
    });
    current = {
      ...current,
      scene: {
        ...current.scene,
        entities: [...current.scene.entities, ...copies]
      },
      selectedEntityId: copies.at(-1)?.id || current.selectedEntityId,
      selectedEntityIds: copies.map((entity) => entity.id)
    };
    emit('editor:paste-entities', { ids: current.selectedEntityIds, count: copies.length });
    pushHistory(current, `Paste ${copies.length} entity${copies.length === 1 ? '' : 's'}`);
    update(current);
    return copies;
  }

  function deleteSelection() {
    const ids = selectedIds(current);
    if (!ids.length) return [];
    const idSet = new Set(ids);
    const removed = current.scene.entities.filter((entity) => idSet.has(entity.id));
    if (!removed.length) return [];
    current = {
      ...current,
      scene: {
        ...current.scene,
        entities: current.scene.entities.filter((entity) => !idSet.has(entity.id))
      },
      selectedEntityId: null,
      selectedEntityIds: []
    };
    emit('editor:delete-entities', { ids, count: removed.length });
    pushHistory(current, `Delete ${removed.length} entity${removed.length === 1 ? '' : 's'}`);
    update(current);
    return removed;
  }

  function setGizmoMode(mode) {
    current = { ...current, gizmoMode: mode };
    emit('editor:gizmo-mode', { mode });
    update(current);
  }

  function paintTile(index) {
    const tilemap = cloneTilemap(current.tilemap);
    const activeLayer = findActiveTileLayer(tilemap);
    if (current.collisionMode) {
      addCollision(tilemap, index);
    } else {
      activeLayer.data[index] = current.selectedTile;
      if (activeLayer.id === tilemap.layers[0]?.id) tilemap.data[index] = current.selectedTile;
      if (isSolidTile(tilemap, current.selectedTile)) addCollision(tilemap, index);
    }
    current = { ...current, tilemap };
    emit('editor:update-tilemap', { tilemap });
    pushHistory(current, 'Paint tile');
    update(current);
  }

  function selectTilesetTile(tileId) {
    const tilemap = cloneTilemap(current.tilemap);
    const tile = findTilesetTile(tilemap, tileId);
    current = { ...current, selectedTile: Number(tileId) };
    emit('editor:select-tile', { tileId: Number(tileId), crop: tile?.source || null });
    update(current);
    return current.selectedTile;
  }

  function selectTileLayer(layerId) {
    const tilemap = cloneTilemap(current.tilemap);
    if (!tilemap.layers.some((layer) => layer.id === layerId)) return null;
    tilemap.activeLayerId = layerId;
    current = { ...current, tilemap };
    emit('editor:select-tile-layer', { layerId });
    update(current);
    return layerId;
  }

  function applyRuleTiles() {
    const tilemap = cloneTilemap(current.tilemap);
    const activeLayer = findActiveTileLayer(tilemap);
    if (!activeLayer || !tilemap.ruleTiles.length) return tilemap;
    const original = [...activeLayer.data];
    const output = activeLayer.data.map((tileId, index) => {
      const rule = tilemap.ruleTiles.find((candidate) => ruleTileMatches(candidate, tileId, index, original, tilemap));
      return rule ? Number(rule.id) : tileId;
    });
    activeLayer.data = output;
    if (activeLayer.id === tilemap.layers[0]?.id) tilemap.data = [...output];
    current = { ...current, tilemap };
    emit('editor:apply-rule-tiles', { activeLayerId: activeLayer.id, rules: tilemap.ruleTiles.length });
    pushHistory(current, 'Apply rule tiles');
    update(current);
    return tilemap;
  }

  function updateDatabaseRecord(table, id, field, value) {
    const database = cloneDatabase(current.database);
    database.tables[table] = database.tables[table] || {};
    const currentRecord = database.tables[table][id] || { id };
    const patch = { [field]: normalizeDatabaseInput(value, currentRecord[field]) };
    const record = { ...currentRecord, ...patch };
    database.tables[table][id] = record;
    database.lastUpdate = { table, id, record };
    current = { ...current, database };
    emit('editor:update-database-record', { table, id, patch, commandId: createCommandId('db') });
    persistDatabaseConfig(database.tables);
    pushHistory(current, `Update database ${table}.${id}.${field}`);
    update(current);
    return record;
  }

  function persistDatabaseConfig(tables) {
    const payload = {
      path: 'config/data.json',
      tables: cloneState(tables)
    };
    const editorBridge = ownerWindow?.omnicoreEditor;
    if (typeof editorBridge?.saveDatabaseConfig === 'function') {
      editorBridge.saveDatabaseConfig(payload);
    } else {
      emit('editor:save-database-config', payload);
    }
    return payload;
  }

  function generateWithAI(prompt, options = {}) {
    const generationOptions = {
      ...parsePromptSize(prompt),
      ...options
    };
    const generated = AITilemapGenerator.generate(prompt, generationOptions);
    const layer = generated.tilemapJson.layers[0] || {};
    const tilemap = {
      width: generated.tilemapJson.width,
      height: generated.tilemapJson.height,
      tileWidth: generated.tilemapJson.tilewidth,
      tileHeight: generated.tilemapJson.tileheight,
      data: [...(layer.data || [])],
      collisions: []
    };
    const entities = [
      ...(generated.sceneJson.entities || []).map((entity) => ({
        ...entity,
        data: entity.type === 'tilemap' ? [...tilemap.data] : entity.data
      })),
      ...promptEntities(prompt)
    ];
    const existingIds = new Set(current.scene.entities.map((entity) => entity.id));
    const nextEntities = [
      ...current.scene.entities.filter((entity) => !entities.some((next) => next.id === entity.id)),
      ...entities.map((entity, index) => normalizeGeneratedEntity(entity, existingIds, index))
    ];
    current = {
      ...current,
      tilemap,
      scene: {
        ...current.scene,
        entities: nextEntities
      }
    };
    emit('editor:ai-generate-scene', { prompt, tilemap, entities });
    emit('editor:update-tilemap', { tilemap });
    pushHistory(current, 'Generate scene from AI prompt');
    update(current);
    return { prompt, tilemap, entities };
  }

  function instantiatePrefab(prefabId, point) {
    const prefab = current.prefabs.find((item) => item.id === prefabId || item.name === prefabId);
    if (!prefab) return null;
    const snapped = snapPoint(point, current);
    const entity = {
      id: `${prefab.id || prefab.name}-${Date.now().toString(36)}`,
      name: prefab.name || prefab.id || 'Prefab',
      type: prefab.type || 'sprite',
      texture: prefab.texture || null,
      width: prefab.width || 32,
      height: prefab.height || 32,
      x: snapped.x,
      y: snapped.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      prefabId: prefab.id || prefab.name
    };
    current = {
      ...current,
      scene: {
        ...current.scene,
        entities: [...current.scene.entities, entity]
      },
      selectedEntityId: entity.id
    };
    emit('editor:instantiate-prefab', { prefabId: entity.prefabId, entity });
    pushHistory(current, `Instantiate prefab ${entity.prefabId}`);
    update(current);
    return entity;
  }

  function instantiateAsset(assetPath, point) {
    if (!assetPath) return null;
    const snapped = snapPoint(point, current);
    const entity = {
      id: `asset-${Date.now().toString(36)}`,
      name: assetPath.split('/').pop() || 'Asset',
      type: 'sprite',
      texture: assetPath,
      width: 32,
      height: 32,
      x: snapped.x,
      y: snapped.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      prefabId: null
    };
    current = {
      ...current,
      scene: {
        ...current.scene,
        entities: [...current.scene.entities, entity]
      },
      selectedEntityId: entity.id
    };
    emit('editor:instantiate-asset', { assetPath, entity });
    pushHistory(current, `Instantiate asset ${assetPath}`);
    update(current);
    return entity;
  }

  function exportTiledJson() {
    const tilemap = cloneTilemap(current.tilemap);
    const tileLayers = tilemap.layers.map((layer, index) => ({
      id: index + 1,
      name: layer.name,
      type: 'tilelayer',
      visible: layer.visible !== false,
      opacity: layer.opacity ?? 1,
      width: tilemap.width,
      height: tilemap.height,
      data: [...layer.data]
    }));
    return {
      type: 'map',
      version: '1.10',
      tiledversion: '1.10.2',
      orientation: 'orthogonal',
      renderorder: 'right-down',
      width: tilemap.width,
      height: tilemap.height,
      tilewidth: tilemap.tileWidth,
      tileheight: tilemap.tileHeight,
      infinite: false,
      layers: [
        ...tileLayers,
        {
          id: tileLayers.length + 1,
          name: 'collision',
          type: 'objectgroup',
          objects: tilemap.collisions.map((index, objectIndex) => {
            const x = index % tilemap.width;
            const y = Math.floor(index / tilemap.width);
            return {
              id: objectIndex + 1,
              name: `collision-${index}`,
              type: 'collision',
              x: x * tilemap.tileWidth,
              y: y * tilemap.tileHeight,
              width: tilemap.tileWidth,
              height: tilemap.tileHeight
            };
          })
        }
      ],
      tilesets: tilemap.tilesets.map((tileset) => ({
        name: tileset.name,
        image: tileset.image,
        firstgid: tileset.firstgid,
        columns: tileset.columns,
        tilewidth: tileset.tileWidth,
        tileheight: tileset.tileHeight,
        tilecount: tileset.tilecount,
        tiles: tileset.tiles.map((tile) => ({
          id: tile.id,
          solid: Boolean(tile.solid),
          source: tile.source
        }))
      }))
    };
  }

  function exportFlowGraphEventSheet() {
    return {
      format: 'OmniCore.EventSheet',
      version: 1,
      ...createVisualGraph(current.flowGraph).toEventSheet()
    };
  }

  function exportBehaviorTreeJson() {
    return cloneState(current.behaviorTree || flowGraphToBehaviorTree(current.flowGraph));
  }

  function exportUILayoutJson() {
    return cloneState(normalizeUILayoutState(current.uiLayout));
  }

  function exportDataJson() {
    return cloneState(current.database?.tables || {});
  }

  function createRuntimeSyncPayload() {
    return {
      protocol: 'omnicore-editor-runtime-sync/v1',
      generatedAt: new Date().toISOString(),
      scene: cloneState(current.scene),
      eventSheet: exportFlowGraphEventSheet(),
      behaviorTree: exportBehaviorTreeJson(),
      uiLayout: exportUILayoutJson()
    };
  }

  function applyRuntimeSyncPayload(payload = {}) {
    current = createEditorState({
      ...current,
      scene: payload.scene || current.scene,
      behaviorTree: payload.behaviorTree || current.behaviorTree,
      uiLayout: payload.uiLayout || current.uiLayout,
      flowGraph: payload.flowGraph || current.flowGraph
    });
    emit('editor:runtime-sync-applied', { protocol: payload.protocol || null });
    update(current);
    return current;
  }

  function buildAssetDependencyGraph() {
    const nodes = new Map();
    const edges = [];
    const addNode = (id, type) => {
      if (id && !nodes.has(id)) nodes.set(id, { id, type });
    };
    for (const asset of current.assets || []) addNode(asset.path, asset.type || 'asset');
    for (const [file, source] of Object.entries(current.projectFiles || {})) {
      addNode(file, 'file');
      for (const asset of current.assets || []) {
        if (String(source).includes(asset.path)) edges.push({ from: file, to: asset.path, type: 'reference' });
      }
    }
    for (const entity of current.scene?.entities || []) {
      addNode(`entity:${entity.id || entity.name}`, 'entity');
      if (entity.sprite) {
        addNode(entity.sprite, 'asset');
        edges.push({ from: `entity:${entity.id || entity.name}`, to: entity.sprite, type: 'sprite' });
      }
      if (entity.scene) {
        addNode(entity.scene, 'scene');
        edges.push({ from: `entity:${entity.id || entity.name}`, to: entity.scene, type: 'nested-scene' });
      }
    }
    return { nodes: [...nodes.values()], edges };
  }

  function replaceAssetReferences(from, to) {
    const projectFiles = { ...(current.projectFiles || {}) };
    const changedFiles = [];
    for (const [file, source] of Object.entries(projectFiles)) {
      if (!String(source).includes(from)) continue;
      projectFiles[file] = String(source).split(from).join(to);
      changedFiles.push(file);
    }
    const scene = {
      ...current.scene,
      entities: (current.scene?.entities || []).map((entity) => (
        entity.sprite === from ? { ...entity, sprite: to } : entity
      ))
    };
    current = createEditorState({ ...current, projectFiles, scene });
    emit('editor:asset-references-replaced', { from, to, changedFiles });
    update(current);
    return { from, to, changedFiles };
  }

  function runIncrementalCompile(changedFiles = []) {
    const files = [...new Set(changedFiles)];
    const graph = buildAssetDependencyGraph();
    const hotReloadManifest = {
      protocol: 'omnicore-hot-reload/v1',
      changedFiles: files,
      affectedAssets: graph.edges.filter((edge) => files.includes(edge.from)).map((edge) => edge.to),
      eventSheet: exportFlowGraphEventSheet(),
      behaviorTree: exportBehaviorTreeJson()
    };
    emit('editor:incremental-compile', hotReloadManifest);
    return {
      ok: true,
      compiledAt: new Date().toISOString(),
      changedFiles: files,
      hotReloadManifest
    };
  }

  function create25DPreview({ zToYScale = 16, showReferenceLines = true } = {}) {
    const entities = current.scene?.entities || [];
    const mixedNodes = entities
      .filter((entity) => isSpine25DNode(entity) || isDimension25DNode(entity))
      .map((entity) => ({
        id: entity.id,
        kind: isSpine25DNode(entity) ? 'spine' : 'dimension3d',
        x: Number(entity.x || 0),
        y: Number(entity.y || 0),
        z: Number(entity.z || entity.position?.z || 0),
        baselineY: Number(entity.y || 0) + Number(entity.height || entity.bounds?.height || 0)
      }));
    const yToZReferenceLines = showReferenceLines
      ? mixedNodes.map((node) => ({
        id: node.id,
        axis: 'z',
        from: { x: node.x, y: node.baselineY },
        to: { x: node.x, y: node.baselineY - node.z * Number(zToYScale) },
        z: node.z
      }))
      : [];
    const preview = {
      protocol: 'omnicore-editor-25d-preview/v1',
      scene: current.scene?.name || 'untitled',
      zToYScale: Number(zToYScale),
      mixedNodes,
      guides: {
        yToZReferenceLines
      }
    };
    current = createEditorState({ ...current, preview25D: preview });
    return preview;
  }

  function drag25DNode(entityId, position = {}) {
    const entity = findEntity(entityId);
    if (!entity) return null;
    const patch = {
      x: Number(position.x ?? entity.x ?? 0),
      y: Number(position.y ?? entity.y ?? 0),
      z: Number(position.z ?? entity.z ?? entity.position?.z ?? 0)
    };
    current = createEditorState({
      ...current,
      scene: {
        ...current.scene,
        entities: current.scene.entities.map((item) => (
          item.id === entityId
            ? { ...item, ...patch, position: { ...(item.position || {}), ...patch } }
            : item
        ))
      }
    });
    update(current);
    emit('editor:25d-node-drag', { id: entityId, position: patch });
    return { id: entityId, position: patch };
  }

  function generateFakeShadows({ opacity = 0.28, radiusScale = 0.55 } = {}) {
    const shadows = (current.scene?.entities || []).map((entity) => ({
      entityId: entity.id,
      type: 'ellipse',
      x: Number(entity.x || 0) + Number(entity.width || entity.bounds?.width || 32) / 2,
      y: Number(entity.y || 0) + Number(entity.height || entity.bounds?.height || 32),
      radiusX: Number(entity.width || entity.bounds?.width || 32) * Number(radiusScale),
      radiusY: Math.max(6, Number(entity.height || entity.bounds?.depth || 32) * 0.18),
      opacity: Math.max(0, Math.min(1, Number(opacity)))
    }));
    current = createEditorState({
      ...current,
      scene: {
        ...current.scene,
        entities: current.scene.entities.map((entity) => ({
          ...entity,
          fakeShadow: shadows.find((shadow) => shadow.entityId === entity.id) || null
        }))
      }
    });
    update(current);
    emit('editor:25d-fake-shadows', { shadows });
    return shadows;
  }

  function plan25DCoCreation({
    prompt = '',
    scene = current.scene,
    terrain = current.tilemap,
    availableAssets = current.assets
  } = {}) {
    const plan = new EditorCoCreator25D().plan({ prompt, scene, terrain, availableAssets });
    current = createEditorState({ ...current, coCreation25D: plan });
    update(current);
    emit('editor:25d-cocreation-plan', { plan });
    return plan;
  }

  function apply25DCoCreationPlan(plan = current.coCreation25D) {
    if (!plan || typeof plan !== 'object') return null;
    const entity = create25DCoCreationEntity(plan);
    const entities = upsertEntity(current.scene.entities || [], entity);
    const scene = {
      ...current.scene,
      entities
    };
    current = createEditorState({
      ...current,
      scene,
      sceneTabs: updateActiveSceneTab(scene),
      selectedEntityId: entity.id,
      selectedEntityIds: [entity.id],
      coCreation25D: plan
    });
    emit('editor:25d-cocreation-apply', { entity, plan });
    pushHistory(current, `Apply 2.5D co-creation ${entity.id}`);
    update(current);
    return {
      protocol: 'omnicore-editor-25d-cocreation-apply/v1',
      entity: cloneState(entity),
      scene: cloneState(scene)
    };
  }

  function previewLivingWorld25D({
    npcs = current.scene?.entities || [],
    locations = current.scene?.locations || [],
    weather = current.scene?.weather || null
  } = {}) {
    const decisions = new SocialAwareness25D().evaluate({ npcs, locations, weather });
    const preview = {
      protocol: 'omnicore-editor-25d-living-world-preview/v1',
      decisions
    };
    current = createEditorState({ ...current, livingWorldPreview25D: preview });
    update(current);
    emit('editor:25d-living-world-preview', preview);
    return preview;
  }

  function previewWorldMemory25D({ events = [], scene = current.scene, npcId = null } = {}) {
    const memory = new WorldMemory25D();
    events.forEach((event) => memory.record(event));
    const preview = {
      protocol: 'omnicore-editor-25d-world-memory-preview/v1',
      snapshot: memory.snapshot(),
      patches: memory.resolveScenePatches(scene),
      dialogue: npcId ? memory.resolveDialogue(npcId) : null
    };
    current = createEditorState({ ...current, worldMemoryPreview25D: preview });
    update(current);
    emit('editor:25d-world-memory-preview', preview);
    return preview;
  }

  function recordDebugEvent(event = {}) {
    debugTimeline = {
      ...debugTimeline,
      events: [...debugTimeline.events, { ...event, at: Number(event.at ?? Date.now()) }]
    };
    return debugTimeline;
  }

  function exportDebugTimeline({ now = Date.now(), windowMs = 10000 } = {}) {
    const minTime = now - windowMs;
    const frames = (Array.isArray(current.profilerHistory) ? current.profilerHistory : []).filter(Boolean);
    const recentFrames = frames.filter((frame) => Number(frame.at || frame.frameStartedAt || now) >= minTime);
    const latest = recentFrames.at(-1) || current.profilerFrame || null;
    const sections = latest?.sections || [];
    return {
      windowMs,
      events: (debugTimeline.events || []).filter((event) => Number(event.at || 0) >= minTime),
      frames: recentFrames,
      profiler: {
        cpuMs: Number(latest?.cpuMs || latest?.totalMs || 0),
        gpuMs: Number(latest?.gpuMs || 0),
        hotspots: [...sections].sort((left, right) => Number(right.duration || 0) - Number(left.duration || 0))
      }
    };
  }

  function exportAnimationStateMachine(machine = {}) {
    const output = {
      format: 'OmniCore.AnimationStateMachine',
      version: 1,
      id: machine.id || 'animation-state-machine',
      states: Array.isArray(machine.states) ? machine.states.map((machineState) => ({ ...machineState })) : [],
      transitions: Array.isArray(machine.transitions) ? machine.transitions.map((transition) => ({ ...transition })) : []
    };
    current = {
      ...current,
      animationStateMachines: {
        ...(current.animationStateMachines || {}),
        [output.id]: output
      }
    };
    return output;
  }

  function instantiateNestedScene(scenePath, transform = {}) {
    const entity = {
      id: transform.id || `nested-${Date.now()}`,
      type: 'NestedScene',
      scenePath,
      scene: scenePath,
      x: Number(transform.x || 0),
      y: Number(transform.y || 0)
    };
    current = createEditorState({
      ...current,
      scene: {
        ...current.scene,
        entities: [...(current.scene?.entities || []), entity]
      }
    });
    emit('editor:nested-scene-instantiated', entity);
    pushHistory(current, `Instantiate nested scene ${scenePath}`);
    update(current);
    return entity;
  }

  function addFlowNode(type) {
    const nextGraph = normalizeFlowGraph(current.flowGraph);
    const id = `${type}-${nextGraph.nodes.length + 1}`;
    const presets = {
      event: { label: 'Event', data: { when: { onStart: true } } },
      condition: { label: 'Condition', data: { op: 'equals', left: 'state.flag', right: true } },
      action: { label: 'Action', data: { op: 'set', target: 'state.flag', value: true } }
    };
    nextGraph.nodes.push({
      id,
      type,
      label: presets[type]?.label || type,
      x: 24 + nextGraph.nodes.length * 144,
      y: 24,
      data: presets[type]?.data || {}
    });
    current = { ...current, flowGraph: nextGraph };
    emit('editor:flow-graph-update', current.flowGraph);
    pushHistory(current, 'Update flow graph');
    update(current);
    return current.flowGraph;
  }

  function addFlowEdge(from, to) {
    if (!from || !to || from === to) return current.flowGraph;
    const nextGraph = normalizeFlowGraph(current.flowGraph);
    const nodeIds = new Set(nextGraph.nodes.map((node) => node.id));
    if (!nodeIds.has(from) || !nodeIds.has(to)) return current.flowGraph;
    if (!nextGraph.edges.some((edge) => edge.from === from && edge.to === to)) {
      nextGraph.edges.push({ from, to });
    }
    current = { ...current, flowGraph: nextGraph };
    emit('editor:flow-graph-update', current.flowGraph);
    pushHistory(current, 'Connect flow graph nodes');
    update(current);
    return current.flowGraph;
  }

  function exportFlowGraph() {
    const eventSheet = exportFlowGraphEventSheet();
    emit('editor:flow-graph-export', { eventSheet, graph: normalizeFlowGraph(current.flowGraph) });
    return eventSheet;
  }

  function emit(type, payload = {}) {
    const message = createLiveSyncMessage(type, payload);
    if (transport?.send) transport.send(JSON.stringify(message));
    else client?.send?.(type, payload);
    return message;
  }

  function beginDrag(entity, event, options = {}) {
    const ids = selectedIds(current).includes(entity.id) ? selectedIds(current) : [entity.id];
    const startEntities = new Map(current.scene.entities
      .filter((item) => ids.includes(item.id))
      .map((item) => [item.id, cloneState(item)]));
    dragSession = {
      ids,
      anchorId: entity.id,
      axis: options.axis || null,
      source: options.source || 'node',
      pointer: pointerFromEvent(event),
      startEntities,
      changed: false
    };
    current = {
      ...current,
      selectedEntityId: entity.id,
      selectedEntityIds: ids,
      simulation: { active: true, physics: true, logic: true }
    };
    emit('editor:simulate-start', { ids, physics: true, logic: true });
    update(current);
  }

  function applyDrag(event) {
    if (!dragSession) return;
    const pointer = pointerFromEvent(event);
    const snappedPointer = snapEditorPoint(pointer, current);
    const dx = pointer.x - dragSession.pointer.x;
    const dy = pointer.y - dragSession.pointer.y;
    const scale = Math.max(0.1, pointer.x / 100);
    const entities = current.scene.entities.map((entity) => {
      const start = dragSession.startEntities.get(entity.id);
      if (!start) return entity;
      if (dragSession.axis) return applyGizmoAxisDrag(entity, start, snappedPointer, dx, dy);
      if (current.gizmoMode === 'translate' && dragSession.ids.length === 1) return { ...entity, x: snappedPointer.x, y: snappedPointer.y };
      if (current.gizmoMode === 'translate') {
        const next = {
          x: Number(start.x || 0) + dx,
          y: Number(start.y || 0) + dy
        };
        const snapped = snapEditorPoint(next, current);
        return { ...entity, x: snapped.x, y: snapped.y };
      }
      if (current.gizmoMode === 'rotate') return { ...entity, rotation: pointer.x / 100 };
      if (current.gizmoMode === 'scale') return { ...entity, scaleX: scale, scaleY: scale };
      return entity;
    });
    current = {
      ...current,
      scene: { ...current.scene, entities }
    };
    dragSession.changed = true;
    emit('editor:simulate-step', { ids: dragSession.ids, patch: { x: snappedPointer.x, y: snappedPointer.y }, physics: true, logic: true });
    update(current);
  }

  function applyGizmoAxisDrag(entity, start, snappedPointer, dx, dy) {
    if (current.gizmoMode === 'translate') {
      if (dragSession.axis === 'x') return { ...entity, x: snappedPointer.x };
      if (dragSession.axis === 'y') return { ...entity, y: snappedPointer.y };
      return { ...entity, z: Number(start.z || 0) + Math.round((dx - dy) / 8) };
    }
    if (current.gizmoMode === 'rotate') {
      const delta = dragSession.axis === 'y' ? dy : dx;
      return { ...entity, rotation: Number(start.rotation || 0) + delta / 100 };
    }
    if (current.gizmoMode === 'scale') {
      const delta = dragSession.axis === 'y' ? dy : dx;
      const scale = Math.max(0.1, Number(start.scale || start.scaleX || 1) + delta / 100);
      if (dragSession.axis === 'x') return { ...entity, scaleX: scale, scale };
      if (dragSession.axis === 'y') return { ...entity, scaleY: scale, scale };
      return { ...entity, scaleX: scale, scaleY: scale, scale };
    }
    return entity;
  }

  function beginMarqueeSelection(event) {
    marqueeSession = {
      start: pointerFromEvent(event),
      current: pointerFromEvent(event)
    };
    renderMarqueeFeedback();
  }

  function finishMarqueeSelection() {
    const rect = normalizeRect(marqueeSession.start, marqueeSession.current);
    const ids = current.scene.entities
      .filter((entity) => rectsIntersect(rect, entityRect(entity)))
      .map((entity) => entity.id);
    selectEntity(ids.at(-1) || null, { ids });
  }

  function renderMarqueeFeedback() {
    const view = root.querySelector('[data-scene-drop-zone="true"]');
    if (!view || !marqueeSession) return;
    clearMarqueeFeedback();
    const rect = normalizeRect(marqueeSession.start, marqueeSession.current);
    const box = document.createElement('div');
    box.className = 'selection-marquee';
    box.dataset.selectionMarquee = 'true';
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    view.appendChild(box);
  }

  function clearMarqueeFeedback() {
    root.querySelector('[data-selection-marquee="true"]')?.remove();
  }

  function onPointerMove(event) {
    if (marqueeSession) {
      marqueeSession.current = pointerFromEvent(event);
      renderMarqueeFeedback();
      return;
    }
    if (!dragSession) return;
    applyDrag(event);
  }

  function onPointerUp() {
    tilePaintSession = false;
    if (marqueeSession) {
      finishMarqueeSelection();
      marqueeSession = null;
      clearMarqueeFeedback();
      return;
    }
    if (dragSession) {
      emit('editor:simulate-stop', { ids: dragSession.ids });
      current = { ...current, simulation: { active: false, physics: false, logic: false } };
      if (dragSession.changed) {
        emitDragEntityUpdates();
        pushHistory(current, `Drag ${dragSession.ids.length} entity${dragSession.ids.length === 1 ? '' : 's'}`);
        showEditorFeedback(`Moved ${dragSession.ids.length} entity${dragSession.ids.length === 1 ? '' : 's'}`, 'success');
      }
      update(current);
    }
    dragSession = null;
  }

  function emitDragEntityUpdates() {
    const fields = ['x', 'y', 'z', 'rotation', 'scale', 'scaleX', 'scaleY'];
    for (const id of dragSession.ids) {
      const before = dragSession.startEntities.get(id) || {};
      const after = current.scene.entities.find((entity) => entity.id === id) || {};
      const patch = {};
      for (const field of fields) {
        if (JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null)) patch[field] = after[field];
      }
      if (Object.keys(patch).length) emit('editor:update-entity', { id, patch, commandId: createCommandId('gizmo') });
    }
  }

  function onKeyDown(event) {
    const key = String(event.key || '').toLowerCase();
    const textEditingTarget = inputFocusManager.isTextInputTarget(event.target);
    const modes = {
      q: 'select',
      w: 'translate',
      e: 'rotate',
      r: 'scale'
    };
    if (!event.ctrlKey && !event.metaKey && modes[key]) {
      if (textEditingTarget || !inputFocusManager.areGizmoShortcutsEnabled()) return;
      event.preventDefault?.();
      setGizmoMode(modes[key]);
      return;
    }
    if (key === 'delete' || key === 'backspace') {
      if (textEditingTarget) return;
      event.preventDefault?.();
      deleteSelection();
      return;
    }
    const command = event.ctrlKey || event.metaKey;
    if (!command) return;
    if (key === 'f' && event.shiftKey) {
      event.preventDefault?.();
      openGlobalSearch();
      return;
    }
    if (key === 'o') {
      event.preventDefault?.();
      openProjectWorkspace();
      return;
    }
    if (key === 's') {
      event.preventDefault?.();
      saveSnapshot('keyboard');
    }
    if (key === 'k') {
      event.preventDefault?.();
      openCommandPalette();
      return;
    }
    if (key === 'z' && event.shiftKey) {
      event.preventDefault?.();
      redo();
    } else if (key === 'z') {
      event.preventDefault?.();
      undo();
    } else if (key === 'c') {
      event.preventDefault?.();
      copySelection();
    } else if (key === 'v') {
      event.preventDefault?.();
      pasteSelection();
    }
  }

  function runToolbarAction(action) {
    if (action === 'open-project') return openProjectWorkspace();
    if (action === 'save') return saveSnapshot('toolbar');
    if (action === 'undo') return undo();
    if (action === 'redo') return redo();
    if (action === 'play') {
      current = {
        ...current,
        simulation: { active: true, physics: true, logic: true },
        playState: { ...current.playState, mode: 'playing' }
      };
      emit('editor:set-play-mode', { mode: 'playing' });
      emit('editor:play', current.simulation);
      return update(current);
    }
    if (action === 'pause') {
      current = {
        ...current,
        simulation: { active: false, physics: false, logic: false },
        playState: { ...current.playState, mode: 'paused' }
      };
      emit('editor:set-play-mode', { mode: 'paused' });
      emit('editor:pause', current.simulation);
      return update(current);
    }
    if (action === 'step') {
      current = {
        ...current,
        simulation: { active: false, physics: true, logic: true },
        playState: {
          ...current.playState,
          mode: 'paused',
          frame: Number(current.playState?.frame || 0) + 1
        }
      };
      emit('editor:set-play-mode', { mode: 'paused' });
      emit('editor:step-frame', { frame: current.playState.frame, physics: true, logic: true });
      return update(current);
    }
    if (action === 'profiler') return openProfiler();
    if (action === 'dock-reset') {
      emit('editor:dock-reset', DEFAULT_DOCK_LAYOUT);
      return setDockLayout(DEFAULT_DOCK_LAYOUT);
    }
    return null;
  }

  function runMenuCommand(command) {
    if (command === 'open-project-folder') return openProjectWorkspace();
    if (command === 'save-scene') return saveSnapshot('menu');
    if (command === 'reset-dock-layout') return setDockLayout(DEFAULT_DOCK_LAYOUT);
    return null;
  }

  function renderToolbar() {
    toolbar.textContent = '';
    for (const action of TOOLBAR_ACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.editorTool = action.id;
      button.dataset.editorAction = action.id;
      button.dataset.editorIcon = action.id;
      button.title = action.shortcut ? `${action.label} (${action.shortcut})` : action.label;
      button.textContent = t(`toolbar.${action.id}`, action.label);
      const mode = current.playState?.mode || (current.simulation.active ? 'playing' : 'editing');
      if ((action.id === 'play' && mode === 'playing') || (action.id === 'pause' && mode === 'paused')) {
        button.className = 'selected';
      }
      button.addEventListener('click', () => runToolbarAction(action.id));
      toolbar.appendChild(button);
    }
  }

  function renderStatusbar() {
    const entityCount = current.scene.entities.length;
    const mode = current.playState?.mode || (current.simulation.active ? 'running' : 'editing');
    statusbar.textContent = `${current.scene.name || 'untitled'} | ${entityCount} entities | ${current.gizmoMode} | ${mode}`;
    statusbar.dataset.editorSurface = 'statusbar';
    const workspace = document.createElement('span');
    workspace.dataset.workspaceRoot = 'true';
    workspace.textContent = current.workspace?.root ? ` | ${current.workspace.root}` : '';
    statusbar.appendChild(workspace);
    if (editorFeedback?.message) {
      const feedback = document.createElement('span');
      feedback.dataset.editorFeedback = editorFeedback.tone || 'info';
      feedback.textContent = ` | ${editorFeedback.message}`;
      statusbar.appendChild(feedback);
    }
  }

  function showEditorFeedback(message, tone = 'info') {
    editorFeedback = { message, tone };
    emit('editor:feedback', editorFeedback);
    return editorFeedback;
  }

  function renderTransientSurfaces() {
    root.querySelector('[data-command-palette]')?.remove();
    root.querySelector('[data-scene-validation]')?.remove();
    root.querySelector('[data-particle-editor]')?.remove();
    root.querySelector('[data-sprite-editor]')?.remove();
    root.querySelector('[data-resource-picker]')?.remove();
    root.querySelector('[data-prefab-save-prompt]')?.remove();
    root.querySelector('[data-authoring-health]')?.remove();
    root.querySelector('[data-25d-production-panel]')?.remove();
    const frame = root.querySelector('.editor-frame') || root;
    if (current.commandPaletteOpen) frame.appendChild(createCommandPalette());
    if (current.sceneValidation?.issues?.length) frame.appendChild(createSceneValidationPanel());
    if (current.particleEditor?.open) frame.appendChild(createParticleEditorPanel());
    if (current.spriteEditor?.open) frame.appendChild(createSpriteEditorPanel());
    if (current.resourcePicker?.open) frame.appendChild(createResourcePickerPanel());
    if (current.prefabHotEdit?.promptOpen) frame.appendChild(createPrefabHotEditPrompt());
    if (current.authoringHealth?.open) frame.appendChild(createAuthoringHealthPanel());
    if (shouldShow25DProductionPanel()) frame.appendChild(create25DProductionPanel());
  }

  function shouldShow25DProductionPanel() {
    return Boolean(current.coCreation25D || appliedCoCreationPlans().length > 0 || current.preview25D);
  }

  function create25DProductionPanel() {
    const report = create25DProductionReadinessReport();
    const visualEvidence = create25DVisualEvidence();
    const appliedPlans = Number(report.evidence.appliedCoCreationPlans || 0);
    const stages = [
      { id: 'plan', label: 'Plan', status: current.coCreation25D || appliedPlans > 0 ? 'complete' : 'pending' },
      { id: 'apply', label: 'Apply', status: appliedPlans > 0 ? 'complete' : current.coCreation25D ? 'blocked' : 'pending' },
      { id: 'save', label: 'Save', status: report.evidence.saved ? 'complete' : appliedPlans > 0 ? 'blocked' : 'pending' },
      { id: 'export', label: 'Export', status: report.evidence.entryScene && report.evidence.targets.length ? 'complete' : 'blocked' },
      { id: 'readiness', label: 'Readiness', status: report.ready ? 'complete' : 'blocked' }
    ];
    const wrap = document.createElement('div');
    wrap.className = 'production-25d-panel floating-editor-panel';
    wrap.setAttribute('data-25d-production-panel', 'true');
    wrap.dataset.ready = report.ready ? 'true' : 'false';
    const title = document.createElement('h3');
    title.textContent = '2.5D Production';
    const score = document.createElement('strong');
    score.className = 'production-25d-score';
    score.setAttribute('data-25d-production-score', 'true');
    score.textContent = `${report.score}`;
    const list = document.createElement('div');
    list.className = 'production-25d-stages';
    for (const stage of stages) {
      const item = document.createElement('div');
      item.className = `production-25d-stage production-25d-stage-${stage.status}`;
      item.setAttribute('data-25d-stage', stage.id);
      item.dataset.status = stage.status;
      item.textContent = stage.label;
      list.appendChild(item);
    }
    const action = document.createElement('p');
    action.className = 'production-25d-action';
    action.textContent = report.nextActions[0] || 'Ready for lightweight deployment.';
    const visual = document.createElement('div');
    visual.className = 'production-25d-visual';
    visual.setAttribute('data-25d-visual-evidence', 'true');
    visual.textContent = `Visual Evidence ${visualEvidence.summary.coCreatedEntities}`;
    const visualTypes = [...new Set(visualEvidence.layers.map((layer) => layer.type))]
      .filter((type) => type !== 'entity');
    for (const type of visualTypes) {
      const chip = document.createElement('span');
      chip.className = 'production-25d-visual-chip';
      chip.setAttribute('data-25d-visual-layer', type);
      chip.textContent = type;
      visual.appendChild(chip);
    }
    wrap.append(title, score, list, action, visual);
    const saveVersionPanel = createSaveVersionPanel();
    if (saveVersionPanel) wrap.appendChild(saveVersionPanel);
    return wrap;
  }

  function createSaveVersionPanel() {
    const versions = listSaveVersions();
    if (!versions.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'save-version-panel';
    wrap.setAttribute('data-save-version-panel', 'true');
    const title = document.createElement('h4');
    title.textContent = 'Save Versions';
    wrap.appendChild(title);

    if (versions.length >= 2) {
      const diff = diffSaveVersions(versions[versions.length - 2].id, versions[versions.length - 1].id);
      const summary = document.createElement('p');
      summary.className = 'save-version-diff';
      summary.setAttribute('data-save-version-diff', 'true');
      summary.textContent = formatSaveVersionDiff(diff);
      wrap.appendChild(summary);
    }

    const list = document.createElement('ol');
    list.className = 'save-version-list';
    for (const version of versions.slice(-5)) {
      const row = document.createElement('li');
      row.setAttribute('data-save-version-row', version.id);
      const label = document.createElement('span');
      label.textContent = `${version.name} (${version.entities})`;
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-save-version-rollback', version.id);
      button.textContent = 'Rollback';
      button.addEventListener('click', () => rollbackToSaveVersion(version.id));
      row.append(label, button);
      list.appendChild(row);
    }
    wrap.appendChild(list);
    return wrap;
  }

  function createCommandPalette() {
    const wrap = document.createElement('div');
    wrap.className = 'command-palette';
    wrap.dataset.commandPalette = 'true';
    const input = document.createElement('input');
    input.dataset.commandPaletteInput = 'true';
    input.value = 'scene:validate';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeCommandPalette();
      if (event.key === 'Enter') runCommand(input.value);
    });
    const validate = document.createElement('button');
    validate.type = 'button';
    validate.dataset.commandId = 'scene:validate';
    validate.textContent = 'Validate Scene';
    validate.addEventListener('click', () => runCommand('scene:validate'));
    const overlays = document.createElement('button');
    overlays.type = 'button';
    overlays.dataset.commandId = 'overlay:collision-depth';
    overlays.textContent = 'Show Collision/Depth';
    overlays.addEventListener('click', () => runCommand('overlay:collision-depth'));
    wrap.append(input, validate, overlays);
    queueMicrotask(() => input.focus?.());
    return wrap;
  }

  function createSceneValidationPanel() {
    const wrap = document.createElement('div');
    wrap.className = 'scene-validation';
    wrap.dataset.sceneValidation = 'true';
    for (const issue of current.sceneValidation.issues) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.sceneIssue = issue.code;
      button.dataset.sceneIssueEntity = issue.entityId || '';
      button.textContent = `${issue.code}: ${issue.entityId || 'scene'}`;
      button.addEventListener('click', () => locateSceneIssue(issue));
      wrap.appendChild(button);
    }
    return wrap;
  }

  function createResourcePickerPanel() {
    const picker = normalizeResourcePickerState(current.resourcePicker);
    const wrap = document.createElement('div');
    wrap.className = 'resource-picker floating-editor-panel';
    wrap.dataset.resourcePicker = picker.field || '';
    const title = document.createElement('h3');
    title.textContent = `Select ${picker.field || 'resource'}`;
    const search = document.createElement('input');
    search.type = 'search';
    search.dataset.resourcePickerSearch = 'true';
    search.value = picker.query;
    search.addEventListener('input', () => openResourcePicker(picker.field, { query: search.value }));
    const list = document.createElement('div');
    list.className = 'resource-picker-list';
    const assets = filterResourceAssets(current.assets, picker.query);
    for (const asset of assets) {
      const entry = normalizeAssetEntry(asset);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.resourcePickerAsset = entry.path;
      button.textContent = entry.path;
      const thumb = document.createElement('img');
      thumb.alt = entry.name;
      thumb.src = entry.thumbnail || entry.url || entry.path;
      button.prepend(thumb);
      button.addEventListener('click', () => selectResourceForField(picker.field, entry.path));
      list.appendChild(button);
    }
    wrap.append(title, search, list);
    return wrap;
  }

  function createPrefabHotEditPrompt() {
    const hotEdit = normalizePrefabHotEditState(current.prefabHotEdit);
    const wrap = document.createElement('div');
    wrap.className = 'prefab-hot-edit-prompt floating-editor-panel';
    wrap.dataset.prefabSavePrompt = hotEdit.prefabId || '';
    const title = document.createElement('h3');
    title.textContent = `Save prefab variant ${hotEdit.prefabId}`;
    const body = document.createElement('p');
    body.textContent = 'Paused runtime changes are pending. Save overrides back to the prefab variant before leaving play edit mode.';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save';
    save.addEventListener('click', () => savePrefabHotEdit());
    const ignore = document.createElement('button');
    ignore.type = 'button';
    ignore.textContent = 'Ignore';
    ignore.addEventListener('click', () => {
      current = { ...current, prefabHotEdit: { prefabId: null, patch: {}, dirty: false, promptOpen: false } };
      emit('editor:ignore-prefab-hot-edit', { prefabId: hotEdit.prefabId });
      update(current);
    });
    wrap.append(title, body, save, ignore);
    return wrap;
  }

  function createAuthoringHealthPanel() {
    const report = current.authoringHealth || { ok: true, issues: [], hotspots: [], counts: {} };
    const wrap = document.createElement('div');
    wrap.className = 'authoring-health-panel floating-editor-panel';
    wrap.dataset.authoringHealth = report.ok ? 'ok' : 'issues';
    const title = document.createElement('h3');
    title.textContent = report.ok ? 'Authoring Health: Ready' : 'Authoring Health: Issues';
    const counts = document.createElement('div');
    counts.className = 'authoring-health-counts';
    counts.textContent = `animations ${report.counts?.animations || 0} | particles ${report.counts?.particles || 0} | sprites ${report.counts?.sprites || 0} | scenes ${report.counts?.scenes || 0}`;
    const list = document.createElement('div');
    list.className = 'authoring-health-issues';
    for (const issue of report.issues || []) {
      const row = document.createElement('div');
      row.dataset.authoringHealthIssue = issue.code;
      row.className = `authoring-health-${issue.severity || 'error'}`;
      row.textContent = `${issue.code}: ${issue.message}`;
      list.appendChild(row);
    }
    const hotspots = document.createElement('div');
    hotspots.className = 'authoring-health-hotspots';
    for (const hotspot of report.hotspots || []) {
      const row = document.createElement('div');
      row.dataset.authoringHealthHotspot = hotspot.name;
      row.className = `authoring-health-${hotspot.severity}`;
      row.textContent = `${hotspot.name} ${hotspot.duration}ms ${hotspot.severity}: ${hotspot.suggestion}`;
      hotspots.appendChild(row);
    }
    wrap.append(title, counts, list, hotspots);
    return wrap;
  }

  function createParticleEditorPanel() {
    const config = normalizeParticleConfig(current.particleEditor?.config || {});
    const wrap = document.createElement('div');
    wrap.className = 'particle-editor floating-editor-panel';
    wrap.dataset.particleEditor = 'true';

    const title = document.createElement('h3');
    title.textContent = 'Particle Editor';
    wrap.appendChild(title);

    for (const field of ['emissionRate', 'lifetime', 'initialVelocity', 'gravity']) {
      const label = document.createElement('label');
      label.textContent = field;
      const input = document.createElement('input');
      input.type = 'range';
      input.dataset.particleSlider = field;
      input.min = field === 'lifetime' ? '0' : '-800';
      input.max = field === 'lifetime' ? '5' : '800';
      input.step = field === 'lifetime' ? '0.1' : '1';
      input.value = String(config[field]);
      input.addEventListener('input', () => setParticleParameter(field, input.value));
      label.appendChild(input);
      wrap.appendChild(label);
    }

    const preview = document.createElement('div');
    preview.className = 'particle-preview';
    preview.dataset.particlePreview = 'true';
    const count = Math.max(6, Math.min(30, Math.round(config.emissionRate / 8)));
    for (let index = 0; index < count; index += 1) {
      const spark = document.createElement('i');
      const progress = count === 1 ? 0 : index / (count - 1);
      spark.style.left = `${10 + progress * 78}%`;
      spark.style.top = `${72 - progress * 48}%`;
      spark.style.opacity = `${Math.max(0.18, 1 - progress)}`;
      preview.appendChild(spark);
    }
    wrap.appendChild(preview);

    const exportPreview = document.createElement('pre');
    exportPreview.dataset.particleExportPreview = 'true';
    exportPreview.textContent = JSON.stringify(exportParticleConfig().config, null, 2);
    wrap.appendChild(exportPreview);
    return wrap;
  }

  function createSpriteEditorPanel() {
    const editor = current.spriteEditor || {};
    const nineSlice = normalizeNineSlice(editor.nineSlice || {});
    const wrap = document.createElement('div');
    wrap.className = 'sprite-editor floating-editor-panel';
    wrap.dataset.spriteEditor = editor.source || '';

    const title = document.createElement('h3');
    title.textContent = editor.source || 'Sprite Editor';
    wrap.appendChild(title);

    const canvas = document.createElement('div');
    canvas.className = 'sprite-edit-canvas';
    canvas.dataset.spriteCanvas = 'true';
    for (const guide of ['left', 'right', 'top', 'bottom']) {
      const line = document.createElement('button');
      line.type = 'button';
      line.className = `nine-slice-guide guide-${guide}`;
      line.dataset.nineSliceGuide = guide;
      if (guide === 'left' || guide === 'right') line.style.left = `${nineSlice[guide]}px`;
      else line.style.top = `${nineSlice[guide]}px`;
      canvas.appendChild(line);
    }
    if (editor.collider) {
      const collider = document.createElement('div');
      collider.className = 'collider-outline';
      collider.dataset.colliderOutline = 'true';
      canvas.appendChild(collider);
    }
    wrap.appendChild(canvas);

    const material = findSelectedEntity(current)?.material || {};
    wrap.appendChild(createMaterialPanel(material));
    const metaPreview = document.createElement('pre');
    metaPreview.dataset.spriteMetaPreview = 'true';
    metaPreview.textContent = JSON.stringify(exportSpriteMeta().meta, null, 2);
    wrap.appendChild(metaPreview);
    return wrap;
  }

  function renderPanel(name, body) {
    const section = document.createElement('section');
    section.dataset.panel = name;
    section.dataset.dockPanel = name;
    section.dataset.editorSurface = 'panel';
    section.className = `editor-panel ${name}`;
    section.draggable = true;
    section.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('application/x-omnicore-dock-panel', name);
      event.dataTransfer?.setData('text/plain', name);
    });
    const title = document.createElement('h2');
    title.textContent = t(`panel.${name}`, PANEL_TITLES[name]);
    section.append(title, body);
    return section;
  }

  function renderHierarchy() {
    const list = document.createElement('ol');
    list.className = 'hierarchy-list';
    const ids = selectedIds(current);
    for (const entity of current.scene.entities) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.editorEntityId = entity.id;
      button.textContent = entity.name || entity.id;
      button.className = ids.includes(entity.id) ? 'selected' : '';
      button.addEventListener('click', (event) => selectEntity(entity.id, { append: event.shiftKey }));
      item.appendChild(button);
      list.appendChild(item);
    }
    return list;
  }

  function renderInspector() {
    const selected = findSelectedEntity(current) || current.scene.entities[0] || null;
    const form = document.createElement('form');
    form.addEventListener('submit', (event) => event.preventDefault());
    for (const key of inspectorFields(selected)) {
      const label = document.createElement('label');
      label.textContent = t(`inspector.${key}`, key);
      const input = document.createElement('input');
      input.value = selected?.[key] ?? '';
      input.dataset.inspectorField = key;
      input.disabled = !selected || key === 'id';
      if (['sprite', 'texture'].includes(key)) {
        input.addEventListener('click', () => {
          if (selected) openResourcePicker(key);
        });
      }
      input.addEventListener('input', () => {
        if (!selected || key === 'id') return;
        patchEntity(selected.id, { [key]: parseFieldValue(key, input.value, selected?.[key]) });
      });
      label.appendChild(input);
      form.appendChild(label);
    }
    const components = document.createElement('div');
    components.dataset.inspectorComponents = 'true';
    components.textContent = formatComponents(selected?.components || []);
    form.appendChild(components);
    if (selected?.type === 'sprite' || selected?.sprite || selected?.texture) {
      form.appendChild(createMaterialPanel(selected.material || {}, selected.id));
    }
    const scriptBinding = resolveScriptBinding(selected);
    if (scriptBinding) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.inspectorOpenScript = 'true';
      button.textContent = t('inspector.openScript', 'Open Script');
      button.addEventListener('click', () => openEntityScript(selected.id));
      form.appendChild(button);
    }
    return form;
  }

  function createMaterialPanel(material = {}, entityId = current.selectedEntityId) {
    const normalized = normalizeSpriteMaterial(material);
    const panel = document.createElement('fieldset');
    panel.className = 'material-panel';
    panel.dataset.materialPanel = 'true';
    const legend = document.createElement('legend');
    legend.textContent = 'Material';
    panel.appendChild(legend);
    for (const field of ['alphaClip', 'colorTint', 'normalMap']) {
      const label = document.createElement('label');
      label.textContent = field;
      const input = document.createElement('input');
      input.dataset.materialField = field;
      if (field === 'colorTint') input.type = 'color';
      else if (field === 'alphaClip') {
        input.type = 'number';
        input.min = '0';
        input.max = '1';
        input.step = '0.01';
      } else {
        input.type = 'text';
      }
      input.value = normalized[field] ?? '';
      input.addEventListener('input', () => {
        if (!entityId) return;
        setSpriteMaterial(entityId, { [field]: field === 'alphaClip' ? Number(input.value || 0) : input.value });
      });
      label.appendChild(input);
      panel.appendChild(label);
    }
    return panel;
  }

  function renderSceneView() {
    const wrap = document.createElement('div');
    wrap.className = 'scene-wrap';
    const sceneTabs = renderSceneTabs();
    const gizmoToolbar = document.createElement('div');
    gizmoToolbar.className = 'gizmo-toolbar';
    for (const mode of ['select', 'translate', 'rotate', 'scale']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.gizmoMode = mode;
      button.textContent = t(`gizmo.${mode}`, mode);
      button.className = current.gizmoMode === mode ? 'selected' : '';
      button.addEventListener('click', () => setGizmoMode(mode));
      gizmoToolbar.appendChild(button);
    }

    const view = document.createElement('div');
    view.className = 'scene-canvas';
    view.dataset.sceneDropZone = 'true';
    view.addEventListener('mousedown', (event) => {
      if (!event.shiftKey) return;
      event.preventDefault();
      beginMarqueeSelection(event);
    });
    view.addEventListener('dragover', (event) => event.preventDefault());
    view.addEventListener('drop', (event) => {
      event.preventDefault();
      const assetPath = event.dataTransfer?.getData('application/x-omnicore-asset');
      const prefabId = event.dataTransfer?.getData('application/x-omnicore-prefab')
        || (!assetPath ? event.dataTransfer?.getData('text/plain') : '');
      if (assetPath && isSceneAsset(assetPath)) instantiateSubScene(assetPath, event);
      else if (assetPath) instantiateAsset(assetPath, event);
      else instantiatePrefab(prefabId, event);
    });

    for (const entity of current.scene.entities) view.appendChild(createSceneNodeButton(entity));
    if (!current.scene.entities.length) view.appendChild(createOnboardingGuide());
    if (current.sceneOverlays?.collision) {
      for (const entity of current.scene.entities) view.appendChild(createCollisionOverlay(entity));
    }
    if (current.sceneOverlays?.depth) {
      for (const entity of current.scene.entities) view.appendChild(createDepthOverlay(entity));
    }
    for (const entity of current.scene.entities.filter((item) => selectedIds(current).includes(item.id))) {
      view.appendChild(createSelectionOutline(entity));
      view.appendChild(createOriginMarker(entity));
      view.appendChild(createTransformGizmo(entity));
    }
    if (current.prefabPreview) view.appendChild(createPrefabPreviewModel(current.prefabPreview));
    wrap.append(sceneTabs, gizmoToolbar, view, createUndoHistoryView());
    return wrap;
  }

  function createOnboardingGuide() {
    const guide = document.createElement('aside');
    guide.className = 'editor-onboarding';
    guide.dataset.editorOnboarding = 'true';
    guide.innerHTML = [
      '<strong>Open Project</strong>',
      '<span>Drop assets or prefabs into the canvas.</span>',
      '<span>Use W/E/R to move, rotate, and scale after selecting an entity.</span>'
    ].join('');
    return guide;
  }

  function renderSceneTabs() {
    const tabs = document.createElement('div');
    tabs.className = 'scene-tabs';
    for (const tab of current.sceneTabs || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.sceneTab = tab.path;
      button.className = current.activeSceneTabPath === tab.path ? 'selected' : '';
      button.textContent = tab.path.split('/').pop() || tab.path;
      button.addEventListener('click', () => switchSceneTab(tab.path));
      tabs.appendChild(button);
    }
    return tabs;
  }

  function createSceneNodeButton(entity) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = [
      'scene-node',
      selectedIds(current).includes(entity.id) ? 'selected' : '',
      current.sceneIssueTargetId === entity.id ? 'issue-target' : ''
    ].filter(Boolean).join(' ');
    node.dataset.sceneNodeId = entity.id;
    node.textContent = entity.name || entity.id;
    node.style.left = `${entity.x || 0}px`;
    node.style.top = `${entity.y || 0}px`;
    node.style.width = `${Math.max(24, entity.width || 32)}px`;
    node.style.height = `${Math.max(24, entity.height || 32)}px`;
    node.style.transform = `rotate(${entity.rotation || 0}rad) scale(${entity.scaleX ?? 1}, ${entity.scaleY ?? 1})`;
    node.addEventListener('click', (event) => selectEntity(entity.id, { append: event.shiftKey }));
    node.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectEntity(entity.id, { append: event.shiftKey });
      beginDrag(entity, event);
    });
    return node;
  }

  function createTransformGizmo(entity) {
    const gizmo = document.createElement('div');
    gizmo.className = `transform-gizmo transform-${current.gizmoMode}`;
    gizmo.dataset.transformGizmo = entity.id;
    gizmo.style.left = `${Number(entity.x || 0) + Math.max(24, Number(entity.width || 32)) + 8}px`;
    gizmo.style.top = `${Number(entity.y || 0)}px`;
    for (const axis of ['x', 'y', 'z']) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = `gizmo-axis gizmo-${axis}`;
      handle.dataset.gizmoAxis = axis;
      handle.title = `${current.gizmoMode} ${axis.toUpperCase()}`;
      handle.textContent = axis.toUpperCase();
      handle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectEntity(entity.id);
        beginDrag(entity, event, { axis, source: 'gizmo' });
      });
      gizmo.appendChild(handle);
    }
    return gizmo;
  }

  function createPrefabPreviewModel(entity) {
    const preview = document.createElement('div');
    preview.className = 'prefab-preview-model';
    preview.dataset.prefabPreviewModel = entity.id || entity.name || 'preview';
    preview.textContent = entity.name || entity.id || 'Prefab Preview';
    preview.style.left = `${Number(entity.x || 40)}px`;
    preview.style.top = `${Number(entity.y || 40)}px`;
    preview.style.width = `${Math.max(24, Number(entity.width || 32))}px`;
    preview.style.height = `${Math.max(24, Number(entity.height || 32))}px`;
    return preview;
  }

  function createCollisionOverlay(entity) {
    const collider = entity.collider || {};
    const width = Number(collider.width || entity.width || 32);
    const height = Number(collider.height || entity.height || 32);
    const x = Number(entity.x || 0) + Number(collider.offsetX || 0);
    const y = Number(entity.y || 0) + Number(collider.offsetY || 0);
    const overlay = document.createElement('div');
    overlay.className = 'collision-overlay';
    overlay.dataset.collisionOverlay = entity.id;
    overlay.style.left = `${x}px`;
    overlay.style.top = `${y}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    return overlay;
  }

  function createDepthOverlay(entity) {
    const overlay = document.createElement('div');
    overlay.className = 'depth-overlay';
    overlay.dataset.depthOverlay = entity.id;
    overlay.style.left = `${Number(entity.x || 0)}px`;
    overlay.style.top = `${Number(entity.y || 0) - 18}px`;
    overlay.textContent = `z:${Number(entity.zIndex ?? entity.depth ?? 0)}`;
    return overlay;
  }

  function createUndoHistoryView() {
    const list = document.createElement('div');
    list.className = 'undo-history';
    list.dataset.undoHistory = 'true';
    const start = Math.max(0, historyLabels.length - 8);
    historyLabels.slice(start).forEach((label, offset) => {
      const row = document.createElement('div');
      const absoluteIndex = start + offset;
      row.dataset.undoHistoryEntry = String(absoluteIndex);
      row.className = absoluteIndex === historyIndex ? 'selected' : '';
      row.textContent = label;
      list.appendChild(row);
    });
    return list;
  }

  function createSelectionOutline(entity) {
    const outline = document.createElement('div');
    outline.className = 'selection-outline';
    outline.dataset.editorSelectionOutline = entity.id;
    outline.style.left = `${Number(entity.x || 0) - 3}px`;
    outline.style.top = `${Number(entity.y || 0) - 3}px`;
    outline.style.width = `${Math.max(24, entity.width || 32) + 6}px`;
    outline.style.height = `${Math.max(24, entity.height || 32) + 6}px`;
    return outline;
  }

  function createOriginMarker(entity) {
    const marker = document.createElement('span');
    marker.className = 'origin-marker';
    marker.dataset.editorOrigin = entity.id;
    marker.style.left = `${Number(entity.x || 0)}px`;
    marker.style.top = `${Number(entity.y || 0)}px`;
    return marker;
  }

  function renderPrefabs() {
    const list = document.createElement('div');
    list.className = 'prefab-list';
    for (const prefab of current.prefabs) {
      list.appendChild(createPrefabButton(prefab));
    }
    const overrides = createPrefabOverridePanel();
    if (overrides) list.appendChild(overrides);
    return list;
  }

  function createPrefabButton(prefab) {
    const button = document.createElement('button');
    button.type = 'button';
    button.draggable = true;
    button.dataset.prefabId = prefab.id || prefab.name;
    button.textContent = `${prefab.isBasePrefab ? 'Base ' : ''}${prefab.name || prefab.id}${prefab.extends ? ` <- ${prefab.extends}` : ''}`;
    button.addEventListener('click', () => {
      current = { ...current, selectedPrefabId: prefab.id || prefab.name };
      update(current);
    });
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      api.EditorAPI.createPrefabVariant(prefab.id || prefab.name, { name: `${prefab.name || prefab.id} Variant` }, {
        id: `${prefab.id || prefab.name}-variant-${Date.now().toString(36)}`
      });
    });
    button.addEventListener('dragstart', (event) => {
      const id = prefab.id || prefab.name;
      event.dataTransfer?.setData('application/x-omnicore-prefab', id);
      event.dataTransfer?.setData('text/plain', id);
    });
    return button;
  }

  function renderAssets() {
    const list = document.createElement('div');
    list.className = 'asset-list';
    const assets = Array.isArray(current.assets) ? current.assets : [];
    for (const asset of assets) {
      const assetPath = typeof asset === 'string' ? asset : asset.path || asset.url || asset.name;
      if (!assetPath) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.draggable = true;
      button.dataset.editorAssetPath = assetPath;
      button.dataset.assetType = assetType(asset);
      button.style.paddingLeft = `${8 + Math.max(0, assetPath.split('/').length - 1) * 10}px`;
      button.textContent = `${assetIcon(asset)} ${assetPath}`;
      button.addEventListener('click', () => previewAsset(asset));
      button.addEventListener('dblclick', () => {
        if (isPrefabAsset(asset)) previewPrefabAsset(asset);
        else if (assetType(asset) === 'image' && /\.webp$/iu.test(assetPath)) openSpriteEditor(assetPath);
      });
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('application/x-omnicore-asset', assetPath);
        event.dataTransfer?.setData('text/plain', assetPath);
      });
      list.appendChild(button);
    }
    const preview = renderAssetPreview();
    if (preview) list.appendChild(preview);
    return list;
  }

  function createPrefabOverridePanel() {
    const prefab = findPrefab(current.selectedPrefabId);
    if (!prefab?.extends) return null;
    const wrap = document.createElement('div');
    wrap.className = 'prefab-override-panel';
    wrap.dataset.prefabOverridePanel = prefab.id || prefab.name;
    const title = document.createElement('h3');
    title.textContent = `${prefab.name || prefab.id} overrides`;
    wrap.appendChild(title);
    const overrides = prefab.overrides || {};
    for (const [field, value] of Object.entries(overrides)) {
      const row = document.createElement('div');
      row.className = 'prefab-override-row override';
      row.dataset.prefabOverride = field;
      const label = document.createElement('span');
      label.textContent = `${field}: ${value}`;
      const write = document.createElement('button');
      write.type = 'button';
      write.dataset.prefabOverrideAction = `${field}:write`;
      write.textContent = 'Write';
      write.addEventListener('click', () => writePrefabOverrideToBase(prefab.id || prefab.name, field));
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.dataset.prefabOverrideAction = `${field}:reset`;
      reset.textContent = 'Reset';
      reset.addEventListener('click', () => resetPrefabOverride(prefab.id || prefab.name, field));
      row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        resetPrefabOverride(prefab.id || prefab.name, field);
      });
      row.append(label, write, reset);
      wrap.appendChild(row);
    }
    return wrap;
  }

  function previewAsset(asset) {
    current = { ...current, assetPreview: normalizeAssetEntry(asset) };
    emit('editor:preview-asset', current.assetPreview);
    update(current);
    return current.assetPreview;
  }

  function previewPrefabAsset(asset) {
    const entry = normalizeAssetEntry(asset);
    const prefab = entry.data || entry.prefab || { id: entry.name, name: entry.name };
    const entity = {
      id: `preview-${prefab.id || prefab.name || 'prefab'}`,
      name: prefab.name || prefab.id || entry.name || 'Prefab Preview',
      type: prefab.type || 'sprite',
      texture: prefab.texture || prefab.sprite || null,
      x: Number(prefab.x ?? 40),
      y: Number(prefab.y ?? 40),
      width: Number(prefab.width || 32),
      height: Number(prefab.height || 32),
      rotation: Number(prefab.rotation || 0),
      scaleX: Number(prefab.scaleX ?? prefab.scale ?? 1),
      scaleY: Number(prefab.scaleY ?? prefab.scale ?? 1)
    };
    current = { ...current, assetPreview: entry, prefabPreview: entity };
    emit('editor:preview-prefab', { asset: entry.path, entity });
    update(current);
    return entity;
  }

  function renderAssetPreview() {
    const entry = current.assetPreview;
    if (!entry) return null;
    const wrap = document.createElement('div');
    wrap.className = 'asset-preview';
    if (assetType(entry) === 'image') {
      const image = document.createElement('img');
      image.dataset.assetPreview = 'image';
      image.alt = entry.name || entry.path;
      image.src = entry.url || entry.path;
      wrap.appendChild(image);
    } else {
      const code = document.createElement('pre');
      code.dataset.assetPreview = assetType(entry);
      code.textContent = JSON.stringify(entry.data || { path: entry.path, type: assetType(entry) }, null, 2);
      wrap.appendChild(code);
    }
    return wrap;
  }

  function renderDatabase() {
    const wrap = document.createElement('div');
    wrap.className = 'database-wrap';
    const tables = current.database?.tables || {};
    for (const [tableName, records] of Object.entries(tables)) {
      const table = document.createElement('table');
      table.dataset.databasePanelTable = tableName;
      const caption = document.createElement('caption');
      caption.textContent = tableName;
      table.appendChild(caption);
      for (const record of normalizeDatabaseRecords(records)) {
        const row = document.createElement('tr');
        for (const field of Object.keys(record)) {
          const cell = document.createElement('td');
          const input = document.createElement('input');
          input.value = record[field] ?? '';
          input.disabled = field === 'id';
          input.title = field;
          input.dataset.databaseTable = tableName;
          input.dataset.databaseId = record.id;
          input.dataset.databaseField = field;
          input.addEventListener('input', () => {
            if (field !== 'id') updateDatabaseRecord(tableName, record.id, field, input.value);
          });
          cell.appendChild(input);
          row.appendChild(cell);
        }
        table.appendChild(row);
      }
      wrap.appendChild(table);
    }
    if (!Object.keys(tables).length) {
      const empty = document.createElement('p');
      empty.textContent = 'No database tables';
      wrap.appendChild(empty);
    }
    return wrap;
  }

  function renderAIAssistant() {
    const wrap = document.createElement('div');
    wrap.className = 'ai-assistant-wrap';
    const input = document.createElement('input');
    input.dataset.aiAssistantPrompt = 'true';
    input.placeholder = '生成 16x12 森林湖泊地图，加入 treasure 实体';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.aiAssistantRun = 'true';
    button.textContent = 'Generate';
    const status = document.createElement('small');
    status.dataset.aiAssistantStatus = 'true';
    button.addEventListener('click', async () => {
      const result = generateWithAI(input.value || '');
      status.textContent = `${result.tilemap.width}x${result.tilemap.height}`;
    });
    wrap.append(input, button, status);
    return wrap;
  }

  function renderTilemap() {
    const tilemap = cloneTilemap(current.tilemap);
    const activeLayer = findActiveTileLayer(tilemap);
    const wrap = document.createElement('div');
    wrap.className = 'tilemap-wrap';
    const tileToolbar = document.createElement('div');
    tileToolbar.className = 'tilemap-toolbar';
    const size = document.createElement('span');
    size.textContent = `${tilemap.width}x${tilemap.height}`;
    const collision = document.createElement('button');
    collision.type = 'button';
    collision.dataset.collisionMode = 'true';
    collision.textContent = current.collisionMode
      ? t('tilemap.collisionOn', 'collision on')
      : t('tilemap.paintTiles', 'paint tiles');
    collision.addEventListener('click', () => {
      current = { ...current, collisionMode: !current.collisionMode };
      update(current);
    });
    tileToolbar.append(size, collision);

    const layerBar = document.createElement('div');
    layerBar.className = 'tilemap-layers';
    for (const layer of tilemap.layers) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tileLayerId = layer.id;
      button.className = layer.id === tilemap.activeLayerId ? 'selected' : '';
      button.textContent = layer.name;
      button.addEventListener('click', () => selectTileLayer(layer.id));
      layerBar.appendChild(button);
    }

    const palette = document.createElement('div');
    palette.className = 'tilemap-palette';
    for (const tile of tilePalette(tilemap)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tilesetTileId = String(tile.id);
      if (tile.source) button.dataset.tileCrop = `${tile.source.x},${tile.source.y},${tile.source.width},${tile.source.height}`;
      button.className = tile.id === current.selectedTile ? 'selected' : '';
      button.textContent = String(tile.id);
      button.addEventListener('click', () => selectTilesetTile(tile.id));
      palette.appendChild(button);
    }

    const grid = document.createElement('div');
    grid.className = 'tilemap-grid';
    grid.style.gridTemplateColumns = `repeat(${tilemap.width}, 24px)`;
    activeLayer.data.forEach((value, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.dataset.tileIndex = String(index);
      cell.textContent = tilemap.collisions.includes(index) ? 'C' : String(value || '');
      cell.className = tilemap.collisions.includes(index) ? 'collision' : '';
      cell.addEventListener('click', () => paintTile(index));
      cell.addEventListener('mousedown', (event) => {
        event.preventDefault();
        tilePaintSession = true;
        paintTile(index);
      });
      cell.addEventListener('mouseenter', () => {
        if (tilePaintSession) paintTile(index);
      });
      grid.appendChild(cell);
    });
    wrap.append(tileToolbar, layerBar, palette, grid);
    return wrap;
  }

  function renderTimeline() {
    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    const clipIds = Object.keys(current.animations || {});
    if (!clipIds.length) {
      timeline.textContent = t('timeline.noClips', 'No clips');
      return timeline;
    }
    const selected = current.selectedAnimationKeyframe;
    const clipList = document.createElement('div');
    clipList.className = 'timeline-clips';
    for (const clipId of clipIds) {
      const clip = current.animations[clipId];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.dataset.animationClip = clipId;
      chip.textContent = `${clipId} ${Number(clip.duration || 0)}f`;
      clipList.appendChild(chip);
    }
    timeline.appendChild(clipList);

    if (selected) {
      const clip = current.animations?.[selected.clipId];
      const track = clip?.tracks?.[selected.track];
      const keyframe = track?.keyframes?.find((item) => Number(item.frame || 0) === Number(selected.frame || 0));
      const graph = document.createElement('div');
      graph.className = 'animation-curve-graph';
      graph.dataset.animationCurveGraph = `${selected.clipId}:${selected.track}:${Number(selected.frame || 0)}`;
      graph.textContent = `${selected.track} frame ${selected.frame} value ${keyframe?.value ?? 0}`;
      const handleIn = document.createElement('span');
      handleIn.className = 'bezier-handle handle-in';
      handleIn.style.left = `${Number(keyframe?.handles?.in?.x || 0)}px`;
      handleIn.style.top = `${Number(keyframe?.handles?.in?.y || 0)}px`;
      const handleOut = document.createElement('span');
      handleOut.className = 'bezier-handle handle-out';
      handleOut.style.left = `${Number(keyframe?.handles?.out?.x || 0)}px`;
      handleOut.style.top = `${Number(keyframe?.handles?.out?.y || 0)}px`;
      graph.append(handleIn, handleOut);
      timeline.appendChild(graph);

      const presets = document.createElement('div');
      presets.className = 'easing-presets';
      for (const preset of ['Linear', 'EaseInQuad', 'EaseOutBack', 'Elastic']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.easingPreset = preset;
        button.className = keyframe?.easing === preset ? 'selected' : '';
        button.textContent = preset;
        button.addEventListener('click', () => setAnimationCurve(selected.clipId, selected.track, selected.frame, { preset }));
        presets.appendChild(button);
      }
      timeline.appendChild(presets);
    }

    const events = document.createElement('div');
    events.className = 'animation-event-track';
    for (const clipId of clipIds) {
      for (const event of current.animations[clipId].events || []) {
        const row = document.createElement('div');
        row.className = 'animation-event-marker';
        row.dataset.animationEventFrame = String(event.frame);
        row.textContent = `${clipId}:${event.frame} ${event.name}`;
        events.appendChild(row);
      }
    }
    timeline.appendChild(events);
    return timeline;
  }

  function renderFlowGraph() {
    const graph = normalizeFlowGraph(current.flowGraph);
    const wrap = document.createElement('div');
    wrap.className = 'flow-graph-wrap';

    const flowToolbar = document.createElement('div');
    flowToolbar.className = 'flow-toolbar';
    for (const type of ['event', 'condition', 'action']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.flowAdd = type;
      button.textContent = t(`flow.add.${type}`, `Add ${type}`);
      button.addEventListener('click', () => addFlowNode(type));
      flowToolbar.appendChild(button);
    }
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.dataset.flowExport = 'eventsheet';
    exportButton.textContent = t('flow.exportEventSheet', 'Export EventSheet');
    exportButton.addEventListener('click', () => exportFlowGraph());
    flowToolbar.appendChild(exportButton);

    const canvas = document.createElement('div');
    canvas.className = 'flow-canvas';
    for (const node of graph.nodes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.draggable = true;
      button.className = `flow-node flow-${node.type}`;
      button.dataset.flowNodeId = node.id;
      button.style.left = `${Number(node.x || 0)}px`;
      button.style.top = `${Number(node.y || 0)}px`;
      button.textContent = node.label || node.id;
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('application/x-omnicore-flow-node', node.id);
        event.dataTransfer?.setData('text/plain', node.id);
      });
      button.addEventListener('dragover', (event) => event.preventDefault());
      button.addEventListener('drop', (event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer?.getData('application/x-omnicore-flow-node')
          || event.dataTransfer?.getData('text/plain');
        addFlowEdge(sourceId, node.id);
      });
      canvas.appendChild(button);
    }

    const edges = document.createElement('div');
    edges.className = 'flow-edge-list';
    for (const edge of graph.edges) {
      const source = graph.nodes.find((node) => node.id === edge.from);
      const target = graph.nodes.find((node) => node.id === edge.to);
      const row = document.createElement('div');
      row.dataset.flowEdge = `${edge.from}->${edge.to}`;
      row.textContent = `${source?.label || edge.from} -> ${target?.label || edge.to}`;
      edges.appendChild(row);
    }

    const preview = document.createElement('pre');
    preview.className = 'flow-preview';
    preview.dataset.flowPreview = 'eventsheet';
    preview.textContent = JSON.stringify(createVisualGraph(graph).toEventSheet(), null, 2);

    wrap.append(flowToolbar, canvas, edges, preview);
    return wrap;
  }

  function renderGraphEditor() {
    const wrap = document.createElement('div');
    wrap.className = 'graph-editor-wrap';
    const nodePalette = document.createElement('div');
    nodePalette.className = 'graph-node-palette';
    for (const type of ['input', 'condition', 'output']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.graphAdd = type;
      button.textContent = type;
      button.addEventListener('click', () => addFlowNode(type === 'input' ? 'event' : type === 'output' ? 'action' : 'condition'));
      nodePalette.appendChild(button);
    }
    const flow = renderFlowGraph();
    const behaviorPreview = document.createElement('pre');
    behaviorPreview.dataset.behaviorTreePreview = 'true';
    behaviorPreview.textContent = JSON.stringify(exportBehaviorTreeJson(), null, 2);
    wrap.append(nodePalette, flow, behaviorPreview);
    return wrap;
  }

  function renderUIEditor() {
    const layout = normalizeUILayoutState(current.uiLayout);
    const wrap = document.createElement('div');
    wrap.className = 'ui-editor-wrap';
    const palette = document.createElement('div');
    palette.className = 'ui-palette';
    const buttonTool = document.createElement('button');
    buttonTool.type = 'button';
    buttonTool.dataset.uiAdd = 'Button';
    buttonTool.textContent = 'Button';
    buttonTool.addEventListener('click', () => addUIButton({ text: 'Button', x: 32, y: 32 }));
    palette.appendChild(buttonTool);

    const canvas = document.createElement('div');
    canvas.className = 'ui-canvas';
    canvas.style.width = `${layout.canvas.width}px`;
    canvas.style.height = `${layout.canvas.height}px`;
    for (const element of layout.elements) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ui-element';
      item.dataset.uiElementId = element.id;
      item.style.left = `${element.x}px`;
      item.style.top = `${element.y}px`;
      item.style.width = `${element.width}px`;
      item.style.height = `${element.height}px`;
      item.textContent = element.text || element.id;
      canvas.appendChild(item);
    }

    const preview = document.createElement('pre');
    preview.dataset.uiLayoutPreview = 'true';
    preview.textContent = JSON.stringify(exportUILayoutJson(), null, 2);
    wrap.append(palette, canvas, preview);
    return wrap;
  }

  function renderGlobalSearch() {
    const searchState = normalizeGlobalSearchState(current.globalSearch);
    const wrap = document.createElement('div');
    wrap.className = 'global-search-wrap';
    const query = document.createElement('input');
    query.type = 'search';
    query.dataset.globalSearchQuery = 'true';
    query.placeholder = 'Search scripts, JSON, scenes';
    query.value = searchState.query;
    query.addEventListener('input', () => searchProject(query.value));
    const replacement = document.createElement('input');
    replacement.dataset.globalReplaceValue = 'true';
    replacement.placeholder = 'Replace with';
    replacement.value = searchState.replacement;
    const replace = document.createElement('button');
    replace.type = 'button';
    replace.dataset.globalReplaceRun = 'true';
    replace.textContent = 'Replace';
    replace.addEventListener('click', () => replaceProject(query.value, replacement.value));
    const list = document.createElement('div');
    list.className = 'global-search-results';
    for (const result of searchState.results) {
      const row = document.createElement('button');
      row.type = 'button';
      row.dataset.globalSearchResult = result.path;
      row.textContent = `${result.path}:${result.line}:${result.column} ${result.preview}`;
      list.appendChild(row);
    }
    wrap.append(query, replacement, replace, list);
    return wrap;
  }

  function renderPhysicsView() {
    const wrap = document.createElement('div');
    wrap.className = 'physics-view-wrap';
    const title = document.createElement('p');
    title.textContent = 'Matter Physics View - semi-transparent collider wireframes';
    wrap.appendChild(title);
    const canvas = document.createElement('div');
    canvas.className = 'physics-debug-canvas';
    for (const body of physicsBodies(current)) {
      const shape = document.createElement('div');
      shape.className = 'physics-wireframe';
      shape.dataset.physicsWireframe = body.id;
      shape.textContent = `${body.id} ${body.shape}`;
      shape.style.left = `${body.x}px`;
      shape.style.top = `${body.y}px`;
      shape.style.width = `${Math.max(16, body.width)}px`;
      shape.style.height = `${Math.max(16, body.height)}px`;
      if (body.vertices.length) shape.dataset.vertices = body.vertices.map((point) => `${point.x},${point.y}`).join(' ');
      canvas.appendChild(shape);
    }
    wrap.appendChild(canvas);
    return wrap;
  }

  function renderBuildSettings() {
    const settings = normalizeBuildSettingsState(current.buildSettings);
    const wrap = document.createElement('div');
    wrap.className = 'build-settings-wrap';
    for (const [platform, config] of Object.entries(settings.targets)) {
      const label = document.createElement('label');
      label.className = 'build-target-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.buildTarget = platform;
      checkbox.checked = Boolean(config.enabled);
      checkbox.addEventListener('change', () => setBuildTarget(platform, checkbox.checked));
      const text = document.createElement('span');
      text.textContent = `${platform} / ${config.compression} / ${config.iconSize}px / ${config.configStrategy}`;
      label.append(checkbox, text);
      wrap.appendChild(label);
    }
    const preview = document.createElement('pre');
    preview.dataset.buildSettingsPreview = 'true';
    preview.textContent = JSON.stringify(settings, null, 2);
    wrap.appendChild(preview);
    return wrap;
  }

  function renderProfiler() {
    const frame = current.profilerFrame;
    const wrap = document.createElement('div');
    wrap.className = 'profiler-wrap';
    wrap.dataset.editorProfiler = 'true';
    const title = document.createElement('div');
    title.textContent = frame
      ? `Frame ${frame.frame} ${Number(frame.totalMs || 0).toFixed(2)}ms`
      : t('profiler.empty', 'No profiler samples');
    wrap.appendChild(title);
    const sections = Array.isArray(frame?.sections) ? frame.sections : [];
    const max = Math.max(1, ...sections.map((section) => section.duration || 0));
    const flamegraph = document.createElement('div');
    flamegraph.className = 'profiler-flamegraph';
    flamegraph.dataset.profilerFlamegraph = 'true';
    for (const section of sections) {
      const row = document.createElement('div');
      row.className = 'profiler-row';
      row.dataset.profilerSection = section.name;
      const name = document.createElement('span');
      name.textContent = section.name;
      const bar = document.createElement('b');
      bar.style.width = `${Math.max(4, Math.round(((section.duration || 0) / max) * 160))}px`;
      const value = document.createElement('span');
      value.textContent = `${Number(section.duration || 0).toFixed(2)}ms`;
      row.append(name, bar, value);
      flamegraph.appendChild(row);
    }
    wrap.appendChild(flamegraph);
    const streams = document.createElement('div');
    streams.className = 'profiler-streams';
    const memory = document.createElement('span');
    memory.dataset.profilerMemory = 'true';
    memory.textContent = `Memory Usage ${Number(frame?.memoryMB || 0)}MB`;
    const drawCalls = document.createElement('span');
    drawCalls.dataset.profilerDrawCalls = 'true';
    drawCalls.textContent = `Draw Calls ${Number(frame?.drawCalls || 0)}`;
    streams.append(memory, drawCalls);
    wrap.appendChild(streams);
    const profilerHistory = document.createElement('div');
    profilerHistory.className = 'profiler-history';
    profilerHistory.dataset.profilerHistory = 'true';
    for (const sample of (current.profilerHistory || []).slice(-24)) {
      const row = document.createElement('span');
      row.dataset.profilerHistoryFrame = String(sample.frame);
      row.textContent = `F${sample.frame} ${Number(sample.memoryMB || 0)}MB ${Number(sample.drawCalls || 0)} calls`;
      profilerHistory.appendChild(row);
    }
    wrap.appendChild(profilerHistory);
    return wrap;
  }
}

function createTextResolver(localization) {
  if (typeof localization?.t === 'function') {
    return (key, fallback) => {
      const value = localization.t(key);
      return value === key ? fallback : value;
    };
  }
  if (localization && typeof localization === 'object') {
    return (key, fallback) => localization[key] ?? fallback;
  }
  return (_key, fallback) => fallback;
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function cloneDatabase(database = {}) {
  return {
    tables: cloneState(database.tables || {}),
    lastUpdate: database.lastUpdate || null
  };
}

function normalizeProjectFilesState(projectFiles = {}) {
  if (!projectFiles || typeof projectFiles !== 'object' || Array.isArray(projectFiles)) return {};
  return Object.fromEntries(Object.entries(projectFiles).map(([filePath, content]) => [slash(filePath), String(content ?? '')]));
}

function normalizeGlobalSearchState(value = {}) {
  return {
    open: Boolean(value.open),
    query: value.query || '',
    replacement: value.replacement || '',
    results: Array.isArray(value.results) ? value.results.map((result) => ({ ...result })) : []
  };
}

function normalizeResourcePickerState(value = {}) {
  return {
    open: Boolean(value.open),
    field: value.field || null,
    query: value.query || ''
  };
}

function normalizePhysicsViewState(value = {}) {
  return {
    open: Boolean(value.open)
  };
}

function normalizePrefabHotEditState(value = {}) {
  return {
    prefabId: value.prefabId || null,
    patch: cloneState(value.patch || {}),
    dirty: Boolean(value.dirty),
    promptOpen: Boolean(value.promptOpen)
  };
}

function normalizeBuildSettingsState(value = {}) {
  const defaults = defaultBuildTargets();
  const targets = value.targets || {};
  const enabledTargets = Array.isArray(targets) ? new Set(targets) : null;
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
    budgets: normalizeBuildBudgetsState(value.budgets || value)
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

function normalizeBuildBudgetsState(value = {}) {
  return {
    maxBundleKb: Math.max(1, Number(value.maxBundleKb || 1024)),
    maxWechatBytes: Math.max(1, Number(value.maxWechatBytes || 4 * 1024 * 1024))
  };
}

function normalizeUILayoutState(uiLayout = {}) {
  const canvas = uiLayout.canvas || {};
  const elements = Array.isArray(uiLayout.elements) ? uiLayout.elements : [];
  return {
    format: 'OmniCore.UI_Layout',
    version: Number(uiLayout.version || 1),
    canvas: {
      width: Math.max(1, Number(canvas.width || uiLayout.width || 320)),
      height: Math.max(1, Number(canvas.height || uiLayout.height || 240))
    },
    elements: elements.map(normalizeUIElement)
  };
}

function normalizeUIElement(element = {}, index = 0) {
  const type = element.type || 'Button';
  return {
    type,
    id: String(element.id || `${type.toLowerCase()}-${index + 1}`),
    text: String(element.text ?? element.label ?? element.id ?? type),
    x: Number(element.x || 0),
    y: Number(element.y || 0),
    width: Math.max(1, Number(element.width || 160)),
    height: Math.max(1, Number(element.height || 40)),
    action: element.action || null
  };
}

function normalizeDatabaseRecords(records = {}) {
  if (Array.isArray(records)) return records.map((record) => ({ ...record }));
  return Object.values(records).map((record) => ({ ...record }));
}

function normalizeDatabaseInput(value, previousValue) {
  if (typeof previousValue === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : previousValue;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/u.test(String(value))) return Number(value);
  return value;
}

function parsePromptSize(prompt) {
  const match = String(prompt || '').match(/(\d+)\s*x\s*(\d+)/iu);
  if (!match) return {};
  return {
    width: Math.max(1, Number(match[1])),
    height: Math.max(1, Number(match[2]))
  };
}

function promptEntities(prompt) {
  const entities = [];
  if (/treasure|宝箱|chest/i.test(String(prompt || ''))) {
    entities.push({
      id: 'treasure',
      name: 'Treasure',
      type: 'sprite',
      texture: 'treasure',
      x: 32,
      y: 32,
      width: 16,
      height: 16
    });
  }
  return entities;
}

function normalizeGeneratedEntity(entity = {}, existingIds = new Set(), index = 0) {
  let id = entity.id || entity.name || `ai-entity-${index + 1}`;
  if (existingIds.has(id)) id = `${id}-${Date.now().toString(36)}`;
  return {
    id,
    name: entity.name || id,
    type: entity.type || 'entity',
    texture: entity.texture || entity.sprite || entity.type || null,
    sprite: entity.sprite || entity.texture || entity.type || null,
    x: Number(entity.x || 0),
    y: Number(entity.y || 0),
    width: Number(entity.width || 32),
    height: Number(entity.height || 32),
    tileWidth: entity.tileWidth,
    tileHeight: entity.tileHeight,
    data: Array.isArray(entity.data) ? [...entity.data] : entity.data,
    layer: entity.layer || null,
    rotation: Number(entity.rotation || 0),
    scale: Number(entity.scale ?? 1),
    scaleX: Number(entity.scaleX ?? entity.scale ?? 1),
    scaleY: Number(entity.scaleY ?? entity.scale ?? 1),
    components: Array.isArray(entity.components) ? cloneState(entity.components) : [],
    prefabId: entity.prefabId || null
  };
}

function createVisualGraph(flowGraph = {}) {
  const normalized = normalizeFlowGraph(flowGraph);
  const nodes = new Map(normalized.nodes.map((node) => [node.id, node]));
  const edges = normalized.edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to));
  return {
    nodes,
    edges,
    toEventSheet: () => flowGraphToEventSheet({ nodes: [...nodes.values()], edges })
  };
}

function flowGraphToEventSheet(flowGraph = {}) {
  const normalized = normalizeFlowGraph(flowGraph);
  const nodesById = new Map(normalized.nodes.map((node) => [node.id, node]));
  const edges = normalized.edges.filter((edge) => nodesById.has(edge.from) && nodesById.has(edge.to));
  const childrenBySource = new Map();
  for (const edge of edges) {
    if (!childrenBySource.has(edge.from)) childrenBySource.set(edge.from, []);
    childrenBySource.get(edge.from).push(nodesById.get(edge.to));
  }

  const targetedNodes = new Set(edges.map((edge) => edge.to));
  const rootNodes = normalized.nodes.filter((node) => (
    (isFlowEventNode(node) || isFlowConditionNode(node)) && !targetedNodes.has(node.id)
  ));
  const fallbackActionNodes = normalized.nodes.filter(isFlowActionNode);
  const events = rootNodes.length
    ? rootNodes.map((node) => buildFlowEventTree(node, childrenBySource))
    : [{
      name: 'root',
      scope: {},
      conditions: [],
      actions: fallbackActionNodes.map((node) => cloneState(node.data))
    }];

  return { events };
}

function flowGraphToBehaviorTree(flowGraph = {}) {
  const eventSheet = flowGraphToEventSheet(flowGraph);
  return {
    type: 'selector',
    children: eventSheet.events.map((event) => ({
      type: 'sequence',
      name: event.name,
      children: [
        ...event.conditions.map((condition) => ({ type: 'condition', condition: cloneState(condition) })),
        ...event.actions.map((action) => ({ type: 'action', action: cloneState(action) }))
      ]
    }))
  };
}

function buildFlowEventTree(root, childrenBySource) {
  if (isFlowEventNode(root)) {
    const children = childrenBySource.get(root.id) || [];
    const conditions = children
      .filter(isFlowConditionNode)
      .map((child) => buildFlowConditionNode(child, childrenBySource, new Set(), root.scope || {}))
      .filter(Boolean);
    const event = {
      name: root.label || root.id,
      scope: cloneState(root.scope || {}),
      conditions,
      actions: collectFlowActions(root, childrenBySource, new Set())
    };
    if (root.data?.when) event.when = cloneState(root.data.when);
    return event;
  }

  return {
    name: root.label || root.id,
    scope: cloneState(root.scope || {}),
    conditions: [buildFlowConditionNode(root, childrenBySource, new Set())].filter(Boolean),
    actions: collectFlowActions(root, childrenBySource, new Set())
  };
}

function buildFlowConditionNode(node, childrenBySource, visited, localScope = {}) {
  if (!node || visited.has(node.id)) return null;
  visited.add(node.id);
  const children = childrenBySource.get(node.id) || [];
  const nextScope = { ...localScope, ...(node.scope || {}) };
  const childConditionNodes = children.filter(isFlowConditionNode);
  const explicitOp = flowLogicalOp(node);

  if (explicitOp === 'not') {
    const [nextNode] = childConditionNodes;
    const nested = nextNode ? buildFlowConditionNode(nextNode, childrenBySource, visited, nextScope) : null;
    return nested ? { op: 'not', conditions: [nested], scope: nextScope } : null;
  }

  const childConditions = childConditionNodes
    .map((child) => buildFlowConditionNode(child, childrenBySource, visited, nextScope))
    .filter(Boolean);
  const candidate = normalizeFlowConditionData(node.data);

  if (candidate && explicitOp == null && childConditions.length === 0) {
    if (Object.keys(nextScope).length) candidate.scope = nextScope;
    return candidate;
  }
  if (childConditions.length === 0) return candidate || { op: 'truthy', left: true };

  if (explicitOp === 'or') return { op: 'or', conditions: childConditions, scope: nextScope };
  if (explicitOp === 'and' || childConditions.length > 1) return { op: 'and', conditions: childConditions, scope: nextScope };
  return { ...childConditions[0], scope: { ...(childConditions[0].scope || {}), ...nextScope } };
}

function collectFlowActions(node, childrenBySource, visited) {
  const actions = [];
  for (const child of childrenBySource.get(node.id) || []) {
    if (visited.has(child.id)) continue;
    visited.add(child.id);
    if (isFlowActionNode(child)) {
      actions.push(cloneState(child.data));
    } else {
      actions.push(...collectFlowActions(child, childrenBySource, visited));
    }
  }
  return actions;
}

function isFlowEventNode(node) {
  return node.type === 'event';
}

function isFlowConditionNode(node) {
  return node.type !== 'action' && node.type !== 'execution' && node.type !== 'event';
}

function isFlowActionNode(node) {
  return node.type === 'action' || node.type === 'execution';
}

function flowLogicalOp(node) {
  const configured = node?.data?.op || node?.type;
  return configured === 'and' || configured === 'or' || configured === 'not' ? configured : null;
}

function normalizeFlowConditionData(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.op) return cloneState(data);
  return { op: 'equals', left: data.left, right: data.right };
}

function snapPoint(point = {}, state = {}) {
  const rect = point.currentTarget?.getBoundingClientRect?.() || { left: 0, top: 0 };
  const tilemap = state.tilemap || {};
  const gridX = Math.max(1, Number(tilemap.tileWidth || tilemap.tilewidth || state.gridSize || 16));
  const gridY = Math.max(1, Number(tilemap.tileHeight || tilemap.tileheight || state.gridSize || 16));
  const rawX = Number(point.clientX ?? point.x ?? 0) - Number(rect.left || 0);
  const rawY = Number(point.clientY ?? point.y ?? 0) - Number(rect.top || 0);
  return {
    x: snapAxis(rawX, gridX),
    y: snapAxis(rawY, gridY)
  };
}

function snapEditorPoint(point = {}, state = {}) {
  const size = Math.max(1, Number(state.gridSnap?.size || state.gridSize || 16));
  const x = Number(point.x ?? point.clientX ?? 0);
  const y = Number(point.y ?? point.clientY ?? 0);
  if (state.gridSnap?.enabled) {
    return {
      x: Math.round(x / size) * size,
      y: Math.round(y / size) * size
    };
  }
  return { x, y };
}

function snapAxis(value, grid) {
  const snapped = Math.round(value / grid) * grid;
  return Math.abs(snapped - value) <= grid * 0.25 ? snapped : value;
}

function diffScenes(before = {}, after = {}) {
  const previous = firstEntityById(before.entities || []);
  const next = firstEntityById(after.entities || []);
  const added = [];
  const removed = [];
  const changed = [];
  for (const [id, entity] of next) {
    if (!previous.has(id)) {
      added.push(cloneState(entity));
      continue;
    }
    const fields = changedEntityFields(previous.get(id), entity);
    if (fields.length) changed.push({ id, fields, before: cloneState(previous.get(id)), after: cloneState(entity) });
  }
  for (const [id, entity] of previous) {
    if (!next.has(id)) removed.push(cloneState(entity));
  }
  return { added, removed, changed };
}

function firstEntityById(entities = []) {
  const map = new Map();
  for (const entity of entities) {
    const id = String(entity.id || entity.name || '');
    if (id && !map.has(id)) map.set(id, entity);
  }
  return map;
}

function changedEntityFields(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));
}

function isSpine25DNode(entity = {}) {
  const type = String(entity.type || entity.kind || '').toLowerCase();
  return type.includes('spine') || Boolean(entity.skeleton || entity.atlas?.endsWith?.('.atlas'));
}

function isDimension25DNode(entity = {}) {
  const type = String(entity.type || entity.kind || '').toLowerCase();
  return type.includes('dimension3d') || type.includes('3d') || Boolean(entity.model || entity.glb || entity.bounds?.depth);
}

function normalizeScene(scene = {}) {
  return {
    name: scene.name || 'untitled',
    entities: (scene.entities || []).map((entity, index) => ({
      ...entity,
      id: entity.id || entity.name || `entity-${index}`,
      name: entity.name || entity.id || `Entity ${index + 1}`,
      type: entity.type || 'entity',
      texture: entity.texture || entity.sprite || null,
      sprite: entity.sprite || entity.texture || null,
      x: Number(entity.x || 0),
      y: Number(entity.y || 0),
      width: Number(entity.width || 32),
      height: Number(entity.height || 32),
      rotation: Number(entity.rotation || 0),
      scale: Number(entity.scale ?? entity.scaleX ?? 1),
      scaleX: Number(entity.scaleX ?? entity.scale ?? 1),
      scaleY: Number(entity.scaleY ?? entity.scale ?? 1),
      components: Array.isArray(entity.components) ? cloneState(entity.components) : [],
      prefabId: entity.prefabId || null
    }))
  };
}

function create25DCoCreationEntity(plan = {}) {
  const placement = plan.placement || {};
  const intent = plan.intent || {};
  const relation = intent.placement?.relation || placement.relation || 'near';
  const anchor = intent.placement?.anchor || plan.occlusion?.[0]?.anchorId || null;
  const id = String(placement.entityId || `${anchor || 'scene'}-${intent.structure || 'structure'}`);
  const width = numberWithFallback(placement.width, intent.structure === 'tower' ? 48 : 64);
  const height = numberWithFallback(placement.height, intent.structure === 'tower' ? 112 : 64);
  const x = numberWithFallback(placement.x);
  const y = numberWithFallback(placement.y);
  const z = numberWithFallback(placement.z);
  const baselineY = numberWithFallback(placement.baselineY, y + height);
  return {
    id,
    name: labelFromId(id),
    type: 'dimension3d-model',
    x,
    y,
    z,
    width,
    height,
    position: { x, y, z },
    placement: {
      relation,
      anchor,
      baselineY,
      terrainSample: placement.terrainSample || null
    },
    assetTasks: cloneState(plan.assets || []),
    occlusion: cloneState(plan.occlusion || []),
    fakeShadow: cloneState(plan.shadows?.[0] || null),
    eventGraph: cloneState(plan.eventGraph || null),
    coCreated: true,
    coCreationProtocol: plan.protocol || null,
    coCreationPrompt: plan.prompt || '',
    coCreationPlan: cloneState(plan)
  };
}

function upsertEntity(entities = [], nextEntity = {}) {
  const nextId = String(nextEntity.id || '');
  let replaced = false;
  const updated = entities.map((entity) => {
    if (String(entity.id) !== nextId) return entity;
    replaced = true;
    return { ...entity, ...nextEntity };
  });
  return replaced ? updated : [...updated, nextEntity];
}

function sceneFileStem(scene = {}) {
  return slug(scene.name || 'scene');
}

function sceneSignature(scene = {}) {
  return JSON.stringify(normalizeScene(scene));
}

function entitySignature(entity = {}) {
  return JSON.stringify(cloneState(entity));
}

function entityBounds(entity = {}) {
  const width = Number(entity.width ?? entity.bounds?.width ?? 0);
  const height = Number(entity.height ?? entity.bounds?.height ?? 0);
  return {
    x: Number(entity.x ?? entity.position?.x ?? 0),
    y: Number(entity.y ?? entity.position?.y ?? 0),
    z: Number(entity.z ?? entity.position?.z ?? 0),
    width,
    height,
    baselineY: Number(entity.placement?.baselineY ?? (Number(entity.y ?? 0) + height))
  };
}

function formatSaveVersionDiff(diff) {
  if (!diff) return 'No save diff available.';
  const parts = [];
  if (diff.addedEntities.length) parts.push(`Added ${diff.addedEntities.map((entity) => entity.id).join(', ')}`);
  if (diff.removedEntities.length) parts.push(`Removed ${diff.removedEntities.map((entity) => entity.id).join(', ')}`);
  if (diff.changedEntities.length) parts.push(`Changed ${diff.changedEntities.map((entity) => entity.id).join(', ')}`);
  return parts.length ? parts.join(' | ') : 'No entity changes.';
}

function next25DProductionActions(blockers = [], warnings = []) {
  const actions = [];
  const actionByCode = {
    'cocreation-not-applied': 'Apply the 2.5D co-creation plan to the scene.',
    'scene-not-saved': 'Save a scene snapshot after applying 2.5D changes.',
    'build-target-missing': 'Enable at least one lightweight deployment target.',
    'deploy-manifest-incomplete': 'Export a lightweight deployment bundle with an entry scene.',
    'no-25d-cocreation': 'Create and apply a 2.5D co-creation plan before production review.'
  };
  for (const item of [...blockers, ...warnings]) {
    actions.push(actionByCode[item.code] || `Resolve ${item.code}.`);
  }
  return [...new Set(actions)];
}

function slug(value) {
  const text = String(value || 'scene')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-+|-+$/gu, '');
  return text || 'scene';
}

function labelFromId(value) {
  return String(value || 'Entity')
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function numberWithFallback(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeInspectorPatch(patch = {}) {
  const next = { ...patch };
  if (Object.prototype.hasOwnProperty.call(next, 'sprite')) next.texture = next.sprite;
  if (Object.prototype.hasOwnProperty.call(next, 'texture') && !Object.prototype.hasOwnProperty.call(next, 'sprite')) {
    next.sprite = next.texture;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'scale')) {
    next.scaleX = next.scale;
    next.scaleY = next.scale;
  }
  return next;
}

function formatComponents(components = []) {
  return components.map((component) => {
    if (typeof component === 'string') return component;
    return component.type || component.name || component.constructor?.name || 'Component';
  }).join(', ');
}

function normalizeFlowGraph(flowGraph = {}) {
  return {
    nodes: (flowGraph.nodes || []).map((node, index) => ({
      id: node.id || `node-${index + 1}`,
      type: node.type || 'action',
      label: node.label || node.id || `Node ${index + 1}`,
      x: Number(node.x || 0),
      y: Number(node.y || 0),
      scope: { ...(node.scope || {}) },
      data: { ...(node.data || {}) }
    })),
    edges: (flowGraph.edges || [])
      .filter((edge) => edge?.from && edge?.to)
      .map((edge) => ({ from: edge.from, to: edge.to }))
  };
}

function cloneTilemap(tilemap = {}) {
  const width = Number(tilemap.width || 16);
  const height = Number(tilemap.height || 12);
  const size = width * height;
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
      ...cloneState(rule),
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

function tilePalette(tilemap = {}) {
  return tilemap.tilesets.flatMap((tileset) => tileset.tiles);
}

function findActiveTileLayer(tilemap = {}) {
  return tilemap.layers.find((layer) => layer.id === tilemap.activeLayerId) || tilemap.layers[0];
}

function ruleTileMatches(rule, tileId, index, data, tilemap) {
  const self = Number(rule?.when?.self);
  if (Number.isFinite(self) && Number(tileId) !== self) return false;
  const adjacentAny = uniqueNumbers(rule?.when?.adjacentAny);
  if (!adjacentAny.length) return true;
  return neighborTileIds(index, data, tilemap).some((neighbor) => adjacentAny.includes(Number(neighbor)));
}

function neighborTileIds(index, data, tilemap) {
  const width = Math.max(1, Number(tilemap.width || 1));
  const height = Math.max(1, Number(tilemap.height || 1));
  const x = index % width;
  const y = Math.floor(index / width);
  const offsets = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 }
  ];
  return offsets
    .map((offset) => ({ x: x + offset.x, y: y + offset.y }))
    .filter((point) => point.x >= 0 && point.y >= 0 && point.x < width && point.y < height)
    .map((point) => data[point.y * width + point.x]);
}

function findTilesetTile(tilemap, tileId) {
  return tilePalette(tilemap || {}).find((tile) => Number(tile.id) === Number(tileId)) || null;
}

function isSolidTile(tilemap, tileId) {
  const tile = findTilesetTile(tilemap, tileId);
  const source = tilemap || {};
  return Boolean(tile?.solid || tile?.collision || (source.tilesets || []).some((tileset) => tileset.collisionTiles.includes(Number(tileId))));
}

function addCollision(tilemap, index) {
  if (!tilemap.collisions.includes(index)) tilemap.collisions.push(index);
}

function uniqueNumbers(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value)))];
}

function normalizeDockLayout(layout = {}) {
  const seen = new Set();
  const normalized = {};
  for (const region of DOCK_REGIONS) {
    const panels = Array.isArray(layout?.[region]) ? layout[region] : DEFAULT_DOCK_LAYOUT[region];
    normalized[region] = [];
    for (const panel of panels) {
      if (!PANEL_TITLES[panel] || seen.has(panel)) continue;
      seen.add(panel);
      normalized[region].push(panel);
    }
  }
  return normalized;
}

function ensurePanelInDock(layout, panelName, preferredRegion = 'bottom') {
  const normalized = normalizeDockLayout(layout);
  if (Object.values(normalized).some((panels) => panels.includes(panelName))) return normalized;
  const region = DOCK_REGIONS.includes(preferredRegion) ? preferredRegion : 'bottom';
  normalized[region] = [...(normalized[region] || []), panelName];
  return normalized;
}

function isSearchableProjectFile(filePath = '') {
  return /\.(js|mjs|cjs|ts|tsx|jsx|json|scene|prefab|md|css|html)$/iu.test(filePath)
    || /(^|\/)(src|assets|scenes|config)\//iu.test(filePath);
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function filterResourceAssets(assets = [], query = '') {
  const needle = String(query || '').toLowerCase();
  return (Array.isArray(assets) ? assets : [])
    .map(normalizeAssetEntry)
    .filter((asset) => ['image', 'prefab', 'json'].includes(asset.type))
    .filter((asset) => !needle || `${asset.path} ${asset.name}`.toLowerCase().includes(needle));
}

function physicsBodies(state = {}) {
  return (state.scene?.entities || [])
    .filter((entity) => entity.physics || entity.body || entity.collider)
    .map((entity) => {
      const body = entity.physics || entity.body || entity.collider || {};
      const vertices = Array.isArray(body.vertices) ? body.vertices.map((point) => ({
        x: Number(point.x || 0),
        y: Number(point.y || 0)
      })) : [];
      return {
        id: entity.id,
        shape: body.shape || body.type || 'rect',
        x: Number(entity.x || body.x || 0),
        y: Number(entity.y || body.y || 0),
        width: Number(entity.width || body.width || 32),
        height: Number(entity.height || body.height || 32),
        vertices
      };
    });
}

function findSelectedEntity(state) {
  return state.scene.entities.find((entity) => entity.id === state.selectedEntityId) || null;
}

function selectedIds(state = {}) {
  const ids = Array.isArray(state.selectedEntityIds) ? state.selectedEntityIds : [];
  const valid = new Set((state.scene?.entities || []).map((entity) => entity.id));
  const normalized = ids.filter((id) => valid.has(id));
  if (!normalized.length && state.selectedEntityId && valid.has(state.selectedEntityId)) normalized.push(state.selectedEntityId);
  return [...new Set(normalized)];
}

function resolveNextSelection(id, append, state = null) {
  if (!id) return [];
  const source = state || currentStateFallback();
  if (!append) return [id];
  const ids = selectedIds(source);
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function currentStateFallback() {
  return { scene: { entities: [] }, selectedEntityId: null, selectedEntityIds: [] };
}

function uniqueEntityId(base, existingIds) {
  let id = String(base || 'entity-copy');
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function pointerFromEvent(event = {}) {
  return {
    x: Number(event.clientX || 0),
    y: Number(event.clientY || 0)
  };
}

function normalizeRect(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function entityRect(entity = {}) {
  const left = Number(entity.x || 0);
  const top = Number(entity.y || 0);
  const width = Math.max(1, Number(entity.width || 32));
  const height = Math.max(1, Number(entity.height || 32));
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}

function rectsIntersect(left, right) {
  return left.left <= right.right
    && left.right >= right.left
    && left.top <= right.bottom
    && left.bottom >= right.top;
}

function parseFieldValue(key, value, previous = null) {
  if (!NUMERIC_FIELDS.has(key) && typeof previous !== 'number') return value;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function inspectorFields(entity = null) {
  const base = ['id', 'name', 'x', 'y', 'width', 'height', 'rotation', 'scale', 'scaleX', 'scaleY', 'sprite', 'texture'];
  if (!entity) return base;
  const blocked = new Set(['parent', 'game', 'displayObject']);
  const fields = [...base];
  for (const [key, value] of Object.entries(entity)) {
    if (blocked.has(key) || key.startsWith('__') || fields.includes(key)) continue;
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) fields.push(key);
  }
  return fields;
}

function createCommandId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveScriptBinding(entity = null, symbol = null, options = {}) {
  if (!entity) return null;
  const source = entity.script || entity.behaviorScript || entity.controller || entity.code || null;
  const script = typeof source === 'string' ? { path: source } : source;
  const path = script?.path || script?.file || script?.url || script?.src || entity.scriptPath || entity.scriptFile;
  if (!path) return null;
  return {
    path,
    symbol: symbol || script.entry || script.symbol || script.method || script.function || entity.scriptEntry || 'update',
    line: Number(script.line || entity.scriptLine || 1),
    column: Number(script.column || entity.scriptColumn || 1),
    editor: options.editor || script.editor || entity.codeEditor || 'vscode'
  };
}

function normalizeWorkspaceState(value = {}) {
  if (!value || typeof value !== 'object') {
    return { root: null, name: null, directories: [], assets: [], sourceFiles: [], scenes: [] };
  }
  return {
    root: value.root || null,
    name: value.name || null,
    directories: Array.isArray(value.directories) ? value.directories : [],
    assets: Array.isArray(value.assets) ? value.assets.map(normalizeAssetEntry) : [],
    sourceFiles: Array.isArray(value.sourceFiles) ? value.sourceFiles.map(normalizeAssetEntry) : [],
    scenes: Array.isArray(value.scenes) ? value.scenes.map(normalizeAssetEntry) : [],
    scannedAt: value.scannedAt || null
  };
}

function normalizeAutoSaveState(value = {}) {
  return {
    enabled: value.enabled !== false,
    intervalMs: Math.max(1000, Number(value.intervalMs || 300000)),
    lastSavedAt: value.lastSavedAt || null,
    lastPath: value.lastPath || null
  };
}

function normalizeAssetEntry(asset = {}) {
  const source = typeof asset === 'string' ? { path: asset } : { ...asset };
  const assetPath = slash(source.path || source.url || source.name || '');
  return {
    ...source,
    path: assetPath,
    name: source.name || assetPath.split('/').pop() || assetPath,
    type: assetType(source)
  };
}

function isPrefabAsset(asset) {
  const entry = normalizeAssetEntry(asset);
  return entry.type === 'prefab' || /(^|\/)prefabs\/.+\.json$/iu.test(entry.path);
}

function assetType(asset = {}) {
  const entryPath = slash(typeof asset === 'string' ? asset : asset.path || asset.url || asset.name || '');
  const explicit = typeof asset === 'object' ? asset.type : null;
  if (explicit) return explicit;
  if (/(^|\/)prefabs\/.+\.json$/iu.test(entryPath)) return 'prefab';
  if (/(^|\/)scenes\/.+\.json$/iu.test(entryPath) || /\.scene\.json$/iu.test(entryPath)) return 'scene';
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(entryPath)) return 'image';
  if (/\.json$/iu.test(entryPath)) return 'json';
  return 'file';
}

function isSceneAsset(asset = {}) {
  const entryPath = slash(typeof asset === 'string' ? asset : asset.path || asset.url || asset.name || '');
  return assetType(asset) === 'scene' || /(^|\/)scenes\/.+\.json$/iu.test(entryPath) || /\.scene\.json$/iu.test(entryPath);
}

function isAssetReferenceField(field, value) {
  if (typeof value !== 'string' || !value) return false;
  if (!/(^|\/)(assets|sprites|audio|textures|ui|scenes)\//iu.test(value)) return false;
  return /^(texture|sprite|image|asset|source|normalMap|atlas|audio|scene|background)$/iu.test(field)
    || /asset|texture|image|sprite|map|scene|source/iu.test(field);
}

function assetIcon(asset = {}) {
  const type = assetType(asset);
  if (type === 'prefab') return 'Prefab';
  if (type === 'image') return 'Image';
  if (type === 'scene') return 'Scene';
  if (type === 'script') return 'Script';
  return 'File';
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}

const EDITOR_CSS = `
  body { margin: 0; background: #111827; color: #e5e7eb; font: 12px system-ui, sans-serif; }
  .editor-frame { display: grid; grid-template-rows: 40px minmax(0, 1fr) 24px; height: 100vh; background: #111827; }
  .editor-toolbar { display: flex; gap: 6px; align-items: center; padding: 6px 8px; border-bottom: 1px solid rgba(148,163,184,.28); background: #0b1120; }
  .editor-toolbar button { min-width: 56px; padding: 5px 8px; }
  .editor-toolbar button::before { content: attr(data-editor-icon); display: inline-grid; place-items: center; width: 18px; height: 18px; margin-right: 5px; border-radius: 4px; background: rgba(56,189,248,.14); color: #93c5fd; font-size: 9px; text-transform: uppercase; }
  .editor-shell { display: grid; grid-template-columns: 240px minmax(320px, 1fr) 300px; grid-template-rows: minmax(0, 1fr) 220px; min-height: 0; }
  .dock-region { display: grid; gap: 0; min-width: 0; min-height: 0; overflow: hidden; }
  .dock-left { grid-column: 1; grid-row: 1 / span 2; grid-template-rows: minmax(0, 1.2fr) minmax(0, .9fr) minmax(0, .9fr); }
  .dock-center { grid-column: 2; grid-row: 1; }
  .dock-right { grid-column: 3; grid-row: 1 / span 2; }
  .dock-bottom { grid-column: 2; grid-row: 2; grid-template-rows: minmax(64px, .6fr) minmax(96px, 1fr); }
  .editor-panel { min-width: 0; min-height: 0; border: 1px solid rgba(148,163,184,.28); padding: 10px; overflow: auto; background: #0f172a; }
  .scene-view { background: #172033; }
  .animation-timeline { background: #111827; }
  .editor-statusbar { display: flex; align-items: center; padding: 0 8px; border-top: 1px solid rgba(148,163,184,.28); color: #94a3b8; background: #0b1120; }
  h2 { margin: 0 0 8px; font-size: 12px; letter-spacing: 0; }
  button { color: #e5e7eb; background: #111827; border: 1px solid #334155; cursor: pointer; }
  button.selected { border-color: #22d3ee; background: #164e63; }
  label { display: grid; grid-template-columns: 76px 1fr; gap: 8px; margin: 6px 0; }
  input { background: #020617; color: #e5e7eb; border: 1px solid #334155; padding: 5px; min-width: 0; }
  .hierarchy-list { margin: 0; padding-left: 18px; }
  .hierarchy-list button, .prefab-list button, .asset-list button { width: 100%; margin-bottom: 5px; padding: 6px; text-align: left; }
  .scene-wrap { display: grid; grid-template-rows: auto auto 1fr auto; height: 100%; gap: 8px; }
  .scene-tabs { display: flex; gap: 4px; min-height: 24px; overflow-x: auto; }
  .scene-tabs button { flex: 0 0 auto; max-width: 150px; padding: 4px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gizmo-toolbar, .tilemap-toolbar { display: flex; gap: 6px; align-items: center; }
  .gizmo-toolbar button, .tilemap-toolbar button { padding: 5px 8px; }
  .scene-canvas { position: relative; min-height: 260px; height: 100%; overflow: hidden; background-image: linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px); background-size: 24px 24px; }
  .editor-onboarding { position: absolute; inset: 16px auto auto 16px; display: grid; gap: 6px; max-width: 340px; padding: 10px 12px; border: 1px solid rgba(56,189,248,.42); background: rgba(2,6,23,.86); color: #dbeafe; box-shadow: 0 12px 28px rgba(2,6,23,.36); }
  .editor-onboarding strong { color: #f8fafc; }
  .scene-node { position: absolute; display: grid; place-items: center; overflow: hidden; padding: 0 4px; border: 1px solid #38bdf8; background: #082f49; font-size: 11px; transform-origin: center; }
  .scene-node.selected { outline: 2px solid #facc15; }
  .scene-node.issue-target { box-shadow: 0 0 0 3px rgba(248,113,113,.78), 0 0 18px rgba(248,113,113,.42); }
  .selection-outline { position: absolute; box-sizing: border-box; pointer-events: none; border: 2px solid rgba(250,204,21,.86); background: rgba(250,204,21,.14); box-shadow: 0 0 0 1px rgba(15,23,42,.72), 0 0 18px rgba(250,204,21,.22); }
  .origin-marker { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; pointer-events: none; border-radius: 999px; border: 2px solid #f8fafc; background: #ef4444; box-shadow: 0 0 0 2px rgba(15,23,42,.72); }
  .transform-gizmo { position: absolute; z-index: 8; display: grid; grid-template-columns: repeat(3, 24px); gap: 4px; pointer-events: auto; }
  .gizmo-axis { width: 24px; height: 24px; padding: 0; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .gizmo-x { color: #fecaca; border-color: #ef4444; background: #450a0a; }
  .gizmo-y { color: #bbf7d0; border-color: #22c55e; background: #052e16; }
  .gizmo-z { color: #bfdbfe; border-color: #3b82f6; background: #172554; }
  .prefab-preview-model { position: absolute; display: grid; place-items: center; box-sizing: border-box; border: 1px dashed #facc15; background: rgba(250,204,21,.24); color: #fef3c7; font-size: 11px; pointer-events: none; }
  .selection-marquee { position: absolute; box-sizing: border-box; pointer-events: none; border: 1px dashed #67e8f9; background: rgba(34,211,238,.12); }
  .collision-overlay { position: absolute; box-sizing: border-box; pointer-events: none; border: 1px dashed rgba(248,113,113,.95); background: rgba(127,29,29,.18); }
  .depth-overlay { position: absolute; pointer-events: none; padding: 1px 4px; border: 1px solid #a3e635; background: rgba(20,83,45,.86); color: #dcfce7; font-size: 10px; }
  .undo-history { display: grid; gap: 3px; max-height: 72px; overflow: auto; padding: 5px; border: 1px solid #334155; background: #020617; color: #cbd5e1; }
  .undo-history div.selected { color: #facc15; }
  .floating-editor-panel { position: absolute; right: 12px; z-index: 22; display: grid; gap: 8px; width: min(360px, calc(100% - 24px)); max-height: calc(100vh - 88px); overflow: auto; padding: 10px; border: 1px solid #38bdf8; background: #020617; box-shadow: 0 18px 44px rgba(2,6,23,.48); }
  .floating-editor-panel h3 { margin: 0; font-size: 12px; color: #bfdbfe; }
  .production-25d-panel { top: 54px; }
  .production-25d-score { font-size: 20px; color: #ecfeff; }
  .production-25d-stages { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
  .production-25d-stage { min-height: 26px; display: grid; place-items: center; padding: 4px; border: 1px solid #334155; color: #cbd5e1; font-size: 10px; text-align: center; }
  .production-25d-stage-complete { border-color: #22c55e; color: #bbf7d0; background: rgba(20,83,45,.38); }
  .production-25d-stage-blocked { border-color: #f59e0b; color: #fde68a; background: rgba(120,53,15,.38); }
  .production-25d-action { margin: 0; color: #94a3b8; }
  .production-25d-visual { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; color: #bfdbfe; font-size: 11px; }
  .production-25d-visual-chip { padding: 2px 5px; border: 1px solid #2563eb; background: rgba(30,64,175,.3); color: #dbeafe; }
  .save-version-panel { display: grid; gap: 5px; padding-top: 6px; border-top: 1px solid #334155; }
  .save-version-panel h4 { margin: 0; font-size: 12px; color: #ecfeff; }
  .save-version-diff { margin: 0; color: #bfdbfe; font-size: 11px; }
  .save-version-list { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
  .save-version-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px; align-items: center; min-height: 26px; color: #cbd5e1; font-size: 11px; }
  .save-version-list button { min-height: 24px; padding: 2px 6px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; }
  .authoring-health-panel { top: 54px; left: 12px; right: auto; }
  .authoring-health-counts { color: #bfdbfe; }
  .authoring-health-issues, .authoring-health-hotspots { display: grid; gap: 4px; }
  .authoring-health-error, .authoring-health-critical { padding: 5px; border-left: 3px solid #f87171; background: rgba(127,29,29,.28); color: #fecaca; }
  .authoring-health-warning { padding: 5px; border-left: 3px solid #facc15; background: rgba(113,63,18,.28); color: #fef3c7; }
  .particle-editor { top: 54px; }
  .sprite-editor { top: 54px; right: 388px; }
  .particle-preview { position: relative; height: 112px; overflow: hidden; border: 1px solid #334155; background: radial-gradient(circle at 50% 72%, rgba(248,113,113,.28), transparent 42%), #111827; }
  .particle-preview i { position: absolute; width: 8px; height: 8px; margin: -4px; border-radius: 999px; background: #facc15; box-shadow: 0 0 14px rgba(250,204,21,.78); }
  .sprite-edit-canvas { position: relative; height: 160px; border: 1px solid #334155; background: #111827; background-image: linear-gradient(45deg, rgba(148,163,184,.16) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,.16) 25%, transparent 25%); background-size: 18px 18px; }
  .nine-slice-guide { position: absolute; padding: 0; border: 0; background: #22d3ee; }
  .guide-left, .guide-right { top: 0; width: 2px; height: 100%; }
  .guide-top, .guide-bottom { left: 0; width: 100%; height: 2px; }
  .collider-outline { position: absolute; inset: 12px; border: 2px dashed #a3e635; background: rgba(163,230,53,.08); }
  .material-panel { display: grid; gap: 6px; margin: 8px 0; padding: 8px; border: 1px solid #334155; }
  .material-panel legend { color: #bfdbfe; }
  .prefab-override-panel { display: grid; gap: 4px; margin-top: 8px; padding: 8px; border: 1px solid #334155; background: #020617; }
  .prefab-override-panel h3 { margin: 0 0 4px; font-size: 12px; color: #facc15; }
  .prefab-override-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 5px; align-items: center; padding: 5px; border-left: 3px solid #facc15; background: rgba(250,204,21,.12); font-weight: 700; }
  .prefab-override-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .prefab-override-row button { padding: 3px 6px; font-weight: 400; }
  .command-palette { position: absolute; top: 48px; left: 50%; z-index: 20; display: grid; grid-template-columns: minmax(180px, 1fr) auto auto; gap: 6px; width: min(640px, calc(100% - 32px)); transform: translateX(-50%); padding: 8px; border: 1px solid #38bdf8; background: #020617; box-shadow: 0 18px 44px rgba(2,6,23,.48); }
  .scene-validation { position: absolute; right: 12px; bottom: 32px; z-index: 18; display: grid; gap: 4px; max-width: 320px; padding: 8px; border: 1px solid #f87171; background: #450a0a; }
  .scene-validation button { text-align: left; }
  .tilemap-wrap { display: grid; gap: 8px; }
  .tilemap-grid { display: grid; gap: 2px; }
  .tilemap-grid button { width: 24px; height: 24px; padding: 0; font-size: 10px; }
  .tilemap-grid button.collision { background: #7f1d1d; border-color: #f87171; }
  .flow-graph-wrap { display: grid; grid-template-columns: minmax(260px, 1fr) 220px; grid-template-rows: auto minmax(120px, 1fr); gap: 8px; min-height: 0; }
  .flow-toolbar { grid-column: 1 / -1; display: flex; gap: 6px; align-items: center; }
  .flow-toolbar button { padding: 5px 8px; }
  .flow-canvas { position: relative; min-height: 132px; overflow: auto; border: 1px solid #334155; background: #111827; background-image: radial-gradient(#334155 1px, transparent 1px); background-size: 18px 18px; }
  .flow-node { position: absolute; min-width: 96px; min-height: 36px; padding: 6px 8px; border-radius: 4px; text-align: center; white-space: nowrap; }
  .flow-event { background: #1e3a8a; border-color: #60a5fa; }
  .flow-condition { background: #164e63; border-color: #22d3ee; }
  .flow-action { background: #365314; border-color: #a3e635; }
  .flow-edge-list { display: grid; align-content: start; gap: 4px; min-height: 0; overflow: auto; padding: 6px; border: 1px solid #334155; background: #020617; color: #cbd5e1; }
  .flow-preview { grid-column: 1 / -1; min-height: 72px; max-height: 140px; overflow: auto; margin: 0; padding: 8px; border: 1px solid #334155; background: #020617; color: #bfdbfe; }
  .graph-editor-wrap { display: grid; grid-template-columns: 96px minmax(260px, 1fr); gap: 8px; min-height: 0; }
  .graph-node-palette { display: grid; align-content: start; gap: 6px; }
  .graph-node-palette button { padding: 5px 8px; text-align: left; }
  .graph-editor-wrap .flow-graph-wrap { grid-template-columns: minmax(240px, 1fr) 180px; }
  .graph-editor-wrap pre { grid-column: 1 / -1; max-height: 120px; overflow: auto; margin: 0; padding: 8px; border: 1px solid #334155; background: #020617; color: #bfdbfe; }
  .ui-editor-wrap { display: grid; grid-template-columns: 96px minmax(220px, 1fr); gap: 8px; min-height: 0; }
  .ui-palette { display: grid; align-content: start; gap: 6px; }
  .ui-palette button { padding: 5px 8px; text-align: left; }
  .ui-canvas { position: relative; max-width: 100%; overflow: hidden; border: 1px solid #334155; background: #111827; background-image: linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px); background-size: 16px 16px; }
  .ui-element { position: absolute; display: grid; place-items: center; padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-color: #22d3ee; background: #164e63; }
  .ui-editor-wrap pre { grid-column: 1 / -1; max-height: 120px; overflow: auto; margin: 0; padding: 8px; border: 1px solid #334155; background: #020617; color: #bfdbfe; }
  .global-search-wrap { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr) auto; gap: 6px; min-height: 0; }
  .global-search-results { grid-column: 1 / -1; display: grid; align-content: start; gap: 4px; min-height: 0; overflow: auto; }
  .global-search-results button { padding: 5px 8px; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
  .resource-picker { top: 54px; left: 50%; right: auto; transform: translateX(-50%); }
  .resource-picker-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; max-height: 320px; overflow: auto; }
  .resource-picker-list button { display: grid; gap: 4px; min-height: 88px; padding: 6px; overflow: hidden; text-align: left; }
  .resource-picker-list img { width: 100%; height: 52px; object-fit: contain; background: #111827; }
  .prefab-hot-edit-prompt { top: 54px; }
  .physics-view-wrap { display: grid; gap: 8px; min-height: 0; }
  .physics-debug-canvas { position: relative; min-height: 260px; overflow: hidden; border: 1px solid #334155; background: #020617; background-image: linear-gradient(rgba(148,163,184,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.12) 1px, transparent 1px); background-size: 24px 24px; }
  .physics-wireframe { position: absolute; box-sizing: border-box; display: grid; place-items: center; border: 2px solid rgba(34,211,238,.88); background: rgba(34,211,238,.14); color: #cffafe; font-size: 10px; }
  .build-settings-wrap { display: grid; gap: 7px; }
  .build-target-row { grid-template-columns: 20px 1fr; align-items: center; margin: 0; }
  .build-settings-wrap pre { max-height: 160px; overflow: auto; margin: 0; padding: 8px; border: 1px solid #334155; background: #020617; color: #bfdbfe; }
  .timeline { display: grid; gap: 8px; }
  .timeline-clips, .easing-presets { display: flex; flex-wrap: wrap; gap: 5px; }
  .timeline-clips button, .easing-presets button { padding: 4px 7px; }
  .animation-curve-graph { position: relative; min-height: 96px; padding: 8px; border: 1px solid #334155; background: linear-gradient(90deg, rgba(148,163,184,.16) 1px, transparent 1px), linear-gradient(rgba(148,163,184,.16) 1px, transparent 1px), #020617; background-size: 24px 24px; }
  .bezier-handle { position: absolute; width: 9px; height: 9px; margin: -4px; border-radius: 999px; background: #facc15; box-shadow: 0 0 0 2px rgba(250,204,21,.22); }
  .handle-out { background: #22d3ee; }
  .animation-event-track { display: grid; gap: 4px; }
  .animation-event-marker { padding: 4px 6px; border-left: 3px solid #a3e635; background: rgba(22,101,52,.38); color: #dcfce7; }
  .asset-preview { margin-top: 8px; padding: 8px; border: 1px solid #334155; background: #020617; }
  .asset-preview img { display: block; max-width: 100%; max-height: 180px; object-fit: contain; background: #111827; }
  .asset-preview pre { max-height: 180px; overflow: auto; margin: 0; color: #bfdbfe; }
  .database-wrap { display: grid; gap: 8px; }
  .database-wrap table { width: 100%; border-collapse: collapse; }
  .database-wrap caption { text-align: left; color: #bfdbfe; margin-bottom: 4px; }
  .database-wrap td { padding: 3px; border: 1px solid #1e293b; }
  .database-wrap input { width: 100%; box-sizing: border-box; }
  .ai-assistant-wrap { display: grid; gap: 8px; }
  .ai-assistant-wrap button { width: max-content; padding: 5px 8px; }
  .profiler-wrap { display: grid; gap: 5px; }
  .profiler-flamegraph { display: grid; gap: 4px; padding: 6px; border: 1px solid #334155; background: #020617; }
  .profiler-row { display: grid; grid-template-columns: 132px 1fr 56px; gap: 6px; align-items: center; }
  .profiler-row b { display: inline-block; height: 8px; background: #38bdf8; }
  .profiler-streams { display: flex; gap: 12px; color: #cbd5e1; }
  .profiler-history { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; color: #94a3b8; }
  .profiler-history span { flex: 0 0 auto; padding: 2px 5px; border: 1px solid #334155; background: #020617; }
`;

if (typeof document !== 'undefined') {
  const root = document.querySelector('#app');
  if (root) createEditorApp(root);
}

export { createEditorState };
export default createEditorApp;
