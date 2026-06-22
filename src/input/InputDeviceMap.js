export class InputDeviceMap {
  constructor({ actions = {} } = {}) {
    this.actions = Object.fromEntries(
      Object.entries(actions || {}).map(([action, bindings]) => [action, normalizeBindings(bindings)])
    );
  }

  match(event = {}) {
    const matches = [];
    for (const [action, bindings] of Object.entries(this.actions)) {
      if (bindings.some((binding) => matchesBinding(binding, event))) matches.push(action);
    }
    return matches.sort();
  }

  vector(state = {}) {
    const output = {};
    for (const [action, bindings] of Object.entries(this.actions)) {
      const axis = bindings.find((binding) => binding.type === 'axis');
      if (!axis) continue;
      output[action] = Number(state[axis.device]?.[axis.index]?.axes?.[axis.axis] || 0);
    }
    return output;
  }
}

function normalizeBindings(bindings) {
  return normalizeArray(bindings).map((binding) => {
    if (typeof binding === 'string') {
      const [device, code, button] = binding.split(':');
      return { type: 'button', device, code, index: code, button };
    }
    return { ...binding };
  });
}

function matchesBinding(binding, event) {
  if (binding.type === 'axis') return false;
  if (binding.device !== event.device) return false;
  if (binding.device === 'keyboard') return binding.code === event.code;
  if (binding.device === 'gamepad') {
    return String(binding.index) === String(event.index ?? 0) && binding.button === event.button;
  }
  return false;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default InputDeviceMap;
