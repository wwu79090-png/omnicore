import { createOmniError } from '../core/OmniError.js';

export class SystemMenuModel {
  constructor({ maxItems = 3 } = {}) {
    this.maxItems = Number(maxItems || 3);
    this.items = new Map();
    this.handlers = new Map();
  }

  addAction(id, { label = id, onSelect = null } = {}) {
    const key = normalizeId(id);
    this.items.set(key, { id: key, label: String(label), type: 'action' });
    if (onSelect) this.handlers.set(key, onSelect);
    return this;
  }

  addCheckmark(id, { label = id, value = false } = {}) {
    const key = normalizeId(id);
    this.items.set(key, { id: key, label: String(label), type: 'checkmark', value: Boolean(value) });
    return this;
  }

  addOptions(id, { label = id, options = [], value = null } = {}) {
    const key = normalizeId(id);
    const choices = options.map(String);
    this.items.set(key, {
      id: key,
      label: String(label),
      type: 'options',
      options: choices,
      value: value == null ? choices[0] : String(value)
    });
    return this;
  }

  select(id) {
    const item = this._get(id);
    if (item.type !== 'action') return item;
    this.handlers.get(item.id)?.(item);
    return item;
  }

  toggle(id) {
    const item = this._get(id);
    if (item.type !== 'checkmark') throw createOmniError('SystemMenuModel', `Menu item is not checkmark: ${id}`);
    item.value = !item.value;
    return item.value;
  }

  choose(id, value) {
    const item = this._get(id);
    if (item.type !== 'options') throw createOmniError('SystemMenuModel', `Menu item is not options: ${id}`);
    const next = String(value);
    if (!item.options.includes(next)) throw createOmniError('SystemMenuModel', `Unsupported menu option: ${next}`);
    item.value = next;
    return item.value;
  }

  validate() {
    const warnings = [];
    if (this.items.size > this.maxItems) {
      warnings.push({
        code: 'system-menu-limit-exceeded',
        limit: this.maxItems,
        actual: this.items.size
      });
    }
    return { ok: warnings.length === 0, warnings };
  }

  snapshot() {
    return {
      maxItems: this.maxItems,
      items: [...this.items.values()].map(clone)
    };
  }

  _get(id) {
    const key = normalizeId(id);
    const item = this.items.get(key);
    if (!item) throw createOmniError('SystemMenuModel', `Menu item is not registered: ${key}`);
    return item;
  }
}

function normalizeId(id) {
  return String(id || '').trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default SystemMenuModel;
