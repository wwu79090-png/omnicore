export class RuntimeStateSerializer {
  constructor({ include = [] } = {}) {
    this.include = include.map(String);
  }

  snapshot(target = {}) {
    const state = {};
    for (const path of this.include) setPath(state, path, clone(getPath(target, path)));
    return {
      schema: 'omnicore.runtime-state.v1',
      state
    };
  }

  diff(before = {}, after = {}) {
    const beforeState = before.state || {};
    const afterState = after.state || {};
    const changes = this.include
      .map((path) => ({
        path,
        before: clone(getPath(beforeState, path)),
        after: clone(getPath(afterState, path))
      }))
      .filter((change) => JSON.stringify(change.before) !== JSON.stringify(change.after))
      .sort((left, right) => left.path.localeCompare(right.path));
    return {
      schema: 'omnicore.runtime-state-patch.v1',
      changes
    };
  }

  apply(snapshot = {}, patch = {}) {
    const next = clone(snapshot.state || {});
    for (const change of patch.changes || []) setPath(next, change.path, clone(change.after));
    return {
      schema: snapshot.schema || 'omnicore.runtime-state.v1',
      state: next
    };
  }
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

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RuntimeStateSerializer;
