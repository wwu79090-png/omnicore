import PluginRecommendationEngine from './PluginRecommendationEngine.js';
import AssetBrowser from './AssetBrowser.js';
import AnimationEditor from './AnimationEditor.js';

/**
 * Lightweight visual scene editor activated by `OmniCore.Game({ editor: true })`.
 *
 * The editor is isolated in HTML overlays and only talks to the engine through
 * scene children, renderer redraws, and Store synchronization.
 *
 * @example
 * const game = await new OmniCore.Game({ parent: '#game', editor: true }).init();
 * game.editor.exportScene();
 */
export class EditorPlugin {
  constructor(game, options = {}) {
    this.game = game;
    this.options = options;
    this.root = null;
    this.sidebar = null;
    this.assetPanel = null;
    this.entityList = null;
    this.propertyPanel = null;
    this.prefabPreviewPanel = null;
    this.animationPanel = null;
    this.transformBox = null;
    this.contextMenu = null;
    this.selected = null;
    this.dragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.clipboard = null;
    this.contextEntity = null;
    this.contextPoint = { x: 0, y: 0 };
    this.listeners = [];
    this.recommendationEngine = options.recommendationEngine || new PluginRecommendationEngine(options.recommendationRules);
    this.assetBrowser = new AssetBrowser({
      entries: options.assets || defaultEditorAssets(),
      store: game?.store,
      onSelect: (asset) => this._handleAssetSelect(asset)
    });
    this.animationEditor = null;
  }

  attach() {
    if (typeof document === 'undefined' || this.root) return this;
    this._createUI();
    this._bindCanvas();
    this.refresh();
    return this;
  }

  refresh() {
    if (!this.root) return;
    this._renderEntityList();
    this._renderProperties();
    this._syncSceneStore();
    this._positionTransformBox();
  }

  select(entity) {
    this.selected = entity || null;
    this.game.store?.set?.('editor:selectedEntity', this._serializeEntity(entity, this._entityIndex(entity)));
    this.refresh();
  }

  exportScene({ download = true } = {}) {
    const payload = this._serializeScene();
    this.game.store?.set?.('editor:lastScene', payload);
    if (download) this._downloadJson(payload);
    return payload;
  }

  saveScene() {
    const payload = this.exportScene({ download: false });
    this.game.store?.set?.('config/scene.json', payload);
    return payload;
  }

  detach() {
    for (const { target, type, handler, options } of this.listeners) {
      target.removeEventListener?.(type, handler, options);
    }
    this.listeners.length = 0;
    this.assetBrowser?.detach?.();
    this.animationEditor?.detach?.();
    this.root?.remove?.();
    this.transformBox?.remove?.();
    this.contextMenu?.remove?.();
    this.root = null;
    this.sidebar = null;
    this.entityList = null;
    this.propertyPanel = null;
    this.assetPanel = null;
    this.prefabPreviewPanel = null;
    this.animationPanel = null;
    this.transformBox = null;
    this.contextMenu = null;
    this.selected = null;
    this.contextEntity = null;
    this.animationEditor = null;
  }

  _createUI() {
    this.root = this._createRootElement();
    this.root.dataset.omnicoreEditor = 'true';
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '2147483644',
      font: '12px system-ui, sans-serif',
      color: '#e2e8f0'
    });

    this.sidebar = document.createElement('aside');
    Object.assign(this.sidebar.style, {
      position: 'absolute',
      right: '0',
      top: '0',
      width: '360px',
      height: '100%',
      pointerEvents: 'auto',
      boxSizing: 'border-box',
      padding: '12px',
      overflow: 'auto',
      background: 'rgba(15, 23, 42, 0.78)',
      borderLeft: '1px solid rgba(148, 163, 184, 0.45)',
      backdropFilter: 'blur(4px)'
    });

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '8px', marginBottom: '12px' });
    actions.append(
      this._button('保存场景', 'save', () => this.saveScene()),
      this._button('导出为 JSON', 'export', () => this.exportScene())
    );

    const listTitle = document.createElement('h3');
    listTitle.textContent = 'Entity 树';
    const propsTitle = document.createElement('h3');
    propsTitle.textContent = '属性';
    const assetTitle = document.createElement('h3');
    assetTitle.textContent = '资产';
    const prefabTitle = document.createElement('h3');
    prefabTitle.textContent = 'Prefab 预览';
    const timelineTitle = document.createElement('h3');
    timelineTitle.textContent = '动画时间轴';
    this.assetPanel = document.createElement('div');
    this.entityList = document.createElement('div');
    this.entityList.dataset.editorSceneTree = 'true';
    this.propertyPanel = document.createElement('div');
    this.propertyPanel.dataset.editorPropertyPanel = 'true';
    this.prefabPreviewPanel = document.createElement('div');
    this.animationPanel = document.createElement('div');

    this.sidebar.append(
      actions,
      assetTitle,
      this.assetPanel,
      prefabTitle,
      this.prefabPreviewPanel,
      listTitle,
      this.entityList,
      propsTitle,
      this.propertyPanel,
      timelineTitle,
      this.animationPanel
    );
    this.root.appendChild(this.sidebar);
    document.body.appendChild(this.root);
    this.assetBrowser.attach(this.assetPanel, { onSelect: (asset) => this._handleAssetSelect(asset) });
    this._attachAnimationTimeline();

    this.transformBox = document.createElement('div');
    this.transformBox.dataset.omnicoreTransformBox = 'true';
    Object.assign(this.transformBox.style, {
      position: 'fixed',
      display: 'none',
      pointerEvents: 'none',
      border: '1px solid rgba(56,189,248,0.95)',
      background: 'rgba(56,189,248,0.14)',
      boxShadow: '0 0 0 1px rgba(15,23,42,0.55) inset',
      zIndex: '2147483643'
    });
    document.body.appendChild(this.transformBox);
  }

  _createRootElement() {
    this._ensureEditorElement();
    return document.createElement('omnicore-scene-layout-editor');
  }

  _ensureEditorElement() {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
    if (customElements.get('omnicore-scene-layout-editor')) return;
    try {
      customElements.define('omnicore-scene-layout-editor', class extends HTMLElement {});
    } catch {
      // The custom element registry is global; duplicate definitions are harmless to ignore.
    }
  }

  _button(text, action, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.dataset.editorAction = action;
    Object.assign(button.style, {
      padding: '6px 8px',
      color: '#e2e8f0',
      background: '#0f172a',
      border: '1px solid rgba(56,189,248,0.8)',
      cursor: 'pointer'
    });
    this._listen(button, 'click', handler);
    return button;
  }

  _renderEntityList() {
    if (!this.entityList) return;
    this.entityList.textContent = '';
    const entities = this._entities();
    entities.forEach((entity, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.dataset.editorEntityId = String(index);
      row.textContent = entity.name || entity.id || entity.texture || `${entity.type || 'entity'} ${index}`;
      Object.assign(row.style, {
        display: 'block',
        width: '100%',
        marginBottom: '6px',
        padding: '6px',
        textAlign: 'left',
        color: '#e2e8f0',
        background: entity === this.selected ? 'rgba(56,189,248,0.28)' : 'rgba(30,41,59,0.75)',
        border: '1px solid rgba(148,163,184,0.35)',
        cursor: 'pointer'
      });
      this._listen(row, 'click', () => this.select(entity));
      this.entityList.appendChild(row);
    });
  }

  _renderProperties() {
    if (!this.propertyPanel) return;
    this.propertyPanel.textContent = '';
    if (!this.selected) {
      const empty = document.createElement('p');
      empty.textContent = '未选择实体';
      this.propertyPanel.appendChild(empty);
      this._syncPluginRecommendations([]);
      return;
    }

    [
      ['x', this.selected.x ?? 0],
      ['y', this.selected.y ?? 0],
      ['scale', this.selected.scale ?? this.selected.scaleX ?? 1],
      ['scaleX', this.selected.scaleX ?? this.selected.scale ?? 1],
      ['scaleY', this.selected.scaleY ?? this.selected.scale ?? 1],
      ['rotation', this.selected.rotation ?? 0],
      ['width', this.selected.width ?? 0],
      ['height', this.selected.height ?? 0]
    ].forEach(([key, value]) => {
      const label = document.createElement('label');
      label.textContent = key;
      Object.assign(label.style, { display: 'grid', gap: '4px', marginBottom: '8px' });
      const input = document.createElement('input');
      input.type = 'number';
      input.step = key === 'rotation' ? '0.01' : '1';
      input.value = String(value);
      input.dataset.editorProp = key;
      Object.assign(input.style, {
        width: '100%',
        boxSizing: 'border-box',
        padding: '5px',
        color: '#e2e8f0',
        background: '#020617',
        border: '1px solid rgba(148,163,184,0.5)'
      });
      this._listen(input, 'input', () => this._setSelectedProperty(key, Number(input.value)));
      label.appendChild(input);
      this.propertyPanel.appendChild(label);
    });
    this._renderPluginRecommendations();
  }

  _handleAssetSelect(asset) {
    this.game.store?.set?.('editor:selectedAsset', { ...asset });
    if (/^assets\/prefabs\/.+\.json$/i.test(asset?.path || '')) {
      this._renderPrefabPreview(asset);
    }
  }

  _renderPrefabPreview(asset) {
    if (!this.prefabPreviewPanel) return;
    this.prefabPreviewPanel.textContent = '';
    const data = asset.data || asset.prefab || {
      name: asset.name || asset.path,
      entities: []
    };
    const preview = document.createElement('section');
    preview.dataset.omnicorePrefabPreview = 'true';
    Object.assign(preview.style, {
      padding: '8px',
      marginBottom: '10px',
      background: 'rgba(2,6,23,0.55)',
      border: '1px solid rgba(148,163,184,0.35)'
    });
    const title = document.createElement('strong');
    title.textContent = data.name || asset.name || asset.path;
    preview.appendChild(title);

    const entities = Array.isArray(data.entities) ? data.entities : Array.isArray(data.children) ? data.children : [];
    const viewport = document.createElement('div');
    viewport.dataset.omnicorePrefabViewport = 'true';
    Object.assign(viewport.style, {
      position: 'relative',
      height: '120px',
      marginTop: '8px',
      overflow: 'hidden',
      background: 'rgba(15,23,42,0.68)',
      border: '1px solid rgba(56,189,248,0.24)'
    });
    entities.forEach((entity, index) => {
      const node = document.createElement('div');
      node.textContent = entity.name || entity.texture || entity.type || `entity-${index}`;
      Object.assign(node.style, {
        position: 'absolute',
        left: `${Number(entity.x || index * 12)}px`,
        top: `${Number(entity.y || index * 12)}px`,
        width: `${Math.max(12, Number(entity.width || 24))}px`,
        height: `${Math.max(12, Number(entity.height || 24))}px`,
        display: 'grid',
        placeItems: 'center',
        fontSize: '10px',
        color: '#0f172a',
        background: 'rgba(56,189,248,0.86)',
        opacity: Number(entity.alpha ?? 1),
        transform: `scale(${Number(entity.scale ?? 1)}) rotate(${Number(entity.rotation ?? 0)}rad)`
      });
      viewport.appendChild(node);
    });
    preview.appendChild(viewport);
    this.prefabPreviewPanel.appendChild(preview);
    this.game.store?.set?.('editor:prefabPreview', {
      path: asset.path,
      name: data.name || asset.name || asset.path,
      insertedIntoScene: false,
      entities: entities.map((entity) => ({ ...entity }))
    });
  }

  _attachAnimationTimeline() {
    if (!this.animationPanel || this.animationEditor) return;
    const config = this.options.animation || {};
    this.animationEditor = new AnimationEditor({
      store: this.game.store,
      frames: config.frames || ['idle-0'],
      animation: config.animation || 'idle',
      frameRate: config.frameRate || 12
    });
    this.animationEditor.attach(this.animationPanel);
  }

  _setSelectedProperty(key, value) {
    if (!this.selected || Number.isNaN(value)) return;
    this.selected[key] = value;
    if (key === 'scale') {
      this.selected.scaleX = value;
      this.selected.scaleY = value;
    }
    this._afterEntityMutation();
  }

  _bindCanvas() {
    const canvas = this.game.core?.canvas || this.game.renderer?.canvas;
    if (!canvas) return;
    this._listen(canvas, 'pointerdown', (event) => this._pointerDown(event), { passive: false });
    this._listen(canvas, 'pointermove', (event) => this._pointerMove(event), { passive: false });
    this._listen(canvas, 'pointerup', (event) => this._pointerUp(event), { passive: false });
    this._listen(canvas, 'pointerleave', (event) => this._pointerUp(event), { passive: false });
    this._listen(canvas, 'contextmenu', (event) => this._openContextMenu(event), { passive: false });
  }

  _pointerDown(event) {
    const point = this._canvasPoint(event);
    const entity = this._hitTest(point);
    if (!entity) return;
    event.preventDefault?.();
    this.select(entity);
    this.dragging = true;
    this.dragOffset = {
      x: point.x - (entity.x || 0),
      y: point.y - (entity.y || 0)
    };
  }

  _pointerMove(event) {
    if (!this.dragging || !this.selected) return;
    event.preventDefault?.();
    const point = this._canvasPoint(event);
    this.selected.x = Math.round(point.x - this.dragOffset.x);
    this.selected.y = Math.round(point.y - this.dragOffset.y);
    this._afterEntityMutation();
  }

  _pointerUp() {
    this.dragging = false;
  }

  _openContextMenu(event) {
    event.preventDefault?.();
    const point = this._canvasPoint(event);
    const entity = this._hitTest(point);
    this.contextPoint = {
      x: Math.round(point.x),
      y: Math.round(point.y)
    };
    this.contextEntity = entity || null;
    if (entity) this.select(entity);
    this._renderContextMenu(event.clientX ?? 0, event.clientY ?? 0);
  }

  _renderContextMenu(left, top) {
    this.contextMenu?.remove?.();
    this.contextMenu = document.createElement('div');
    this.contextMenu.dataset.omnicoreContextMenu = 'true';
    Object.assign(this.contextMenu.style, {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      minWidth: '128px',
      padding: '4px',
      zIndex: '2147483646',
      background: 'rgba(15, 23, 42, 0.96)',
      border: '1px solid rgba(148, 163, 184, 0.55)',
      boxShadow: '0 12px 24px rgba(15, 23, 42, 0.28)',
      color: '#e2e8f0',
      font: '12px system-ui, sans-serif'
    });

    this.contextMenu.append(
      this._contextButton('复制', 'copy', () => this._copyEntity()),
      this._contextButton('粘贴', 'paste', () => this._pasteEntity(), !this.clipboard),
      this._contextButton('删除', 'delete', () => this._deleteEntity(), !this.contextEntity)
    );
    document.body.appendChild(this.contextMenu);
  }

  _contextButton(text, action, handler, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.disabled = disabled;
    button.dataset.editorContextAction = action;
    Object.assign(button.style, {
      display: 'block',
      width: '100%',
      padding: '7px 8px',
      color: disabled ? '#64748b' : '#e2e8f0',
      background: 'transparent',
      border: '0',
      textAlign: 'left',
      cursor: disabled ? 'default' : 'pointer'
    });
    this._listen(button, 'click', () => {
      if (button.disabled) return;
      handler();
      this._closeContextMenu();
    });
    return button;
  }

  _closeContextMenu() {
    this.contextMenu?.remove?.();
    this.contextMenu = null;
  }

  _copyEntity(entity = this.contextEntity || this.selected) {
    if (!entity) return null;
    this.clipboard = {
      data: this._serializeEntity(entity, this._entityIndex(entity)),
      Constructor: entity.constructor
    };
    this.game.store?.set?.('editor:clipboardEntity', this.clipboard.data);
    return this.clipboard;
  }

  _pasteEntity(point = this.contextPoint) {
    if (!this.clipboard) return null;
    const entity = this._createEntityFromClipboard(point);
    const scene = this.game.scene?.current;
    if (!scene || !entity) return null;
    if (typeof scene.add === 'function') scene.add(entity);
    else {
      entity.parent = scene;
      scene.children = scene.children || [];
      scene.children.push(entity);
    }
    this.select(entity);
    this._afterEntityMutation();
    return entity;
  }

  _deleteEntity(entity = this.contextEntity || this.selected) {
    if (!entity) return null;
    const scene = this.game.scene?.current;
    if (typeof scene?.remove === 'function') scene.remove(entity);
    else {
      const children = this._entities();
      const index = children.indexOf(entity);
      if (index >= 0) children.splice(index, 1);
    }
    if (this.selected === entity) this.selected = null;
    this.contextEntity = null;
    this.game.store?.set?.('editor:selectedEntity', null);
    this._syncSceneStore();
    this.game.renderer?.renderScene?.(scene);
    this.refresh();
    return entity;
  }

  _createEntityFromClipboard(point) {
    const data = {
      ...this.clipboard.data,
      x: Math.round(point?.x ?? this.clipboard.data.x ?? 0),
      y: Math.round(point?.y ?? this.clipboard.data.y ?? 0)
    };
    data.id = this._uniqueEntityId(data.id || data.name || data.type || 'entity');
    if (data.name) data.name = this._uniqueEntityName(data.name);

    let entity = null;
    const { Constructor } = this.clipboard;
    if (typeof Constructor === 'function' && Constructor !== Object) {
      try {
        entity = new Constructor(data.texture, data);
      } catch {
        entity = null;
      }
    }
    if (!entity) entity = Object.create(Object.prototype);
    Object.assign(entity, data);
    if (Array.isArray(entity.components)) entity.components = [];
    if (Array.isArray(entity.animations)) entity.animations = [];
    entity.displayObject = null;
    return entity;
  }

  _uniqueEntityId(base) {
    const root = String(base || 'entity').replace(/-copy-\d+$/, '');
    const ids = new Set(this._entities().map((entity) => entity.id).filter(Boolean));
    if (!ids.has(root)) return root;
    let index = 1;
    while (ids.has(`${root}-copy-${index}`)) index += 1;
    return `${root}-copy-${index}`;
  }

  _uniqueEntityName(base) {
    const root = String(base || 'Entity').replace(/ copy \d+$/, '');
    const names = new Set(this._entities().map((entity) => entity.name).filter(Boolean));
    let index = 1;
    while (names.has(`${root} copy ${index}`)) index += 1;
    return `${root} copy ${index}`;
  }

  _afterEntityMutation() {
    this.game.store?.set?.('editor:selectedEntity', this._serializeEntity(this.selected, this._entityIndex(this.selected)));
    this._syncPluginRecommendations(this.getPluginRecommendations(this.selected));
    this._syncSceneStore();
    this.game.renderer?.renderScene?.(this.game.scene?.current);
    this._renderProperties();
    this._positionTransformBox();
  }

  _hitTest(point) {
    const entities = [...this._entities()].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    return entities.find((entity) => {
      const scaleX = entity.scale ?? entity.scaleX ?? 1;
      const scaleY = entity.scale ?? entity.scaleY ?? 1;
      const width = (entity.width || 0) * scaleX;
      const height = (entity.height || 0) * scaleY;
      return point.x >= (entity.x || 0)
        && point.x <= (entity.x || 0) + width
        && point.y >= (entity.y || 0)
        && point.y <= (entity.y || 0) + height;
    });
  }

  _canvasPoint(event) {
    const canvas = this.game.core?.canvas || this.game.renderer?.canvas;
    const rect = canvas?.getBoundingClientRect?.() || { left: 0, top: 0, width: canvas?.width || 1, height: canvas?.height || 1 };
    const scaleX = (canvas?.width || rect.width || 1) / (rect.width || canvas?.width || 1);
    const scaleY = (canvas?.height || rect.height || 1) / (rect.height || canvas?.height || 1);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  _positionTransformBox() {
    if (!this.transformBox) return;
    if (!this.selected) {
      this.transformBox.style.display = 'none';
      return;
    }
    const canvas = this.game.core?.canvas || this.game.renderer?.canvas;
    const rect = canvas?.getBoundingClientRect?.() || { left: 0, top: 0, width: canvas?.width || 1, height: canvas?.height || 1 };
    const scaleX = (rect.width || canvas?.width || 1) / (canvas?.width || rect.width || 1);
    const scaleY = (rect.height || canvas?.height || 1) / (canvas?.height || rect.height || 1);
    const entityScaleX = this.selected.scale ?? this.selected.scaleX ?? 1;
    const entityScaleY = this.selected.scale ?? this.selected.scaleY ?? 1;
    Object.assign(this.transformBox.style, {
      display: 'block',
      left: `${rect.left + (this.selected.x || 0) * scaleX}px`,
      top: `${rect.top + (this.selected.y || 0) * scaleY}px`,
      width: `${(this.selected.width || 0) * entityScaleX * scaleX}px`,
      height: `${(this.selected.height || 0) * entityScaleY * scaleY}px`,
      transform: `rotate(${this.selected.rotation || 0}rad)`
    });
  }

  _serializeScene() {
    const scene = this.game.scene?.current;
    return {
      format: 'OmniCore.Scene.json',
      version: 1,
      name: scene?.name || 'untitled',
      exportedAt: new Date().toISOString(),
      entities: this._entities().map((entity, index) => this._serializeEntity(entity, index))
    };
  }

  _serializeEntity(entity, index = 0) {
    if (!entity) return null;
    return {
      id: entity.id || entity.name || `entity-${index}`,
      name: entity.name || '',
      type: entity.type || 'entity',
      texture: entity.texture || null,
      x: entity.x ?? 0,
      y: entity.y ?? 0,
      scale: entity.scale ?? entity.scaleX ?? 1,
      scaleX: entity.scaleX ?? entity.scale ?? 1,
      scaleY: entity.scaleY ?? entity.scale ?? 1,
      rotation: entity.rotation ?? 0,
      width: entity.width ?? 0,
      height: entity.height ?? 0,
      alpha: entity.alpha ?? 1,
      zIndex: entity.zIndex ?? 0,
      properties: {
        visible: entity.visible ?? true
      }
    };
  }

  _syncSceneStore() {
    this.game.store?.set?.('editor:scene', this._serializeScene());
  }

  getPluginRecommendations(entity = this.selected) {
    return this.recommendationEngine?.recommend?.(entity) || [];
  }

  getPluginRecommendationsWithTree(entity = this.selected) {
    const result = this.recommendationEngine?.recommendWithTree?.(entity);
    if (result) {
      return {
        recommendations: result.recommendations || [],
        tree: Array.isArray(result.tree) ? result.tree : []
      };
    }
    return {
      recommendations: this.recommendationEngine?.recommend?.(entity) || [],
      tree: []
    };
  }

  _renderPluginRecommendations() {
    if (!this.propertyPanel || !this.selected) return;
    const { recommendations, tree } = this.getPluginRecommendationsWithTree(this.selected);
    this._syncPluginRecommendations(recommendations);
    if (!recommendations.length) return;

    const box = document.createElement('div');
    box.dataset.omnicorePluginRecommendations = 'true';
    Object.assign(box.style, {
      marginTop: '10px',
      paddingTop: '8px',
      borderTop: '1px solid rgba(148,163,184,0.35)'
    });
    const title = document.createElement('strong');
    title.textContent = '推荐插件';
    box.appendChild(title);

    const renderNodes = (nodes = [], depth = 0) => {
      nodes.forEach((node, index) => {
        if (!node?.plugin) return;
        const row = document.createElement('div');
        Object.assign(row.style, {
          marginLeft: `${depth * 12}px`,
          marginTop: index === 0 ? '6px' : '4px'
        });

        const installButton = this._button(`安装 ${node.plugin}`, `recommend-${node.plugin}`, () => {
          this.game.store?.set?.('editor:pluginRecommendation:selected', node);
        });
        installButton.dataset.pluginRecommendation = node.plugin;
        installButton.title = node.reason;
        Object.assign(installButton.style, {
          width: '100%',
          boxSizing: 'border-box'
        });
        row.appendChild(installButton);

        if (node.reason) {
          const reason = document.createElement('div');
          reason.textContent = node.reason;
          reason.title = node.reason;
          reason.style.fontSize = '11px';
          reason.style.opacity = '0.88';
          reason.style.marginTop = '3px';
          reason.style.color = '#93c5fd';
          row.appendChild(reason);
        }
        box.appendChild(row);

        if (Array.isArray(node.cascades) && node.cascades.length) {
          renderNodes(node.cascades, depth + 1);
        }
      });
    };

    const roots = tree?.length ? tree : recommendations.map((item) => ({
      ...item,
      cascades: item.cascadePlugins
    }));
    renderNodes(roots, 0);

    if (this.game.config?.debug) {
      const preview = document.createElement('pre');
      Object.assign(preview.style, {
        marginTop: '8px',
        fontSize: '11px',
        lineHeight: 1.3,
        whiteSpace: 'pre-wrap',
        maxHeight: '140px',
        overflow: 'auto'
      });
      preview.textContent = JSON.stringify(roots, null, 2);
      box.appendChild(preview);
    }

    this.propertyPanel.appendChild(box);
  }

  _syncPluginRecommendations(recommendations = this.getPluginRecommendations(this.selected), tree = []) {
    this.game.store?.set?.('editor:pluginRecommendations', recommendations);
    if (Array.isArray(tree)) this.game.store?.set?.('editor:pluginRecommendationTree', tree);
    return recommendations;
  }

  _downloadJson(payload) {
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || !globalThis.URL?.createObjectURL) return;
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
    const url = globalThis.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${payload.name || 'Scene'}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    globalThis.URL.revokeObjectURL?.(url);
  }

  _entities() {
    return this.game.scene?.current?.children || [];
  }

  _entityIndex(entity) {
    return this._entities().indexOf(entity);
  }

  _listen(target, type, handler, options = false) {
    target.addEventListener?.(type, handler, options);
    this.listeners.push({ target, type, handler, options });
  }
}

function defaultEditorAssets() {
  return [
    'assets/sprites/default/hero.svg',
    'assets/sprites/default/tile.svg',
    'assets/prefabs/slime.json',
    'assets/prefabs/enemy.json'
  ];
}

export default EditorPlugin;
