/**
 * DOM overlay layer that coexists with Canvas-rendered UI.
 */
export class HtmlOverlay {
  constructor({
    document: documentRef = globalThis.document,
    root = null,
    className = 'omnicore-html-overlay',
    zIndex = 20,
    pointerEvents = 'none'
  } = {}) {
    this.document = documentRef;
    this.container = root || documentRef?.body || null;
    this.className = className;
    this.zIndex = zIndex;
    this.pointerEvents = pointerEvents;
    this.root = null;
    this.nodes = new Map();
    this.mounted = false;
  }

  mount() {
    if (!this.document || !this.container) return this;
    if (!this.root) {
      this.root = this.document.createElement('div');
      this.root.className = this.className;
      Object.assign(this.root.style, {
        position: 'absolute',
        inset: '0',
        zIndex: String(this.zIndex),
        pointerEvents: this.pointerEvents
      });
    }
    if (!this.root.parentNode) this.container.appendChild(this.root);
    this.mounted = true;
    return this;
  }

  add(id, {
    html = '',
    textContent = null,
    className = '',
    style = {},
    pointerEvents = null,
    visible = true
  } = {}) {
    this.mount();
    const key = String(id);
    const node = this.nodes.get(key) || this.document.createElement('div');
    node.dataset.omnicoreOverlayId = key;
    node.className = className;
    node.innerHTML = html;
    if (textContent != null) node.textContent = String(textContent);
    Object.assign(node.style, {
      position: 'absolute',
      display: visible ? '' : 'none',
      pointerEvents: pointerEvents || this.pointerEvents,
      ...style
    });
    if (!node.parentNode) this.root.appendChild(node);
    this.nodes.set(key, node);
    return node;
  }

  update(id, patch = {}) {
    const node = this.nodes.get(String(id));
    if (!node) return null;
    if (patch.html != null) node.innerHTML = String(patch.html);
    if (patch.textContent != null) node.textContent = String(patch.textContent);
    if (patch.className != null) node.className = String(patch.className);
    if (patch.visible != null) node.style.display = patch.visible ? '' : 'none';
    if (patch.pointerEvents != null) node.style.pointerEvents = String(patch.pointerEvents);
    if (patch.style) Object.assign(node.style, patch.style);
    return node;
  }

  remove(id) {
    const key = String(id);
    const node = this.nodes.get(key);
    if (!node) return false;
    node.remove?.();
    if (node.parentNode?.removeChild) node.parentNode.removeChild(node);
    this.nodes.delete(key);
    return true;
  }

  destroy() {
    for (const key of [...this.nodes.keys()]) this.remove(key);
    this.root?.remove?.();
    if (this.root?.parentNode?.removeChild) this.root.parentNode.removeChild(this.root);
    this.mounted = false;
    return this;
  }
}

export default HtmlOverlay;
