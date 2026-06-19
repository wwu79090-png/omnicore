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
  profiler: 'Profiler'
};

const NUMERIC_FIELDS = new Set(['x', 'y', 'width', 'height', 'rotation', 'scale', 'scaleX', 'scaleY', 'alpha']);
const DOCK_REGIONS = ['left', 'center', 'right', 'bottom'];
const DEFAULT_DOCK_LAYOUT = {
  left: ['hierarchy', 'prefabs', 'assets'],
  center: ['scene-view'],
  right: ['inspector'],
  bottom: ['animation-timeline', 'tilemap', 'flow-graph', 'profiler']
};
const TOOLBAR_ACTIONS = [
  { id: 'save', label: 'Save', shortcut: 'Ctrl+S' },
  { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z' },
  { id: 'play', label: 'Play' },
  { id: 'pause', label: 'Pause' },
  { id: 'dock-reset', label: 'Reset Dock' }
];

export function createEditorApp(root = document.querySelector('#app'), {
  state = createEditorState(),
  syncUrl = null,
  transport = null,
  localization = null
} = {}) {
  let current = createEditorState(state);
  let dragSession = null;
  let tilePaintSession = false;
  let history = [cloneState(current)];
  let historyIndex = 0;
  const t = createTextResolver(localization);
  const ownerWindow = root.ownerDocument?.defaultView || globalThis.window;
  root.className = 'omnicore-desktop-editor';
  root.innerHTML = `
    <style>${EDITOR_CSS}</style>
    <div class="editor-frame">
      <nav class="editor-toolbar" data-editor-toolbar aria-label="Editor toolbar"></nav>
      <div class="editor-shell" data-dock-layout></div>
      <footer class="editor-statusbar" data-editor-statusbar></footer>
    </div>
  `;
  const toolbar = root.querySelector('[data-editor-toolbar]');
  const shell = root.querySelector('.editor-shell');
  const statusbar = root.querySelector('[data-editor-statusbar]');
  const client = syncUrl ? new LiveSyncClient({ url: syncUrl, onState: (next) => update(next) }).connect() : null;

  const api = {
    update,
    getState: () => current,
    getDockLayout: () => cloneState(current.dockLayout),
    setDockLayout,
    movePanelToRegion,
    EditorAPI: createEditorAPI(),
    undo,
    redo,
    saveSnapshot,
    exportTiledJson,
    exportFlowGraphEventSheet,
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
  update(current);
  return api;

  function update(next = current) {
    current = createEditorState({
      ...current,
      ...next,
      scene: normalizeScene(next.scene || current.scene),
      tilemap: next.tilemap || current.tilemap,
      flowGraph: normalizeFlowGraph(next.flowGraph || current.flowGraph),
      prefabs: next.prefabs || current.prefabs,
      assets: next.assets || current.assets,
      playState: next.playState || current.playState,
      profilerFrame: next.profilerFrame || current.profilerFrame,
      database: next.database || current.database,
      lastCommandError: next.lastCommandError || current.lastCommandError,
      dockLayout: normalizeDockLayout(next.dockLayout || current.dockLayout)
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
      profiler: renderPanel('profiler', renderProfiler())
    };
    for (const region of DOCK_REGIONS) {
      const regionNode = document.createElement('div');
      regionNode.className = `dock-region dock-${region}`;
      regionNode.dataset.dockRegion = region;
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
    return current;
  }

  function setDockLayout(layout = DEFAULT_DOCK_LAYOUT) {
    current = { ...current, dockLayout: normalizeDockLayout(layout) };
    emit('editor:dock-layout', current.dockLayout);
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
    update(current);
    return current.dockLayout;
  }

  function pushHistory(next) {
    const snapshot = cloneState(next);
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot);
    if (history.length > 100) history.shift();
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
    const snapshot = {
      name,
      version: 1,
      savedAt: new Date().toISOString(),
      scene: cloneState(current.scene),
      tilemap: cloneState(current.tilemap),
      prefabs: cloneState(current.prefabs),
      assets: cloneState(current.assets)
    };
    emit('editor:save-snapshot', snapshot);
    return snapshot;
  }

  function destroy() {
    ownerWindow?.removeEventListener?.('mousemove', onPointerMove);
    ownerWindow?.removeEventListener?.('mouseup', onPointerUp);
    ownerWindow?.removeEventListener?.('keydown', onKeyDown);
    client?.close?.();
    if (ownerWindow?.OmniCore?.EditorAPI === api.EditorAPI) delete ownerWindow.OmniCore.EditorAPI;
    root.textContent = '';
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
        const variant = {
          ...cloneState(prefab),
          ...cloneState(overrides),
          id: options.id || overrides.id || `${prefab.id || prefab.name}-variant`,
          extends: prefab.id || prefab.name
        };
        current = { ...current, prefabs: [...current.prefabs, variant] };
        emit('editor:create-prefab-variant', variant);
        pushHistory(current);
        update(current);
        return variant;
      },
      generateWithAI(prompt, options = {}) {
        return generateWithAI(prompt, options);
      }
    };
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
    pushHistory(current);
    update(current);
    return entities.find((entity) => entity.id === id) || null;
  }

  function selectEntity(id) {
    current = { ...current, selectedEntityId: id };
    emit('editor:select-entity', { id });
    emit('editor:highlight-entity', { id });
    update(current);
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
    pushHistory(current);
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
    pushHistory(current);
    update(current);
    return record;
  }

  function persistDatabaseConfig(tables) {
    const payload = {
      path: 'config/db.json',
      tables: cloneState(tables)
    };
    const bridge = ownerWindow?.omnicoreEditor;
    if (typeof bridge?.saveDatabaseConfig === 'function') {
      bridge.saveDatabaseConfig(payload);
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
    pushHistory(current);
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
    pushHistory(current);
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
    pushHistory(current);
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
    return createVisualGraph(current.flowGraph).toEventSheet();
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
    pushHistory(current);
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

  function onPointerMove(event) {
    if (!dragSession) return;
    const patch = transformPatch(current.gizmoMode, event);
    if (patch) {
      patchEntity(dragSession.id, patch);
      emit('editor:simulate-step', { id: dragSession.id, patch, physics: true, logic: true });
    }
  }

  function onPointerUp() {
    tilePaintSession = false;
    if (dragSession) {
      emit('editor:simulate-stop', { id: dragSession.id });
      current = { ...current, simulation: { active: false, physics: false, logic: false } };
      update(current);
    }
    dragSession = null;
  }

  function onKeyDown(event) {
    const key = String(event.key || '').toLowerCase();
    const modes = {
      q: 'select',
      w: 'translate',
      e: 'rotate',
      r: 'scale'
    };
    if (!event.ctrlKey && !event.metaKey && modes[key]) {
      event.preventDefault?.();
      setGizmoMode(modes[key]);
      return;
    }
    const command = event.ctrlKey || event.metaKey;
    if (!command) return;
    if (key === 's') {
      event.preventDefault?.();
      saveSnapshot('keyboard');
    }
    if (key === 'z' && event.shiftKey) {
      event.preventDefault?.();
      redo();
    } else if (key === 'z') {
      event.preventDefault?.();
      undo();
    }
  }

  function runToolbarAction(action) {
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
    if (action === 'dock-reset') {
      emit('editor:dock-reset', DEFAULT_DOCK_LAYOUT);
      return setDockLayout(DEFAULT_DOCK_LAYOUT);
    }
    return null;
  }

  function renderToolbar() {
    toolbar.textContent = '';
    for (const action of TOOLBAR_ACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.editorTool = action.id;
      button.dataset.editorAction = action.id;
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
  }

  function renderPanel(name, body) {
    const section = document.createElement('section');
    section.dataset.panel = name;
    section.dataset.dockPanel = name;
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
    for (const entity of current.scene.entities) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.editorEntityId = entity.id;
      button.textContent = entity.name || entity.id;
      button.className = entity.id === current.selectedEntityId ? 'selected' : '';
      button.addEventListener('click', () => selectEntity(entity.id));
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

  function renderSceneView() {
    const wrap = document.createElement('div');
    wrap.className = 'scene-wrap';
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
    view.addEventListener('dragover', (event) => event.preventDefault());
    view.addEventListener('drop', (event) => {
      event.preventDefault();
      const assetPath = event.dataTransfer?.getData('application/x-omnicore-asset');
      const prefabId = event.dataTransfer?.getData('application/x-omnicore-prefab')
        || (!assetPath ? event.dataTransfer?.getData('text/plain') : '');
      if (assetPath) instantiateAsset(assetPath, event);
      else instantiatePrefab(prefabId, event);
    });

    for (const entity of current.scene.entities) view.appendChild(createSceneNodeButton(entity));
    wrap.append(gizmoToolbar, view);
    return wrap;
  }

  function createSceneNodeButton(entity) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `scene-node${entity.id === current.selectedEntityId ? ' selected' : ''}`;
    node.dataset.sceneNodeId = entity.id;
    node.textContent = entity.name || entity.id;
    node.style.left = `${entity.x || 0}px`;
    node.style.top = `${entity.y || 0}px`;
    node.style.width = `${Math.max(24, entity.width || 32)}px`;
    node.style.height = `${Math.max(24, entity.height || 32)}px`;
    node.style.transform = `rotate(${entity.rotation || 0}rad) scale(${entity.scaleX ?? 1}, ${entity.scaleY ?? 1})`;
    node.addEventListener('click', () => selectEntity(entity.id));
    node.addEventListener('mousedown', (event) => {
      event.preventDefault();
      selectEntity(entity.id);
      dragSession = { id: entity.id };
      current = { ...current, simulation: { active: true, physics: true, logic: true } };
      emit('editor:simulate-start', { id: entity.id, physics: true, logic: true });
      update(current);
    });
    return node;
  }

  function renderPrefabs() {
    const list = document.createElement('div');
    list.className = 'prefab-list';
    for (const prefab of current.prefabs) {
      list.appendChild(createPrefabButton(prefab));
    }
    return list;
  }

  function createPrefabButton(prefab) {
    const button = document.createElement('button');
    button.type = 'button';
    button.draggable = true;
    button.dataset.prefabId = prefab.id || prefab.name;
    button.textContent = prefab.name || prefab.id;
    button.addEventListener('click', () => {
      current = { ...current, selectedPrefabId: prefab.id || prefab.name };
      update(current);
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
      button.textContent = assetPath.split('/').pop() || assetPath;
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('application/x-omnicore-asset', assetPath);
        event.dataTransfer?.setData('text/plain', assetPath);
      });
      list.appendChild(button);
    }
    return list;
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
    timeline.textContent = Object.keys(current.animations || {}).join(', ') || t('timeline.noClips', 'No clips');
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
      button.className = `flow-node flow-${node.type}`;
      button.dataset.flowNodeId = node.id;
      button.style.left = `${Number(node.x || 0)}px`;
      button.style.top = `${Number(node.y || 0)}px`;
      button.textContent = node.label || node.id;
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
      wrap.appendChild(row);
    }
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

function snapAxis(value, grid) {
  const snapped = Math.round(value / grid) * grid;
  return Math.abs(snapped - value) <= grid * 0.25 ? snapped : value;
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
    tilesets: normalizeTilesets(tilemap.tilesets || (tilemap.tileset ? [tilemap.tileset] : []), tilemap)
  };
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

function findTilesetTile(tilemap = {}, tileId) {
  return tilePalette(tilemap).find((tile) => Number(tile.id) === Number(tileId)) || null;
}

function isSolidTile(tilemap = {}, tileId) {
  const tile = findTilesetTile(tilemap, tileId);
  return Boolean(tile?.solid || tile?.collision || tilemap.tilesets.some((tileset) => tileset.collisionTiles.includes(Number(tileId))));
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
  for (const [panel, region] of Object.entries(defaultPanelRegions())) {
    if (!seen.has(panel)) normalized[region].push(panel);
  }
  return normalized;
}

function defaultPanelRegions() {
  return Object.fromEntries(
    Object.entries(DEFAULT_DOCK_LAYOUT).flatMap(([region, panels]) => panels.map((panel) => [panel, region]))
  );
}

function findSelectedEntity(state) {
  return state.scene.entities.find((entity) => entity.id === state.selectedEntityId) || null;
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

function transformPatch(mode, event) {
  if (mode === 'translate') {
    return { x: Number(event.clientX || 0), y: Number(event.clientY || 0) };
  }
  if (mode === 'rotate') return { rotation: Number(event.clientX || 0) / 100 };
  if (mode === 'scale') {
    const scale = Math.max(0.1, Number(event.clientX || 0) / 100);
    return { scaleX: scale, scaleY: scale };
  }
  return null;
}

const EDITOR_CSS = `
  body { margin: 0; background: #111827; color: #e5e7eb; font: 12px system-ui, sans-serif; }
  .editor-frame { display: grid; grid-template-rows: 40px minmax(0, 1fr) 24px; height: 100vh; background: #111827; }
  .editor-toolbar { display: flex; gap: 6px; align-items: center; padding: 6px 8px; border-bottom: 1px solid rgba(148,163,184,.28); background: #0b1120; }
  .editor-toolbar button { min-width: 56px; padding: 5px 8px; }
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
  .scene-wrap { display: grid; grid-template-rows: auto 1fr; height: 100%; gap: 8px; }
  .gizmo-toolbar, .tilemap-toolbar { display: flex; gap: 6px; align-items: center; }
  .gizmo-toolbar button, .tilemap-toolbar button { padding: 5px 8px; }
  .scene-canvas { position: relative; min-height: 260px; height: 100%; overflow: hidden; background-image: linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px); background-size: 24px 24px; }
  .scene-node { position: absolute; display: grid; place-items: center; overflow: hidden; padding: 0 4px; border: 1px solid #38bdf8; background: #082f49; font-size: 11px; transform-origin: center; }
  .scene-node.selected { outline: 2px solid #facc15; }
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
  .database-wrap { display: grid; gap: 8px; }
  .database-wrap table { width: 100%; border-collapse: collapse; }
  .database-wrap caption { text-align: left; color: #bfdbfe; margin-bottom: 4px; }
  .database-wrap td { padding: 3px; border: 1px solid #1e293b; }
  .database-wrap input { width: 100%; box-sizing: border-box; }
  .ai-assistant-wrap { display: grid; gap: 8px; }
  .ai-assistant-wrap button { width: max-content; padding: 5px 8px; }
  .profiler-wrap { display: grid; gap: 5px; }
  .profiler-row { display: grid; grid-template-columns: 132px 1fr 56px; gap: 6px; align-items: center; }
  .profiler-row b { display: inline-block; height: 8px; background: #38bdf8; }
`;

if (typeof document !== 'undefined') {
  const root = document.querySelector('#app');
  if (root) createEditorApp(root);
}

export { createEditorState };
export default createEditorApp;
