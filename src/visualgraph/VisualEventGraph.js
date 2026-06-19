import { createOmniError } from '../core/OmniError.js';
import { DEFAULT_DEBUG } from '../config/defaults.js';

/**
 * Debug-only visual event graph editor.
 *
 * @example
 * const graph = new VisualEventGraph({ debug: true });
 * graph.addNode({ id: 'check', type: 'condition', data: { op: 'equals' } });
 * graph.exportJSON();
 */
export class VisualEventGraph {
  constructor({ debug = DEFAULT_DEBUG } = {}) {
    this.debug = debug;
    this.nodes = new Map();
    this.edges = [];
    this.container = null;
    this.root = null;
    this.treeRoot = null;
  }

  addNode(node) {
    const id = node.id || `node-${this.nodes.size + 1}`;
    const normalized = {
      id,
      type: node.type || 'action',
      label: node.label || id,
      x: node.x || 0,
      y: node.y || 0,
      scope: node.scope || {},
      data: node.data || {}
    };
    this.nodes.set(id, normalized);
    this._render();
    return normalized;
  }

  connect(from, to) {
    if (!this.nodes.has(from) || !this.nodes.has(to)) throw createOmniError('VisualGraph', '连接节点前，请确认起点和终点都已存在。');
    this.edges.push({ from, to });
    this._render();
    return this;
  }

  attach(container = document.body) {
    if (!this.debug || typeof document === 'undefined') return null;
    this.container = container;
    this.root = document.createElement('div');
    this.root.dataset.omnicoreVisualGraph = 'true';
    Object.assign(this.root.style, {
      position: 'relative',
      minHeight: '220px',
      border: '1px solid #334155',
      background: '#0f172a',
      color: '#e2e8f0',
      font: '12px sans-serif',
      overflow: 'hidden'
    });
    this.container.appendChild(this.root);
    if (this.debug) {
      this.treeRoot = document.createElement('pre');
      this.treeRoot.dataset.omnicoreEventTree = 'true';
      Object.assign(this.treeRoot.style, {
        margin: '8px',
        padding: '8px',
        background: '#020617',
        color: '#e2e8f0',
        border: '1px solid #1e293b',
        maxHeight: '360px',
        overflow: 'auto'
      });
      this.root.appendChild(this.treeRoot);
    }
    this._render();
    return this.root;
  }

  detach() {
    this.root?.remove?.();
    this.root = null;
    this.treeRoot = null;
    this.container = null;
  }

  exportJSON() {
    return {
      nodes: [...this.nodes.values()].map((node) => ({ ...node, scope: { ...node.scope }, data: { ...node.data } })),
      edges: this.edges.map((edge) => ({ ...edge }))
    };
  }

  toEventSheet() {
    return {
      events: this.toEventTree().map((entry) => ({
        name: entry.name,
        ...(entry.when ? { when: entry.when } : {}),
        scope: entry.scope,
        conditions: entry.conditions || [],
        actions: entry.actions
      }))
    };
  }

  exportEventSheetJSON({ pretty = false, includeGraph = false } = {}) {
    const payload = {
      format: 'OmniCore.EventSheet',
      version: 1,
      ...this.toEventSheet()
    };
    if (includeGraph) payload.graph = this.exportJSON();
    return JSON.stringify(payload, null, pretty ? 2 : 0);
  }

  toEventTree() {
    const childrenBySource = this._childrenBySource();
    const targetedNodes = new Set(this.edges.map((edge) => edge.to));
    const rootNodes = [...this.nodes.values()].filter((node) => (this._isEventNode(node) || this._isConditionNode(node)) && !targetedNodes.has(node.id));
    const fallbackActionNodes = [...this.nodes.values()].filter((node) => this._isActionNode(node));
    if (!rootNodes.length) {
      return [{
        name: 'root',
        scope: {},
        conditions: [],
        actions: fallbackActionNodes.map((node) => node.data)
      }];
    }

    return rootNodes.map((node) => this._buildEventTree(node, childrenBySource));
  }

  _render() {
    if (!this.root) return;
    const showTree = Boolean(this.treeRoot);
    this.root.innerHTML = '';
    for (const node of this.nodes.values()) {
      this.root.appendChild(this._createNodeElement(node));
    }
    if (showTree && this.treeRoot) {
      this.treeRoot = document.createElement('pre');
      this.treeRoot.dataset.omnicoreEventTree = 'true';
      Object.assign(this.treeRoot.style, {
        margin: '8px',
        padding: '8px',
        background: '#020617',
        color: '#e2e8f0',
        border: '1px solid #1e293b',
        maxHeight: '360px',
        overflow: 'auto'
      });
      this.root.appendChild(this.treeRoot);
      const eventTree = this.toEventTree();
      this.treeRoot.textContent = JSON.stringify(eventTree, null, 2);
    }
  }

  _buildEventTree(root, childrenBySource) {
    if (this._isEventNode(root)) {
      return this._buildEventRoot(root, childrenBySource);
    }
    const visited = new Set();
    const conditionTree = this._buildConditionNode(root, childrenBySource, visited);
    const actions = this._collectActions(root, childrenBySource, new Set());
    return {
      name: root.label || root.id,
      scope: this._collectScope(root),
      conditions: conditionTree || [],
      actions
    };
  }

  _buildEventRoot(root, childrenBySource) {
    const children = childrenBySource.get(root.id) || [];
    const conditions = children
      .filter((child) => this._isConditionNode(child))
      .map((child) => this._buildConditionNode(child, childrenBySource, new Set(), root.scope || {}))
      .filter(Boolean);
    const event = {
      name: root.label || root.id,
      scope: this._collectScope(root),
      conditions,
      actions: this._collectActions(root, childrenBySource, new Set())
    };
    if (root.data?.when) {
      event.when = { ...root.data.when };
    }
    return event;
  }

  _buildConditionNode(node, childrenBySource, visited, localScope = {}) {
    if (!node) return null;
    if (visited.has(node.id)) return null;
    visited.add(node.id);
    const children = childrenBySource.get(node.id) || [];
    const nextScope = { ...localScope, ...(node.scope || {}) };
    const childConditionNodes = children.filter((child) => this._isConditionNode(child));

    const explicitOp = this._logicalOp(node);
    if (explicitOp === 'not') {
      const [nextNode] = childConditionNodes;
      const nested = nextNode ? this._buildConditionNode(nextNode, childrenBySource, visited, nextScope) : null;
      if (!nested) return null;
      return {
        op: 'not',
        conditions: [nested],
        scope: nextScope
      };
    }

    const childConditions = childConditionNodes
      .map((child) => this._buildConditionNode(child, childrenBySource, visited, nextScope))
      .filter(Boolean);

    const candidate = this._normalizeConditionData(node.data);
    if (candidate && explicitOp == null && childConditions.length === 0) {
      if (Object.keys(nextScope).length) {
        candidate.scope = nextScope;
      }
      return candidate;
    }

    if (childConditions.length === 0) {
      if (candidate) return candidate;
      return { op: 'truthy', left: true };
    }

    const mergeScope = (explicitOp === 'and' || childConditions.length > 1)
      ? { op: 'and', conditions: childConditions, scope: nextScope }
      : { ...childConditions[0], scope: { ...(childConditions[0].scope || {}), ...nextScope } };
    if (explicitOp === 'or') {
      mergeScope.op = 'or';
    }
    return mergeScope;
  }

  _collectActions(node, childrenBySource, visitedActionNodes) {
    if (!node) return [];
    const children = childrenBySource.get(node.id) || [];
    const actions = [];
    for (const child of children) {
      if (visitedActionNodes.has(child.id)) continue;
      if (this._isActionNode(child)) {
        visitedActionNodes.add(child.id);
        actions.push(child.data);
        continue;
      }
      actions.push(...this._collectActions(child, childrenBySource, visitedActionNodes));
    }
    return actions;
  }

  _childrenBySource() {
    const map = new Map();
    for (const { from, to } of this.edges) {
      const source = this.nodes.get(from);
      const target = this.nodes.get(to);
      if (!source || !target) continue;
      if (!map.has(source.id)) map.set(source.id, []);
      map.get(source.id).push(target);
    }
    return map;
  }

  _isEventNode(node) {
    return node.type === 'event';
  }

  _isConditionNode(node) {
    return node.type !== 'action' && node.type !== 'execution' && node.type !== 'event';
  }

  _isActionNode(node) {
    return node.type === 'action' || node.type === 'execution';
  }

  _logicalOp(node) {
    const configured = node?.data?.op || node?.type;
    if (configured === 'and' || configured === 'or' || configured === 'not') return configured;
    return null;
  }

  _normalizeConditionData(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.op) return { ...data };
    return {
      op: 'equals',
      left: data.left,
      right: data.right
    };
  }

  _collectScope(node) {
    return node?.scope ? { ...node.scope } : {};
  }

  _createNodeElement(node) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = node.label;
    element.dataset.nodeId = node.id;
    Object.assign(element.style, {
      position: 'absolute',
      left: `${node.x}px`,
      top: `${node.y}px`,
      minWidth: '96px',
      padding: '8px',
      border: '1px solid #64748b',
      borderRadius: '4px',
      background: node.type === 'condition' ? '#164e63' : '#365314',
      color: '#f8fafc',
      cursor: 'grab'
    });

    let start = null;
    element.addEventListener('pointerdown', (event) => {
      start = { x: event.clientX, y: event.clientY, nodeX: node.x, nodeY: node.y };
      element.setPointerCapture?.(event.pointerId);
    });
    element.addEventListener('pointermove', (event) => {
      if (!start) return;
      node.x = start.nodeX + event.clientX - start.x;
      node.y = start.nodeY + event.clientY - start.y;
      element.style.left = `${node.x}px`;
      element.style.top = `${node.y}px`;
    });
    element.addEventListener('pointerup', () => {
      start = null;
    });
    return element;
  }
}

export default VisualEventGraph;
