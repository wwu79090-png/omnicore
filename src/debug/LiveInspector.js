/**
 * Debug object tree editor for scene entities.
 */
export class LiveInspector {
  constructor(game, { edge = 'right', hover = true, stateKeys = null } = {}) {
    this.game = game;
    this.edge = edge;
    this.hover = hover;
    this.stateKeys = stateKeys;
    this.panel = null;
    this.hoverPanel = null;
    this.selected = null;
    this.hovered = null;
    this.listeners = [];
  }

  attach() {
    if (typeof document === 'undefined' || this.panel) return;
    this.panel = document.createElement('div');
    this.panel.dataset.omnicoreLiveInspector = 'true';
    Object.assign(this.panel.style, {
      position: 'fixed',
      top: '48px',
      [this.edge]: '8px',
      width: '220px',
      maxHeight: '70vh',
      overflow: 'auto',
      background: 'rgba(15,23,42,0.74)',
      color: '#e2e8f0',
      zIndex: '2147483646',
      padding: '8px',
      font: '12px monospace',
      border: '1px solid rgba(148,163,184,0.4)'
    });
    document.body.appendChild(this.panel);
    this._attachHoverInspector();
    this.refresh();
  }

  refresh() {
    if (!this.panel) return;
    this.panel.innerHTML = '<strong>Entities</strong>';
    const children = this.game?.scene?.current?.children || [];
    children.forEach((entity, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.textContent = `${entity.name || entity.texture || entity.type || 'entity'} @ ${Math.round(entity.x || 0)},${Math.round(entity.y || 0)}`;
      Object.assign(row.style, {
        display: 'block',
        width: '100%',
        marginTop: '6px',
        textAlign: 'left',
        color: '#e2e8f0',
        background: 'rgba(30,41,59,0.8)',
        border: '1px solid rgba(148,163,184,0.28)'
      });
      row.addEventListener('click', () => this._select(entity, index));
      this.panel.appendChild(row);
    });
  }

  detach() {
    for (const { target, event, handler } of this.listeners) {
      target.removeEventListener?.(event, handler);
    }
    this.listeners.length = 0;
    this.hoverPanel?.remove?.();
    this.panel?.remove?.();
    this.hoverPanel = null;
    this.panel = null;
    this.hovered = null;
  }

  _select(entity) {
    this.selected = entity;
    const controls = document.createElement('div');
    controls.innerHTML = ['x', 'y', 'scaleX', 'scaleY'].map((key) => `
      <label style="display:block;margin-top:6px">${key}
        <input data-key="${key}" type="number" value="${entity[key] ?? (key.startsWith('scale') ? 1 : 0)}" style="width:80px" />
      </label>
    `).join('');
    controls.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        entity[input.dataset.key] = Number(input.value);
        this.game?.renderer?.renderScene?.(this.game.scene?.current);
        this.refresh();
      });
    });
    this.panel.appendChild(controls);
  }

  _attachHoverInspector() {
    if (!this.hover) return;
    const target = this.game?.core?.canvas || this.game?.canvas || this.game?.renderer?.canvas;
    if (!target?.addEventListener) return;
    this._listen(target, 'pointermove', (event) => this._handlePointerMove(event));
    this._listen(target, 'pointerleave', () => this._hideHoverPanel());
    this._listen(target, 'click', (event) => {
      const entity = this._hitTest(this._pointerPosition(event));
      if (entity) this._select(entity);
    });
  }

  _listen(target, event, handler) {
    target.addEventListener(event, handler);
    this.listeners.push({ target, event, handler });
  }

  _handlePointerMove(event) {
    const point = this._pointerPosition(event);
    const entity = this._hitTest(point);
    this.hovered = entity;
    if (!entity) {
      this._hideHoverPanel();
      return;
    }
    this._showHoverPanel(entity, event.clientX ?? point.x, event.clientY ?? point.y);
  }

  _pointerPosition(event = {}) {
    const target = this.game?.core?.canvas || this.game?.canvas || this.game?.renderer?.canvas;
    const rect = target?.getBoundingClientRect?.() || { left: 0, top: 0 };
    return {
      x: (event.clientX ?? 0) - (rect.left || 0),
      y: (event.clientY ?? 0) - (rect.top || 0)
    };
  }

  _hitTest(point = {}) {
    const children = this.game?.scene?.current?.children || [];
    for (const entity of [...children].reverse()) {
      if (entity?.visible === false) continue;
      const bounds = entityBounds(entity);
      if (
        point.x >= bounds.x
        && point.x <= bounds.x + bounds.width
        && point.y >= bounds.y
        && point.y <= bounds.y + bounds.height
      ) {
        return entity;
      }
    }
    return null;
  }

  _showHoverPanel(entity, clientX, clientY) {
    if (!this.hoverPanel) {
      this.hoverPanel = document.createElement('div');
      this.hoverPanel.dataset.omnicoreHoverInspector = 'true';
      Object.assign(this.hoverPanel.style, {
        position: 'fixed',
        minWidth: '160px',
        maxWidth: '260px',
        padding: '8px',
        border: '1px solid rgba(125,211,252,0.55)',
        borderRadius: '6px',
        background: 'rgba(15,23,42,0.78)',
        color: '#e0f2fe',
        boxShadow: '0 8px 24px rgba(2,6,23,0.28)',
        pointerEvents: 'none',
        zIndex: '2147483647',
        font: '12px/1.45 monospace',
        whiteSpace: 'pre-wrap'
      });
      document.body.appendChild(this.hoverPanel);
    }
    this.hoverPanel.textContent = formatEntityState(entity, this.stateKeys);
    this.hoverPanel.style.left = `${Math.round(clientX + 12)}px`;
    this.hoverPanel.style.top = `${Math.round(clientY + 12)}px`;
    this.hoverPanel.style.display = 'block';
  }

  _hideHoverPanel() {
    if (this.hoverPanel) this.hoverPanel.style.display = 'none';
    this.hovered = null;
  }
}

function entityBounds(entity = {}) {
  if (typeof entity.getBounds === 'function') {
    const bounds = entity.getBounds();
    if (bounds) {
      return {
        x: Number(bounds.x || bounds.left || 0),
        y: Number(bounds.y || bounds.top || 0),
        width: Number(bounds.width || Math.max(0, (bounds.right || 0) - (bounds.left || 0))),
        height: Number(bounds.height || Math.max(0, (bounds.bottom || 0) - (bounds.top || 0)))
      };
    }
  }
  const width = Number(entity.width ?? entity.w ?? 32) * Number(entity.scaleX ?? 1);
  const height = Number(entity.height ?? entity.h ?? 32) * Number(entity.scaleY ?? 1);
  const anchor = entity.anchor || { x: 0, y: 0 };
  return {
    x: Number(entity.x || 0) - Number(anchor.x || 0) * width,
    y: Number(entity.y || 0) - Number(anchor.y || 0) * height,
    width: Math.max(0, width),
    height: Math.max(0, height)
  };
}

function formatEntityState(entity = {}, stateKeys = null) {
  const title = entity.name || entity.id || entity.texture || entity.type || 'entity';
  const keys = stateKeys || preferredStateKeys(entity);
  const lines = [String(title)];
  for (const key of keys) {
    const value = entity[key];
    if (!isInspectableValue(value)) continue;
    lines.push(`${key}: ${formatValue(value)}`);
  }
  return lines.join('\n');
}

function preferredStateKeys(entity = {}) {
  const priority = [
    'hp',
    'health',
    'maxHp',
    'maxHealth',
    'state',
    'x',
    'y',
    'width',
    'height',
    'velocity',
    'vx',
    'vy'
  ];
  const ownKeys = Object.keys(entity)
    .filter((key) => !key.startsWith('__') && !priority.includes(key))
    .filter((key) => isInspectableValue(entity[key]));
  return [...priority.filter((key) => key in entity), ...ownKeys].slice(0, 12);
}

function isInspectableValue(value) {
  if (value == null) return false;
  if (typeof value === 'function') return false;
  if (typeof value === 'object') return Array.isArray(value) || Object.values(value).every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item));
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function formatValue(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default LiveInspector;
