import { createOmniError } from '../core/OmniError.js';

export class ComponentTreeRuntime {
  constructor() {
    this.nodes = new Map();
    this.nodes.set('root', {
      id: 'root',
      parentId: null,
      component: {},
      children: [],
      priority: 0,
      loaded: true,
      mounted: true
    });
  }

  add(component = {}, parentId = 'root') {
    if (!component.id) throw createOmniError('ComponentTreeRuntime', 'Component id is required.');
    const id = String(component.id);
    const parent = this._node(parentId);
    if (this.nodes.has(id)) throw createOmniError('ComponentTreeRuntime', `Component already exists: ${id}`);
    const node = {
      id,
      parentId: parent.id,
      component,
      children: [],
      priority: Number(component.priority || 0),
      loaded: false,
      mounted: false
    };
    this.nodes.set(id, node);
    parent.children.push(id);
    this._sortChildren(parent);
    if (parent.mounted) this._mount(node);
    return this;
  }

  update(dt = 0) {
    this._traverse('root', (node) => {
      if (node.id !== 'root' && node.mounted) node.component.update?.(this._context(node), dt);
    });
    return this;
  }

  render(target = {}) {
    this._traverse('root', (node) => {
      if (node.id !== 'root' && node.mounted) node.component.render?.(this._context(node), target);
    });
    return this;
  }

  remove(id) {
    const node = this._node(id);
    if (node.id === 'root') throw createOmniError('ComponentTreeRuntime', 'Root component cannot be removed.');
    this._removeRecursive(node);
    return this;
  }

  snapshot() {
    const result = [];
    this._traverse('root', (node) => {
      result.push({
        id: node.id,
        parentId: node.parentId,
        priority: node.priority,
        mounted: node.mounted
      });
    });
    return result;
  }

  _mount(node) {
    if (!node.loaded) {
      node.component.onLoad?.(this._context(node));
      node.loaded = true;
    }
    node.mounted = true;
    node.component.onMount?.(this._context(node));
    for (const childId of node.children) this._mount(this._node(childId));
  }

  _removeRecursive(node) {
    for (const childId of [...node.children]) this._removeRecursive(this._node(childId));
    node.component.onRemove?.(this._context(node));
    const parent = this.nodes.get(node.parentId);
    if (parent) parent.children = parent.children.filter((childId) => childId !== node.id);
    this.nodes.delete(node.id);
  }

  _traverse(id, visitor) {
    const node = this._node(id);
    visitor(node);
    for (const childId of node.children) this._traverse(childId, visitor);
  }

  _sortChildren(node) {
    node.children.sort((a, b) => {
      const left = this._node(a);
      const right = this._node(b);
      return left.priority - right.priority || left.id.localeCompare(right.id);
    });
  }

  _context(node) {
    return {
      runtime: this,
      id: node.id,
      parentId: node.parentId,
      component: node.component
    };
  }

  _node(id) {
    const node = this.nodes.get(String(id));
    if (!node) throw createOmniError('ComponentTreeRuntime', `Component is not registered: ${id}`);
    return node;
  }
}

export default ComponentTreeRuntime;
