export class UIFocusManager {
  constructor({ safeArea = {}, viewport = {} } = {}) {
    this.elements = new Map();
    this.focusedId = null;
    this.modalStack = [];
    this.safeArea = normalizeBox(safeArea);
    this.viewport = {
      width: Number(viewport.width || 0),
      height: Number(viewport.height || 0)
    };
  }

  register(element, {
    id = element?.id || element?.name || `ui-${this.elements.size + 1}`,
    role = element?.role || 'button',
    label = element?.label || element?.text || id,
    shortcuts = [],
    modal = false
  } = {}) {
    const record = {
      id: String(id),
      element,
      role,
      label,
      shortcuts: [...shortcuts],
      modal: Boolean(modal),
      aria: {
        role,
        label
      }
    };
    this.elements.set(record.id, record);
    return record;
  }

  focus(id) {
    if (!this.elements.has(id)) return null;
    this.focusedId = id;
    const record = this.elements.get(id);
    record.element?.focus?.();
    return record;
  }

  blur() {
    const record = this.focusedId ? this.elements.get(this.focusedId) : null;
    record?.element?.blur?.();
    this.focusedId = null;
    return record;
  }

  pushModal(idOrElement, options = {}) {
    const id = typeof idOrElement === 'string'
      ? idOrElement
      : this.register(idOrElement, { ...options, modal: true }).id;
    const record = this.elements.get(id);
    if (!record) return null;
    record.modal = true;
    this.modalStack.push(id);
    this.focus(id);
    return record;
  }

  popModal(id = null) {
    if (id) this.modalStack = this.modalStack.filter((item) => item !== id);
    else this.modalStack.pop();
    const next = this.modalStack[this.modalStack.length - 1] || null;
    if (next) this.focus(next);
    else this.blur();
    return next ? this.elements.get(next) : null;
  }

  areShortcutsEnabled({ allowInModal = false } = {}) {
    return allowInModal || this.modalStack.length === 0;
  }

  resolveAnchor(anchor = 'center', { width = 0, height = 0 } = {}) {
    const viewportWidth = this.viewport.width || width;
    const viewportHeight = this.viewport.height || height;
    const {
      bottom: safeBottom,
      left,
      right: safeRight,
      top
    } = this.safeArea;
    const right = Math.max(left, viewportWidth - safeRight - width);
    const bottom = Math.max(top, viewportHeight - safeBottom - height);
    const centerX = Math.round((left + right) / 2);
    const centerY = Math.round((top + bottom) / 2);
    const anchors = {
      topLeft: { x: left, y: top },
      topRight: { x: right, y: top },
      bottomLeft: { x: left, y: bottom },
      bottomRight: { x: right, y: bottom },
      center: { x: centerX, y: centerY }
    };
    return anchors[anchor] || anchors.center;
  }

  snapshot() {
    return {
      focusedId: this.focusedId,
      modalStack: [...this.modalStack],
      elements: [...this.elements.values()].map((record) => ({
        id: record.id,
        role: record.role,
        label: record.label,
        modal: record.modal,
        shortcuts: [...record.shortcuts],
        aria: { ...record.aria }
      }))
    };
  }
}

function normalizeBox(value = {}) {
  return {
    top: Number(value.top || 0),
    right: Number(value.right || 0),
    bottom: Number(value.bottom || 0),
    left: Number(value.left || 0)
  };
}

export default UIFocusManager;
