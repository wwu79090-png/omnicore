export class BehaviorDefinition {
  constructor({ id = 'behavior', properties = {}, events = {} } = {}) {
    this.id = String(id);
    this.properties = clone(properties || {});
    this.events = clone(events || {});
  }

  attach(target = {}, { properties = {}, emit = null } = {}) {
    const runtime = {
      id: this.id,
      target,
      properties: { ...clone(this.properties), ...clone(properties || {}) },
      dispatch: (event, payload = {}) => {
        for (const action of normalizeArray(this.events[event])) {
          runAction(runtime, action, payload, emit);
        }
        syncTargetBehavior(runtime);
        return runtime;
      }
    };
    if (!target.behaviors) target.behaviors = {};
    syncTargetBehavior(runtime);
    return runtime;
  }
}

function runAction(runtime, action = {}, payload = {}, emit = null) {
  if (action.op === 'add') {
    const current = Number(getPath(runtime.properties, action.path) || 0);
    setPath(runtime.properties, action.path, current + Number(resolveValue(action.value, runtime, payload) || 0));
  }
  if (action.op === 'set') setPath(runtime.properties, action.path, resolveValue(action.value, runtime, payload));
  if (action.op === 'emit') emit?.(action.event, resolvePayload(action.payload || {}, runtime, payload));
}

function resolveValue(value, runtime, payload) {
  if (typeof value === 'string' && value.startsWith('$')) return getPath(runtime.properties, value.slice(1));
  if (typeof value === 'string' && value.startsWith('@')) return getPath(payload, value.slice(1));
  return clone(value);
}

function resolvePayload(payload, runtime, sourcePayload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, resolveValue(value, runtime, sourcePayload)])
  );
}

function syncTargetBehavior(runtime) {
  runtime.target.behaviors[runtime.id] = clone(runtime.properties);
}

function getPath(source = {}, path = '') {
  return String(path).split('.').reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function setPath(target, path, value) {
  const parts = String(path).split('.');
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  });
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

export default BehaviorDefinition;
