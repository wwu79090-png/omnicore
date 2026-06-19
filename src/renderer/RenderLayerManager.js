/**
 * Store-driven display list ordering.
 *
 * @example
 * const layers = new RenderLayerManager({ store, container: pixiContainer });
 * layers.register('hero', heroDisplayObject);
 */
export class RenderLayerManager {
  constructor({ store = null, container = null } = {}) {
    this.store = store;
    this.container = container;
    this.records = new Map();
    this.dirty = true;
    this.unsubscribe = store?.subscribe?.('zIndex', (value) => this.apply(value || {})) || null;
  }

  register(id, displayObject, zIndex = 0) {
    const existing = this.records.get(id);
    if (existing?.displayObject === displayObject && existing.zIndex === zIndex) return displayObject;
    this.records.set(id, { id, displayObject, zIndex });
    this.dirty = true;
    return displayObject;
  }

  unregister(id) {
    if (this.records.delete(id)) this.dirty = true;
  }

  apply(zIndex = {}) {
    for (const [id, value] of Object.entries(zIndex)) {
      const record = this.records.get(id);
      if (record && record.zIndex !== value) {
        record.zIndex = value;
        this.dirty = true;
      }
    }
    this.sort();
  }

  sort() {
    if (!this.dirty || !this.container?.children) return;
    const desired = [...this.records.values()]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((record) => record.displayObject)
      .filter((displayObject) => this.container.children.includes(displayObject));
    desired.forEach((displayObject, index) => {
      if (this.container.children[index] === displayObject) return;
      if (typeof this.container.setChildIndex === 'function') this.container.setChildIndex(displayObject, index);
      else {
        this.container.children = this.container.children.filter((item) => item !== displayObject);
        this.container.children.splice(index, 0, displayObject);
      }
    });
    this.dirty = false;
  }

  destroy() {
    this.unsubscribe?.();
    this.records.clear();
  }
}

export default RenderLayerManager;
