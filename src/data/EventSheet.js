import { createOmniError } from '../core/OmniError.js';
import { DEFAULT_DEBUG } from '../config/defaults.js';
import BehaviorTree from '../behavior/BehaviorTree.js';
import StateBehaviorTree from '../behaviortree/BehaviorTree.js';

/**
 * JSON-based Event Sheet runtime inspired by Construct 3 and GDevelop.
 *
 * Events execute from top to bottom. Each event has `conditions` and `actions`.
 *
 * @example
 * const sheet = EventSheet.parse({
 *   events: [{ conditions: [{ op: 'equals', left: 'state.score', right: 3 }],
 *   actions: [{ op: 'set', target: 'state.win', value: true }] }]
 * });
 * sheet.run({ state: { score: 3 } });
 */
const MAX_RECURSION_DEPTH = 20;
const FRAME_CACHE_GRANULARITY_MS = 16;

function getPath(target, path) {
  return String(path)
    .split('.')
    .reduce((value, key) => (value == null ? undefined : value[key]), target);
}

function compilePath(path) {
  if (path == null) return () => undefined;
  const parts = String(path).split('.');
  return (target) => {
    let value = target;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return undefined;
    }
    return value;
  };
}

function toArray(value) {
  return value == null ? [] : Array.isArray(value) ? value : [value];
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

function entityId(entity) {
  return entity?.id || entity?.name || entity?.texture || entity;
}

function normalizeConditionValue(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'function') return 'function';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

export class EventSheet {
  constructor(events = [], { debug = DEFAULT_DEBUG, scope = {}, watch = [], compile = false, functions = {} } = {}) {
    this.events = events;
    this.functions = normalizeFunctionEvents(functions);
    this.debug = debug;
    this.compileNative = Boolean(compile);
    this.compiledNativeFunctions = 0;
    this.compiledConditionFunctions = [];
    this.conditionAst = [];
    this.compilationCacheKey = '';
    this.scope = { ...scope };
    this.watch = [...watch];
    this.store = null;
    this.entity = null;
    this.eventBus = null;
    this.unsubscribeStore = [];
    this.unsubscribeEvents = [];
    this.behaviorTree = null;
    this.debugTree = debug ? this._buildDebugTree() : null;
    this._conditionCache = new WeakMap();
    this._errors = [];
    this._conditionCacheByFrame = new Map();
    this._frameSignature = null;
    this._ruleDepth = 0;
    this._ruleStack = [];
  }

  static parse(json, { includeResolver, debug = json?.debug ?? DEFAULT_DEBUG, compile = false } = {}) {
    const events = [];
    for (const event of json.events || []) {
      if (event.include && includeResolver) {
        events.push(...EventSheet.parse(includeResolver(event.include), { includeResolver, debug, compile }).events);
      } else {
        events.push(event);
      }
    }
    const sheet = new EventSheet(events, {
      debug,
      scope: json.scope || {},
      watch: json.watch || [],
      compile,
      functions: json.functions || {}
    });
    if (json.states) sheet.behaviorTree = new StateBehaviorTree(json);
    return sheet;
  }

  static parseBehaviorTree(json, options = {}) {
    return BehaviorTree.fromJSON(json?.behaviorTree || json, options);
  }

  static toBehaviorTree(json, options = {}) {
    const sourceEvents = Array.isArray(json) ? json : json?.events || [];
    return BehaviorTree.fromJSON({
      type: 'selector',
      children: sourceEvents.map((event) => ({
        type: 'sequence',
        children: [
          ...conditionsToNodes(event.conditions || []),
          ...(event.actions || []).map(actionToNode)
        ]
      }))
    }, options);
  }

  run(runtime = {}) {
    this._errors.length = 0;
    this._enterFrame(runtime);

    const result = this._runWithRuleDepth(this._eventPosition('run'), () => {
      for (let index = 0; index < this.events.length; index += 1) {
        const event = this.events[index];
        if (event.enabled === false) continue;
        const scopedRuntime = this._createScopedRuntime(runtime, event);
        scopedRuntime.__eventSheetErrors = [];

        const eventPass = this._conditionsPass(event.conditions || [], scopedRuntime);
        if (eventPass) {
          this._runActions(event.actions || [], scopedRuntime, { index });
        }

        this._errors.push(...scopedRuntime.__eventSheetErrors);
      }
      return this;
    });
    return result === false ? this : result;
  }

  runWithTrace(runtime = {}) {
    this._errors.length = 0;
    this._enterFrame(runtime);
    const trace = { events: [], errors: this._errors };
    this._runWithRuleDepth(this._eventPosition('runWithTrace'), () => {
      for (let index = 0; index < this.events.length; index += 1) {
        const event = this.events[index];
        const group = event.group || event.name || `event-${index}`;
        if (event.enabled === false) {
          trace.events.push({ index, group, passed: false, skipped: true });
          continue;
        }
        const scopedRuntime = this._createScopedRuntime(runtime, event);
        scopedRuntime.__eventSheetErrors = [];
        const passed = this._conditionsPass(event.conditions || [], scopedRuntime);
        trace.events.push({ index, group, passed, skipped: false });
        if (passed) this._runActions(event.actions || [], scopedRuntime, { index });
        this._errors.push(...scopedRuntime.__eventSheetErrors);
      }
    });
    return trace;
  }

  attach({ store, events, entity } = {}) {
    this.detach();
    this.store = store || null;
    this.eventBus = events || null;
    this.entity = entity || null;
    if (this.behaviorTree) this.behaviorTree.attach({ store: this.store, events: this.eventBus, entity: this.entity });
    const keys = this.watch.length ? this.watch : [];
    for (const key of keys) {
      const off = this.store?.subscribe?.(key, () => this._runReactive());
      if (off) this.unsubscribeStore.push(off);
    }
    this._bindTriggers();
    return this;
  }

  detach() {
    for (const off of this.unsubscribeStore) off?.();
    for (const off of this.unsubscribeEvents) off?.();
    this.behaviorTree?.detach?.();
    this.unsubscribeStore.length = 0;
    this.unsubscribeEvents.length = 0;
    this.store = null;
    this.eventBus = null;
    this.entity = null;
  }

  onAdd(owner) {
    const game = owner?.parent?.game || owner?.game || null;
    if (game?.store) this.attach({ store: game.store, events: game.events, entity: owner });
  }

  onRemove() {
    this.detach();
  }

  _enterFrame(runtime) {
    const signature = this._resolveFrameSignature(runtime);
    if (signature === this._frameSignature) return;
    this._frameSignature = signature;
    this._conditionCacheByFrame.clear();
  }

  _conditionsPass(conditions, runtime) {
    return this._evaluateCondition(conditions, runtime);
  }

  _evaluateCondition(condition, runtime) {
    try {
      const evaluator = this._getConditionEvaluator(condition);
      return evaluator ? Boolean(evaluator(runtime)) : true;
    } catch (error) {
      this._handleRuntimeError('condition', error, runtime);
      return false;
    }
  }

  _getConditionEvaluator(condition) {
    if (condition == null) return null;
    if (!this._conditionCache.has(condition)) {
      this._conditionCache.set(condition, this._compileConditionEvaluator(condition));
    }
    return this._conditionCache.get(condition);
  }

  _compileConditionEvaluator(condition) {
    if (!condition) return () => true;
    if (Array.isArray(condition)) {
      const evaluators = toArray(condition).map((item) => this._compileConditionEvaluator(item));
      return (runtime) => {
        for (const evaluate of evaluators) {
          if (!evaluate(runtime)) return false;
        }
        return true;
      };
    }
    if (typeof condition !== 'object') {
      return () => {
        throw createOmniError('EventSheet', `不支持的事件条件：${String(condition)}`);
      };
    }

    const { op, condition: nestedCondition, conditions, children } = condition;
    if (op === 'and') {
      const evaluators = toArray(conditions || children).map((item) => this._compileConditionEvaluator(item));
      return (runtime) => {
        for (const evaluate of evaluators) {
          if (!evaluate(runtime)) return false;
        }
        return true;
      };
    }

    if (op === 'or') {
      const evaluators = toArray(conditions || children).map((item) => this._compileConditionEvaluator(item));
      return (runtime) => {
        for (const evaluate of evaluators) {
          if (evaluate(runtime)) return true;
        }
        return false;
      };
    }

    if (op === 'not') {
      const child = nestedCondition || children?.[0] || null;
      const evaluator = this._compileConditionEvaluator(child);
      return (runtime) => !evaluator(runtime);
    }

    return this._compileLeafConditionEvaluator(condition);
  }

  _compileLeafConditionEvaluator(condition) {
    if (this.compileNative) {
      const native = this._compileNativeLeafCondition(condition);
      if (native) return native;
    }
    const leftResolver = compilePath(condition.left);
    const resolveRightValue = (runtime) => resolveValue(condition.right, runtime);

    return (runtime) => {
      const left = leftResolver(runtime);
      const right = resolveRightValue(runtime);
      const cacheKey = this._buildConditionCacheKey(condition, left, right);
      if (this._conditionCacheByFrame.has(cacheKey)) {
        return this._conditionCacheByFrame.get(cacheKey);
      }

      let result = false;
      switch (condition.op) {
        case 'equals':
          result = left === right;
          break;
        case 'notEquals':
          result = left !== right;
          break;
        case 'gt':
          result = left > right;
          break;
        case 'gte':
          result = left >= right;
          break;
        case 'lt':
          result = left < right;
          break;
        case 'lte':
          result = left <= right;
          break;
        case 'truthy':
          result = Boolean(left);
          break;
        case 'falsy':
          result = !left;
          break;
        default:
          throw createOmniError('EventSheet', `不支持的事件条件：${condition.op}`);
      }

      this._conditionCacheByFrame.set(cacheKey, result);
      return result;
    };
  }

  _compileNativeLeafCondition(condition) {
    const opMap = {
      equals: (left, right) => left === right,
      notEquals: (left, right) => left !== right,
      gt: (left, right) => left > right,
      gte: (left, right) => left >= right,
      lt: (left, right) => left < right,
      lte: (left, right) => left <= right
    };
    const compare = opMap[condition?.op];
    if (!condition || !compare) return null;
    const leftResolver = compilePath(condition.left);
    const rightResolver = condition.right && typeof condition.right === 'object' && '$path' in condition.right
      ? compilePath(condition.right.$path)
      : null;
    const fn = (runtime) => compare(
      leftResolver(runtime),
      rightResolver ? rightResolver(runtime) : condition.right
    );
    this.compiledNativeFunctions += 1;
    this.compiledConditionFunctions.push(fn);
    this.conditionAst.push({
      op: condition.op,
      left: condition.left,
      right: condition.right
    });
    this.compilationCacheKey = `${this.compilationCacheKey}|${condition.op}:${condition.left}`;
    return (runtime) => {
      const cacheKey = `${condition.left}|${condition.op}|${normalizeConditionValue(condition.right)}|native`;
      if (this._conditionCacheByFrame.has(cacheKey)) return this._conditionCacheByFrame.get(cacheKey);
      const result = Boolean(fn(runtime, getPath));
      this._conditionCacheByFrame.set(cacheKey, result);
      return result;
    };
  }

  _evaluateLeafCondition(condition, runtime) {
    const evaluator = this._compileLeafConditionEvaluator(condition);
    return evaluator(runtime);
  }

  _runActions(actions, runtime, eventInfo = {}) {
    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index];
      try {
        this._runAction(action, runtime, eventInfo, index);
      } catch (error) {
        this._handleRuntimeError('action', error, runtime, action);
      }
    }
  }

  _runAction(action, runtime, eventInfo = {}, actionIndex = 0) {
    if (!action || typeof action !== 'object') {
      throw createOmniError('EventSheet', '不支持的事件动作：无效动作定义');
    }
    if (action.op === 'execute') {
      this._runWithRuleDepth(this._eventPosition('execute', eventInfo.index, actionIndex, action.op), () => {
        this._executeStoreFunction(action.name, runtime, eventInfo);
      });
      return;
    }
    if (action.op === 'function') {
      this._runWithRuleDepth(this._eventPosition('function', eventInfo.index, actionIndex, action.name), () => {
        this._runActions(this.functions[action.name] || [], runtime, eventInfo);
      });
      return;
    }
    if (action.op === 'set' && runtime.__store && String(action.target).startsWith('store.')) {
      runtime.__store.set(String(action.target).slice(6), resolveValue(action.value, runtime));
      return;
    }

    switch (action.op) {
      case 'set':
        setPath(runtime, action.target, resolveValue(action.value, runtime));
        break;
      case 'inc':
        setPath(runtime, action.target, (getPath(runtime, action.target) || 0) + resolveValue(action.value, runtime));
        break;
      case 'emit': {
        const payloadValue = resolveValue(Object.hasOwn(action, 'payload') ? action.payload : action.value, runtime);
        const payload = { event: action.event, payload: payloadValue };
        if (typeof runtime.emit === 'function') runtime.emit(payload.event, payload.payload);
        else {
          runtime.events = runtime.events || [];
          runtime.events.push(payload);
        }
        break;
      }
      case 'call':
        runtime.actions?.[action.name]?.(runtime, action);
        break;
      default:
        throw createOmniError('EventSheet', `不支持的事件动作：${action.op}`);
    }
  }

  _handleRuntimeError(type, error, runtime, node = null) {
    const issue = {
      type,
      node,
      message: error?.message || String(error),
      stack: error?.stack
    };
    runtime?.__eventSheetErrors?.push?.(issue);
    this._errors.push(issue);
    if (this.debug) {
      console?.warn('[OmniCore] [EventSheet] 执行异常已隔离', issue);
    }
  }

  debugPreview() {
    this.debugTree = this._buildDebugTree();
    if (this.behaviorTree) this.debugTree.behaviorTree = this.behaviorTree.debugTree();
    return this.debugTree;
  }

  _createScopedRuntime(runtime, event) {
    if (runtime.__reactive) {
      Object.assign(this.scope, event.scope || event.locals || {});
      return {
        ...runtime,
        local: this.scope
      };
    }
    return {
      ...runtime,
      local: { ...(event.scope || event.locals || {}) }
    };
  }

  _runReactive() {
    if (!this.store) return;
    this.run({
      __reactive: true,
      __store: this.store,
      store: this.store.snapshot(),
      entity: this.entity,
      emit: (event, payload) => this.eventBus?.emit?.(event, payload)
    });
  }

  _bindTriggers() {
    if (!this.eventBus?.on || !this.events.some((event) => event.when?.onCollideWith)) return;
    this.unsubscribeEvents.push(this.eventBus.on('collision', (payload) => {
      for (let eventIndex = 0; eventIndex < this.events.length; eventIndex += 1) {
        const event = this.events[eventIndex];
        if (!this._triggerMatches(event.when, payload)) continue;
        const runtime = this._createTriggerRuntime(payload);
        if (event.execute) {
          this._runWithRuleDepth(this._eventPosition('trigger', eventIndex), () => {
            this._executeStoreFunction(event.execute, runtime, { index: eventIndex });
          });
        }
        this._runActions(event.actions || [], runtime, { index: eventIndex });
      }
    }));
  }

  _triggerMatches(trigger, payload = {}) {
    if (!trigger?.onCollideWith) return false;
    const ownerId = trigger.on || this.entity?.id || this.entity?.name;
    const otherId = trigger.onCollideWith;
    const sourceId = entityId(payload.source);
    const targetId = entityId(payload.target);
    return (sourceId === ownerId && targetId === otherId) || (sourceId === otherId && targetId === ownerId);
  }

  _createTriggerRuntime(payload) {
    return {
      __reactive: true,
      __store: this.store,
      store: this.store,
      local: this.scope,
      entity: this.entity,
      event: payload,
      emit: (event, data) => this.eventBus?.emit?.(event, data)
    };
  }

  _executeStoreFunction(name, runtime, eventInfo = {}) {
    const fn = this.store?.get?.(name);
    if (typeof fn === 'function') return fn(runtime, this, eventInfo);
    return undefined;
  }

  _runWithRuleDepth(position, callback) {
    if (this._ruleDepth >= MAX_RECURSION_DEPTH) {
      console?.warn('[OmniCore] [EventSheet] 规则链过深，已强制阻断', {
        position: this._formatRulePosition(position),
        stack: this._formatRuleStack()
      });
      return false;
    }
    this._ruleDepth += 1;
    this._ruleStack.push(position);
    try {
      return callback();
    } finally {
      this._ruleStack.pop();
      this._ruleDepth -= 1;
    }
  }

  _eventPosition(type = 'rule', eventIndex = null, actionIndex = null, actionName = null) {
    return {
      type,
      eventIndex,
      actionIndex,
      actionName
    };
  }

  _formatRuleStack() {
    return this._ruleStack.map((item) => this._formatRulePosition(item)).join(' -> ');
  }

  _formatRulePosition(item) {
    if (!item || typeof item !== 'object') return 'unknown';
    const eventText = item.eventIndex == null ? '' : `event=${item.eventIndex}`;
    const actionText = item.actionIndex == null ? '' : ` action=${item.actionIndex}`;
    const opText = item.actionName ? ` ${item.actionName}` : '';
    const prefix = item.type || 'rule';
    return `${prefix}(${eventText}${actionText}${opText})`;
  }

  _resolveFrameSignature(runtime) {
    const explicit = runtime?.frame ?? runtime?.__frame ?? runtime?.time ?? runtime?.timestamp;
    if (Number.isFinite(explicit)) return `frame:${explicit}`;
    const now = typeof performance === 'undefined' ? Date.now() : performance.now();
    return `bucket:${Math.floor(now / FRAME_CACHE_GRANULARITY_MS)}`;
  }

  _buildConditionCacheKey(condition, left, right) {
    return `${condition.left || ''}|${condition.op}|${normalizeConditionValue(left)}|${normalizeConditionValue(right)}`;
  }

  _buildDebugTree() {
    return this.events.map((event, index) => ({
      index,
      name: event.name || event.id || `event-${index}`,
      trigger: event.when || null,
      execute: event.execute,
      conditions: this._conditionDebugNode(event.conditions || []),
      actions: (event.actions || []).map((action) => ({
        op: action.op,
        target: action.target,
        name: action.name,
        event: action.event
      }))
    }));
  }

  _conditionDebugNode(condition) {
    if (Array.isArray(condition)) {
      return {
        op: 'and',
        children: condition.map((item) => this._conditionDebugNode(item))
      };
    }
    if (!condition) return { op: 'always', children: [] };
    const children = condition.conditions || condition.children;
    if (children) {
      return {
        op: condition.op || 'and',
        children: children.map((item) => this._conditionDebugNode(item))
      };
    }
    if (condition.op === 'not') {
      return {
        op: 'not',
        children: [this._conditionDebugNode(condition.condition)]
      };
    }
    return {
      op: condition.op,
      left: condition.left,
      right: condition.right
    };
  }
}

function conditionsToNodes(condition) {
  if (Array.isArray(condition)) return condition.map(conditionToNode);
  if (!condition) return [];
  return [conditionToNode(condition)];
}

function conditionToNode(condition) {
  const children = condition.conditions || condition.children || [];
  if (condition.op === 'and') return { type: 'sequence', children: children.map(conditionToNode) };
  if (condition.op === 'or') return { type: 'selector', children: children.map(conditionToNode) };
  if (condition.op === 'not') return { type: 'inverter', child: conditionToNode(condition.condition || children[0]) };
  return { type: 'condition', ...condition };
}

function actionToNode(action) {
  return { type: 'action', ...action };
}

function normalizeFunctionEvents(functions = {}) {
  return Object.fromEntries(Object.entries(functions || {}).map(([name, value]) => [
    name,
    Array.isArray(value) ? value : value?.actions || []
  ]));
}

export default EventSheet;
