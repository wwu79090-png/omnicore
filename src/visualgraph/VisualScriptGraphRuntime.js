const DEFAULT_MAX_STEPS = 256;

/**
 * Executable visual scripting graph runtime inspired by Blueprint, Unity Visual Scripting,
 * Godot signals, and event-sheet engines.
 */
export class VisualScriptGraphRuntime {
  constructor({
    graph = {},
    actions = {},
    signals = null,
    maxSteps = DEFAULT_MAX_STEPS
  } = {}) {
    this.graph = normalizeGraph(graph);
    this.actions = { ...actions };
    this.signals = signals;
    this.maxSteps = Number.isFinite(maxSteps) ? maxSteps : DEFAULT_MAX_STEPS;
    this.variables = clone(graph.variables || {});
    this.nodes = new Map(this.graph.nodes.map((node) => [node.id, node]));
    this.edges = [...this.graph.edges];
  }

  static crossEngineProfile() {
    return {
      sources: [
        {
          engine: 'Unreal Blueprint',
          advantage: 'event-entry execution graphs, branch pins, and debug traces'
        },
        {
          engine: 'Unity Visual Scripting',
          advantage: 'runtime variables and custom action units'
        },
        {
          engine: 'Godot Signals',
          advantage: 'signal-first decoupled gameplay flow'
        },
        {
          engine: 'Construct / GDevelop Event Sheets',
          advantage: 'beginner-friendly condition/action authoring diagnostics'
        }
      ],
      localCapabilities: [
        'event-entry-nodes',
        'branch-pins',
        'runtime-variables',
        'custom-action-bindings',
        'signal-emission',
        'authoring-diagnostics',
        'execution-trace'
      ]
    };
  }

  validate() {
    const issues = [];
    const ids = new Set();
    const duplicated = new Set();

    for (const node of this.graph.nodes) {
      if (ids.has(node.id)) duplicated.add(node.id);
      ids.add(node.id);
      if (node.type === 'event' && !node.event) {
        issues.push(issue('missing-event-name', node.id, '事件入口节点缺少 event 名称。'));
      }
      if (node.type === 'call' && !this.actions[node.action || node.name]) {
        issues.push(issue('missing-action', node.id, `未注册动作：${node.action || node.name || 'unknown'}`));
      }
    }

    for (const id of duplicated) {
      issues.push(issue('duplicate-node', id, `重复节点 id：${id}`));
    }

    for (const edge of this.graph.edges) {
      if (!ids.has(edge.from)) {
        issues.push(issue('missing-node', edge.from, `连线起点不存在：${edge.from}`));
      }
      if (!ids.has(edge.to)) {
        issues.push(issue('missing-node', edge.to, `连线终点不存在：${edge.to}`));
      }
    }

    const orderedIssues = issues.sort(compareIssues);

    return {
      ok: orderedIssues.length === 0,
      summary: {
        nodeCount: this.graph.nodes.length,
        edgeCount: this.graph.edges.length,
        eventCount: this.graph.nodes.filter((node) => node.type === 'event').length,
        issueCount: orderedIssues.length
      },
      issues: orderedIssues
    };
  }

  trigger(eventName, payload = {}, options = {}) {
    const trace = [];
    const events = [];
    const startNodes = this.graph.nodes.filter((node) => node.type === 'event' && node.event === eventName);
    const context = {
      payload,
      events,
      trace,
      options
    };

    for (const node of startNodes) {
      this.#executeFrom(node.id, context);
    }

    return {
      event: eventName,
      payload,
      variables: clone(this.variables),
      events,
      trace
    };
  }

  get(path) {
    return getPath(this.#state(), path);
  }

  set(path, value) {
    setPath(this.#state(), path, value);
    return value;
  }

  #executeFrom(startNodeId, context) {
    const queue = [{ nodeId: startNodeId, fromPin: null }];
    let steps = 0;

    while (queue.length) {
      steps += 1;
      if (steps > this.maxSteps) {
        context.trace.push({
          nodeId: startNodeId,
          type: 'guard',
          skipped: true,
          reason: 'max-steps-exceeded'
        });
        return;
      }

      const { nodeId } = queue.shift();
      const node = this.nodes.get(nodeId);
      if (!node) {
        context.trace.push({ nodeId, type: 'missing', skipped: true });
        continue;
      }

      const nextPins = this.#executeNode(node, context);
      const candidates = this.edges.filter((edge) => edge.from === node.id);
      for (const edge of candidates) {
        if (shouldFollowEdge(edge, nextPins)) {
          queue.push({ nodeId: edge.to, fromPin: edge.pin || null });
        }
      }
    }
  }

  #executeNode(node, context) {
    switch (node.type) {
      case 'event':
        context.trace.push({ nodeId: node.id, type: node.type, event: node.event });
        return ['out'];
      case 'branch':
      case 'condition': {
        const passed = this.#evaluateCondition(node.condition || node.data || node, context);
        context.trace.push({ nodeId: node.id, type: 'branch', result: passed });
        return [String(Boolean(passed))];
      }
      case 'set': {
        const value = this.#resolve(node.value, context);
        this.set(node.target, value);
        context.trace.push({ nodeId: node.id, type: node.type, target: node.target, value });
        return ['out'];
      }
      case 'call': {
        const actionName = node.action || node.name;
        const action = this.actions[actionName];
        const args = this.#resolve(node.args || {}, context);
        const result = action?.({
          runtime: this,
          node,
          args,
          payload: context.payload,
          variables: this.variables,
          options: context.options
        });
        context.trace.push({ nodeId: node.id, type: node.type, action: actionName, args, result });
        return ['out'];
      }
      case 'emit': {
        const payload = this.#resolve(node.payload || {}, context);
        const entry = { event: node.event, payload };
        context.events.push(entry);
        this.#emit(node.event, payload);
        context.trace.push({ nodeId: node.id, type: node.type, event: node.event, payload });
        return ['out'];
      }
      default:
        context.trace.push({
          nodeId: node.id,
          type: node.type || 'unknown',
          skipped: true,
          reason: 'unsupported-node-type'
        });
        return [];
    }
  }

  #evaluateCondition(condition, context) {
    const normalizedCondition = condition || {};
    const left = this.#resolve(normalizedCondition.left, context);
    const right = this.#resolve(normalizedCondition.right, context);
    switch (normalizedCondition.op) {
      case 'equals':
      case '==':
      case '===':
        return left === right;
      case 'notEquals':
      case '!=':
      case '!==':
        return left !== right;
      case '>':
      case 'gt':
        return left > right;
      case '>=':
      case 'gte':
        return left >= right;
      case '<':
      case 'lt':
        return left < right;
      case '<=':
      case 'lte':
        return left <= right;
      case 'truthy':
        return Boolean(left);
      case 'falsy':
        return !left;
      default:
        return Boolean(left);
    }
  }

  #resolve(value, context) {
    if (typeof value === 'string' && value.startsWith('$')) {
      return getPath({
        variables: this.variables,
        payload: context.payload,
        options: context.options
      }, value.slice(1));
    }
    if (Array.isArray(value)) return value.map((item) => this.#resolve(item, context));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, this.#resolve(child, context)])
      );
    }
    return value;
  }

  #emit(event, payload) {
    if (!event) return;
    if (typeof this.signals?.emit === 'function') {
      this.signals.emit(event, payload);
      return;
    }
    if (typeof this.signals?.signal === 'function') {
      this.signals.signal(event).emit(payload);
    }
  }

  #state() {
    return {
      variables: this.variables
    };
  }
}

function normalizeGraph(graph = {}) {
  return {
    variables: clone(graph.variables || {}),
    nodes: normalizeArray(graph.nodes).map((node, index) => ({
      ...node,
      id: String(node.id || `node-${index + 1}`),
      type: String(node.type || 'call')
    })),
    edges: normalizeArray(graph.edges).map((edge) => ({
      ...edge,
      from: String(edge.from),
      to: String(edge.to),
      pin: edge.pin == null ? null : String(edge.pin)
    }))
  };
}

function shouldFollowEdge(edge, pins) {
  if (!edge.pin) return true;
  return pins.includes(String(edge.pin));
}

function issue(code, nodeId, message) {
  return { code, nodeId, message };
}

function compareIssues(left, right) {
  const priority = {
    'missing-node': 0,
    'duplicate-node': 1,
    'missing-event-name': 2,
    'missing-action': 3
  };
  return (priority[left.code] ?? 99) - (priority[right.code] ?? 99)
    || String(left.nodeId).localeCompare(String(right.nodeId))
    || String(left.message).localeCompare(String(right.message));
}

function getPath(source = {}, path = '') {
  return String(path).split('.').reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function setPath(target, path, value) {
  const parts = String(path).split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default VisualScriptGraphRuntime;
