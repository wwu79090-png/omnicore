import { createOmniError } from '../core/OmniError.js';

const BEHAVIOR_STATUS = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  RUNNING: 'running'
});

/**
 * JSON behavior tree runtime for Event Sheet scale-ups.
 *
 * Supports `selector`, `sequence`, `condition`, `action`, and `repeat` nodes so
 * designers can express branches such as "if A exists and B is close, do C,
 * otherwise repeat D" without hand-written update code.
 *
 * @example
 * const tree = BehaviorTree.fromJSON({
 *   type: 'selector',
 *   children: [
 *     { type: 'sequence', children: [
 *       { type: 'condition', op: 'exists', target: 'entities.player' },
 *       { type: 'action', op: 'call', name: 'attack' }
 *     ] },
 *     { type: 'action', op: 'call', name: 'patrol' }
 *   ]
 * });
 * tree.tick(runtime);
 */
export class BehaviorTree {
  constructor(root, options = {}) {
    this.root = root || { type: 'success' };
    this.debug = Boolean(options.debug);
  }

  static fromJSON(json, options = {}) {
    return new BehaviorTree(json?.root || json, options);
  }

  tick(runtime = {}) {
    return this._tickNode(this.root, runtime);
  }

  _tickNode(node, runtime) {
    const currentNode = node || {};
    switch (currentNode.type || currentNode.op) {
      case 'success':
        return BEHAVIOR_STATUS.SUCCESS;
      case 'failure':
        return BEHAVIOR_STATUS.FAILURE;
      case 'selector':
        return this._tickSelector(currentNode, runtime);
      case 'sequence':
        return this._tickSequence(currentNode, runtime);
      case 'condition':
        return this._evaluateCondition(currentNode, runtime) ? BEHAVIOR_STATUS.SUCCESS : BEHAVIOR_STATUS.FAILURE;
      case 'action':
        return this._runAction(currentNode, runtime);
      case 'inverter': {
        const status = this._tickNode(currentNode.child || currentNode.children?.[0], runtime);
        if (status === BEHAVIOR_STATUS.SUCCESS) return BEHAVIOR_STATUS.FAILURE;
        if (status === BEHAVIOR_STATUS.FAILURE) return BEHAVIOR_STATUS.SUCCESS;
        return status;
      }
      case 'repeat':
        return this._tickRepeat(currentNode, runtime);
      default:
        throw createOmniError('BehaviorTree', `不支持的行为树节点：${currentNode.type || currentNode.op}`);
    }
  }

  _tickSelector(node, runtime) {
    for (const child of node.children || []) {
      const status = this._tickNode(child, runtime);
      if (status !== BEHAVIOR_STATUS.FAILURE) return status;
    }
    return BEHAVIOR_STATUS.FAILURE;
  }

  _tickSequence(node, runtime) {
    for (const child of node.children || []) {
      const status = this._tickNode(child, runtime);
      if (status !== BEHAVIOR_STATUS.SUCCESS) return status;
    }
    return BEHAVIOR_STATUS.SUCCESS;
  }

  _tickRepeat(node, runtime) {
    const count = node.count ?? node.times ?? 1;
    let status = BEHAVIOR_STATUS.SUCCESS;
    for (let index = 0; index < count; index += 1) {
      status = this._tickNode(node.child || node.children?.[0], runtime);
      if (status === BEHAVIOR_STATUS.FAILURE && node.untilFailure !== true) return status;
      if (status === BEHAVIOR_STATUS.SUCCESS && node.untilSuccess) return status;
    }
    return status;
  }

  _evaluateCondition(node, runtime) {
    switch (node.op) {
      case 'exists':
        return getPath(runtime, node.target || node.path) != null;
      case 'truthy':
        return Boolean(getPath(runtime, node.target || node.path));
      case 'equals':
        return getPath(runtime, node.left) === resolveValue(node.right, runtime);
      case 'notEquals':
        return getPath(runtime, node.left) !== resolveValue(node.right, runtime);
      case 'gt':
        return getPath(runtime, node.left) > resolveValue(node.right, runtime);
      case 'gte':
        return getPath(runtime, node.left) >= resolveValue(node.right, runtime);
      case 'lt':
        return getPath(runtime, node.left) < resolveValue(node.right, runtime);
      case 'lte':
        return getPath(runtime, node.left) <= resolveValue(node.right, runtime);
      case 'distanceLessThan': {
        const left = getPath(runtime, node.left);
        const right = getPath(runtime, node.right);
        return Boolean(left && right && distance(left, right) < (node.distance ?? node.value ?? 0));
      }
      default:
        throw createOmniError('BehaviorTree', `不支持的行为树条件：${node.op}`);
    }
  }

  _runAction(node, runtime) {
    switch (node.op) {
      case 'call': {
        const result = runtime.actions?.[node.name]?.(runtime, node);
        return normalizeStatus(result);
      }
      case 'set':
        setPath(runtime, node.target, resolveValue(node.value, runtime));
        return BEHAVIOR_STATUS.SUCCESS;
      case 'emit':
        runtime.emit?.(node.event, resolveValue(node.payload, runtime));
        return BEHAVIOR_STATUS.SUCCESS;
      default:
        throw createOmniError('BehaviorTree', `不支持的行为树动作：${node.op}`);
    }
  }
}

function normalizeStatus(result) {
  if (result === BEHAVIOR_STATUS.RUNNING || result === BEHAVIOR_STATUS.FAILURE || result === BEHAVIOR_STATUS.SUCCESS) {
    return result;
  }
  if (result === false) return BEHAVIOR_STATUS.FAILURE;
  return BEHAVIOR_STATUS.SUCCESS;
}

function getPath(target, path) {
  if (!path) return undefined;
  return String(path)
    .split('.')
    .reduce((value, key) => (value == null ? undefined : value[key]), target);
}

function setPath(target, path, value) {
  const parts = String(path).split('.');
  const key = parts.pop();
  const owner = parts.reduce((object, part) => {
    if (!object[part]) object[part] = {};
    return object[part];
  }, target);
  owner[key] = value;
}

function resolveValue(value, runtime) {
  if (value && typeof value === 'object' && '$path' in value) return getPath(runtime, value.$path);
  return value;
}

function distance(left, right) {
  const dx = (left.x || 0) - (right.x || 0);
  const dy = (left.y || 0) - (right.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export default BehaviorTree;
