import { createOmniError } from '../core/OmniError.js';

export class InputActionContextStack {
  constructor() {
    this.contexts = new Map();
    this.enabled = new Set();
  }

  addContext(name, { priority = 0, actions = {} } = {}) {
    const key = String(name);
    this.contexts.set(key, {
      name: key,
      priority: Number(priority || 0),
      actions: Object.fromEntries(Object.entries(actions || {}).map(([action, bindings]) => [
        action,
        normalizeArray(bindings).map(normalizeBinding)
      ]))
    });
    return this;
  }

  enable(name) {
    this._context(name);
    this.enabled.add(String(name));
    return this;
  }

  disable(name) {
    this.enabled.delete(String(name));
    return this;
  }

  resolve(input = {}) {
    const contexts = [...this.enabled]
      .map((name) => this._context(name))
      .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

    for (const context of contexts) {
      for (const [action, bindings] of Object.entries(context.actions)) {
        for (const binding of bindings) {
          const value = resolveBinding(binding, input);
          if (value.matched) return { action, context: context.name, value: value.value, binding: binding.control };
        }
      }
    }
    return null;
  }

  _context(name) {
    const context = this.contexts.get(String(name));
    if (!context) throw createOmniError('InputActionContextStack', `Input context is not registered: ${name}`);
    return context;
  }
}

function normalizeBinding(binding) {
  return {
    control: String(binding.control),
    value: binding.value,
    threshold: binding.threshold == null ? 0 : Number(binding.threshold),
    modifier: binding.modifier || null,
    scale: binding.scale == null ? 1 : Number(binding.scale)
  };
}

function resolveBinding(binding, input) {
  if (String(input.control) !== binding.control) return { matched: false, value: null };
  const raw = input.value ?? 0;
  if (Math.abs(Number(raw)) < binding.threshold) return { matched: false, value: null };
  let value = binding.value !== undefined ? binding.value : raw;
  if (binding.modifier === 'scale') value = Number(value) * binding.scale;
  return { matched: true, value };
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default InputActionContextStack;
