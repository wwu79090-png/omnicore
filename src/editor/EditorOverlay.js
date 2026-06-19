/**
 * Runtime-safe scene editor overlay used by debug builds and Live Sync smoke tests.
 */
export class EditorOverlay {
  constructor(game, options = {}) {
    this.game = game;
    this.options = options;
    this.document = options.documentRef || globalThis.document;
    this.root = null;
    this.selected = null;
    this.dragging = null;
    this.attached = false;
    this.message = 'OmniCore editor moved to packages/omnicore-editor. Use omnicore-editor with Live Sync.';
  }

  attach(container = this.document?.body) {
    this.attached = true;
    this.game?.store?.set?.('editor:overlay:moved', {
      package: 'omnicore-editor',
      message: this.message
    });
    if (!this.document || this.root || !container) return this;
    this.root = this.document.createElement('section');
    this.root.dataset.omnicoreEditorOverlay = 'true';
    this.root.innerHTML = `
      <div data-editor-overlay-scene></div>
      <label>x <input data-editor-overlay-field="x" type="number" /></label>
      <label>y <input data-editor-overlay-field="y" type="number" /></label>
      <div data-editor-overlay-prefabs></div>
    `;
    container.appendChild(this.root);
    this._bind();
    this.refresh();
    return this;
  }

  detach() {
    this.root?.remove?.();
    this.root = null;
    this.dragging = null;
    this.selected = null;
    this.attached = false;
    return this;
  }

  refresh() {
    this._renderScene();
    this._renderInspector();
    this._renderPrefabs();
    return this;
  }

  select(entity) {
    this.selected = entity || null;
    this.game?.store?.set?.('editor:overlay:selected', this._serializeEntity(this.selected));
    this.refresh();
    return this.selected;
  }

  setSelectedProperty(key, value) {
    if (!this.selected) return null;
    this.selected[key] = parseNumericField(key, value);
    this.game?.store?.set?.('editor:overlay:selected', this._serializeEntity(this.selected));
    this.game?.renderer?.renderScene?.(this.game?.scene?.current);
    this.refresh();
    return this.selected;
  }

  instantiatePrefab(prefab = {}, point = {}) {
    const scene = this.game?.scene?.current;
    if (!scene) return null;
    const entity = {
      id: `${prefab.id || prefab.name || 'prefab'}-${Date.now().toString(36)}`,
      name: prefab.name || prefab.id || 'Prefab',
      type: prefab.type || 'sprite',
      texture: prefab.texture || null,
      width: prefab.width || 32,
      height: prefab.height || 32,
      x: Number(point.x ?? point.clientX ?? 0),
      y: Number(point.y ?? point.clientY ?? 0),
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      prefabId: prefab.id || prefab.name || null
    };
    if (typeof scene.add === 'function') scene.add(entity);
    else scene.children?.push?.(entity);
    this.select(entity);
    this.game?.store?.set?.('editor:overlay:lastPrefab', this._serializeEntity(entity));
    this.game?.renderer?.renderScene?.(scene);
    return entity;
  }

  exportSceneJson() {
    const scene = this.game?.scene?.current;
    return {
      name: scene?.name || 'scene',
      entities: (scene?.children || []).map((entity, index) => this._serializeEntity(entity, index))
    };
  }

  _bind() {
    this.root?.addEventListener?.('input', (event) => {
      const key = event.target?.dataset?.editorOverlayField;
      if (key) this.setSelectedProperty(key, event.target.value);
    });
    this.root?.addEventListener?.('drop', (event) => {
      event.preventDefault?.();
      const payload = event.dataTransfer?.getData?.('application/x-omnicore-editor') || event.dataTransfer?.getData?.('text/plain');
      if (!payload) return;
      let prefab;
      try {
        prefab = JSON.parse(payload);
      } catch {
        prefab = { id: payload, name: payload };
      }
      this.instantiatePrefab(prefab, event);
    });
    this.root?.addEventListener?.('dragover', (event) => event.preventDefault?.());
  }

  _renderScene() {
    const sceneRoot = this.root?.querySelector?.('[data-editor-overlay-scene]');
    if (!sceneRoot) return;
    sceneRoot.textContent = '';
    for (const entity of this.game?.scene?.current?.children || []) {
      const node = this.document.createElement('button');
      node.type = 'button';
      node.dataset.editorOverlayEntityId = entity.id || entity.name || '';
      node.textContent = entity.name || entity.id || entity.texture || entity.type || 'entity';
      node.style.position = 'absolute';
      node.style.left = `${entity.x || 0}px`;
      node.style.top = `${entity.y || 0}px`;
      node.addEventListener('click', () => this.select(entity));
      node.addEventListener('mousedown', (event) => {
        this.select(entity);
        this.dragging = { entity, dx: Number(event.clientX || 0) - (entity.x || 0), dy: Number(event.clientY || 0) - (entity.y || 0) };
      });
      sceneRoot.appendChild(node);
    }
    if (!this._windowBound && typeof window !== 'undefined') {
      window.addEventListener('mousemove', (event) => {
        if (!this.dragging) return;
        this.dragging.entity.x = Number(event.clientX || 0) - this.dragging.dx;
        this.dragging.entity.y = Number(event.clientY || 0) - this.dragging.dy;
        this.game?.store?.set?.('editor:overlay:selected', this._serializeEntity(this.dragging.entity));
        this.game?.renderer?.renderScene?.(this.game?.scene?.current);
        this._renderScene();
      });
      window.addEventListener('mouseup', () => {
        this.dragging = null;
      });
      this._windowBound = true;
    }
  }

  _renderInspector() {
    if (!this.root) return;
    for (const key of ['x', 'y']) {
      const input = this.root.querySelector(`[data-editor-overlay-field="${key}"]`);
      if (input) input.value = String(this.selected?.[key] ?? 0);
    }
  }

  _renderPrefabs() {
    const root = this.root?.querySelector?.('[data-editor-overlay-prefabs]');
    if (!root) return;
    root.textContent = '';
    for (const prefab of this.options.prefabs || []) {
      const node = this.document.createElement('button');
      node.type = 'button';
      node.draggable = true;
      node.dataset.editorOverlayPrefabId = prefab.id || prefab.name || '';
      node.textContent = prefab.name || prefab.id || 'Prefab';
      node.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData?.('application/x-omnicore-editor', JSON.stringify(prefab));
      });
      root.appendChild(node);
    }
  }

  _serializeEntity(entity, index = 0) {
    if (!entity) return null;
    return {
      id: entity.id || `entity-${index}`,
      name: entity.name || entity.texture || `Entity ${index + 1}`,
      type: entity.type || 'entity',
      texture: entity.texture || null,
      x: entity.x ?? 0,
      y: entity.y ?? 0,
      width: entity.width ?? 0,
      height: entity.height ?? 0,
      rotation: entity.rotation ?? 0,
      scaleX: entity.scaleX ?? entity.scale ?? 1,
      scaleY: entity.scaleY ?? entity.scale ?? 1,
      prefabId: entity.prefabId || null
    };
  }
}

function parseNumericField(key, value) {
  if (!['x', 'y', 'width', 'height', 'rotation', 'scale', 'scaleX', 'scaleY', 'alpha'].includes(key)) return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export default EditorOverlay;
