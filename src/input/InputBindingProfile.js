import { createOmniError } from '../core/OmniError.js';

export const INPUT_BINDING_PROFILE_SCHEMA = {
  version: 1,
  sources: ['Unity Input System', 'Godot InputMap', 'Unreal Enhanced Input', 'Phaser Keyboard Plugin']
};

export class InputBindingProfile {
  constructor({ contexts = {}, glyphs = {} } = {}) {
    this.contexts = new Map();
    this.glyphs = new Map(Object.entries(glyphs || {}).map(([path, display]) => [normalizePath(path), String(display)]));
    for (const [name, config] of Object.entries(contexts || {})) this.addContext(name, config);
  }

  addContext(name, { priority = 0, enabled = false, actions = {} } = {}) {
    const key = String(name);
    const context = {
      name: key,
      priority: Number(priority) || 0,
      enabled: enabled === true,
      actions: new Map()
    };
    for (const [action, bindings] of Object.entries(actions || {})) {
      context.actions.set(String(action), normalizeList(bindings).map((binding, index) => normalizeBinding(binding, {
        context: key,
        action,
        index,
        glyphs: this.glyphs
      })));
    }
    this.contexts.set(key, context);
    return this;
  }

  enableContext(name) {
    this.context(name).enabled = true;
    return this;
  }

  disableContext(name) {
    this.context(name).enabled = false;
    return this;
  }

  rebind(action, path, {
    context = null,
    bindingIndex = 0,
    group = null,
    conflictStrategy = 'reject'
  } = {}) {
    const target = this.findBinding(action, { context, bindingIndex, group });
    const overridePath = normalizePath(path);
    const conflicts = this.findConflictingBindings({
      path: overridePath,
      group,
      ignore: target.binding
    });

    if (conflicts.length && conflictStrategy === 'reject') {
      throw createOmniError('InputBindingProfile', `Input binding conflict for ${overridePath}.`);
    }

    const conflictsResolved = conflicts.map((entry) => {
      if (conflictStrategy === 'unassign') {
        entry.binding.disabled = true;
        entry.binding.disabledBy = `${target.context.name}:${target.action}`;
      }
      return {
        action: entry.action,
        context: entry.context.name,
        path: effectivePath(entry.binding),
        strategy: conflictStrategy
      };
    });

    target.binding.overridePath = overridePath;
    target.binding.disabled = false;
    target.binding.display = displayFor(overridePath, this.glyphs);

    return {
      action: target.action,
      context: target.context.name,
      binding: publicBinding(target.binding),
      conflictsResolved
    };
  }

  saveOverrides() {
    const overrides = [];
    for (const context of this.contexts.values()) {
      for (const [action, bindings] of context.actions) {
        bindings.forEach((binding, index) => {
          if (binding.overridePath || binding.disabled) {
            overrides.push({
              context: context.name,
              action,
              index,
              overridePath: binding.overridePath || null,
              disabled: binding.disabled === true
            });
          }
        });
      }
    }
    return JSON.stringify({ version: 1, overrides });
  }

  loadOverrides(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    for (const override of data?.overrides || []) {
      const context = this.context(override.context);
      const bindings = context.actions.get(String(override.action)) || [];
      const binding = bindings[Number(override.index)];
      if (!binding) continue;
      binding.overridePath = override.overridePath ? normalizePath(override.overridePath) : null;
      binding.disabled = override.disabled === true;
      binding.display = displayFor(effectivePath(binding), this.glyphs);
    }
    return this;
  }

  effectiveBindings(action, { context = null, group = null, includeDisabled = false } = {}) {
    return this.collectBindings({ contexts: context ? [context] : null, group, includeDisabled })
      .filter((entry) => entry.action === String(action))
      .map((entry) => publicBinding(entry.binding));
  }

  resolve({ path, group = null, value = 1 } = {}) {
    const normalizedPath = normalizePath(path);
    const match = this.collectBindings({ group })
      .find((entry) => effectivePath(entry.binding) === normalizedPath);
    if (!match) return null;
    return {
      action: match.action,
      context: match.context.name,
      path: effectivePath(match.binding),
      display: match.binding.display,
      value,
      binding: publicBinding(match.binding)
    };
  }

  auditConflicts({ contexts = null, group = null, includeDisabled = false } = {}) {
    const byKey = new Map();
    for (const entry of this.collectBindings({ contexts, group, includeDisabled })) {
      const groups = group ? [group] : entry.binding.groups.length ? entry.binding.groups : ['default'];
      for (const itemGroup of groups) {
        const key = `${itemGroup}:${effectivePath(entry.binding)}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(entry);
      }
    }

    return [...byKey.entries()]
      .filter(([, entries]) => entries.length > 1)
      .map(([key, entries]) => {
        const [itemGroup, path] = key.split(/:(.*)/s);
        return {
          path,
          group: itemGroup,
          bindings: entries.map((entry) => ({
            action: entry.action,
            context: entry.context.name,
            display: entry.binding.display
          }))
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path) || left.group.localeCompare(right.group));
  }

  hints({ contexts = null, group = null } = {}) {
    return this.collectBindings({ contexts, group })
      .map((entry) => ({
        action: entry.action,
        context: entry.context.name,
        path: effectivePath(entry.binding),
        display: entry.binding.display,
        groups: [...entry.binding.groups]
      }));
  }

  applyToInputManager(input, { contexts = null, group = null } = {}) {
    if (!input || typeof input.mapAction !== 'function') {
      throw createOmniError('InputBindingProfile', 'applyToInputManager(input) requires InputManager.mapAction.');
    }
    const disposers = [];
    const byAction = new Map();
    for (const entry of this.collectBindings({ contexts, group })) {
      const binding = toInputManagerBinding(entry.binding);
      if (!binding) continue;
      if (!byAction.has(entry.action)) byAction.set(entry.action, []);
      byAction.get(entry.action).push(binding);
    }
    for (const [action, bindings] of byAction) disposers.push(input.mapAction(action, bindings));
    return () => {
      for (const dispose of disposers) dispose?.();
    };
  }

  context(name) {
    const context = this.contexts.get(String(name));
    if (!context) throw createOmniError('InputBindingProfile', `Input context is not registered: ${name}`);
    return context;
  }

  findBinding(action, { context = null, bindingIndex = 0, group = null } = {}) {
    const contexts = this.sortedContexts({ contexts: context ? [context] : null });
    for (const itemContext of contexts) {
      const bindings = itemContext.actions.get(String(action)) || [];
      const filtered = group ? bindings.filter((binding) => binding.groups.includes(String(group))) : bindings;
      const binding = filtered[Number(bindingIndex) || 0];
      if (binding) return { context: itemContext, action: String(action), binding };
    }
    throw createOmniError('InputBindingProfile', `Input action binding is not registered: ${action}`);
  }

  findConflictingBindings({ path, group = null, ignore = null }) {
    return this.collectBindings({ group, includeDisabled: false })
      .filter((entry) => entry.binding !== ignore && effectivePath(entry.binding) === path);
  }

  collectBindings({ contexts = null, group = null, includeDisabled = false } = {}) {
    const entries = [];
    for (const context of this.sortedContexts({ contexts })) {
      for (const [action, bindings] of context.actions) {
        for (const binding of bindings) {
          if (!includeDisabled && binding.disabled) continue;
          if (group && !binding.groups.includes(String(group))) continue;
          entries.push({ context, action, binding });
        }
      }
    }
    return entries;
  }

  sortedContexts({ contexts = null } = {}) {
    const allowed = contexts ? new Set(contexts.map(String)) : null;
    return [...this.contexts.values()]
      .filter((context) => (allowed ? allowed.has(context.name) : context.enabled))
      .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));
  }
}

function normalizeBinding(binding, { context, action, index, glyphs }) {
  const source = typeof binding === 'string' ? { path: binding } : { ...binding };
  const path = normalizePath(source.path || source.control || source.combo || source.key);
  const groups = normalizeGroups(source.groups || source.group);
  return {
    id: `${context}:${action}:${index}`,
    path,
    overridePath: source.overridePath ? normalizePath(source.overridePath) : null,
    disabled: source.disabled === true,
    disabledBy: source.disabledBy || null,
    groups,
    display: source.display || displayFor(source.overridePath || path, glyphs),
    metadata: { ...source.metadata }
  };
}

function publicBinding(binding) {
  return {
    path: binding.path,
    overridePath: binding.overridePath,
    effectivePath: effectivePath(binding),
    disabled: binding.disabled,
    display: binding.display,
    groups: [...binding.groups]
  };
}

function effectivePath(binding) {
  return binding.overridePath || binding.path;
}

function toInputManagerBinding(binding) {
  if (binding.disabled) return null;
  const path = effectivePath(binding);
  if (path.startsWith('<Keyboard>/')) {
    return {
      type: 'keyboard',
      combo: keyboardComboFromPath(path),
      path,
      display: binding.display,
      groups: [...binding.groups]
    };
  }
  if (path.startsWith('<Gamepad>/')) {
    const button = gamepadButtonIndex(path.slice('<Gamepad>/'.length));
    if (button == null) return null;
    return {
      type: 'gamepad',
      index: 0,
      button,
      threshold: 0.5,
      path,
      display: binding.display,
      groups: [...binding.groups]
    };
  }
  return null;
}

function keyboardComboFromPath(path) {
  return path
    .slice('<Keyboard>/'.length)
    .split('+')
    .map((part) => normalizeKeyboardToken(part))
    .join('+');
}

function normalizePath(path) {
  const value = String(path || '').trim();
  if (!value) throw createOmniError('InputBindingProfile', 'Input binding path is required.');
  if (/^<[^>]+>\//.test(value)) {
    const [devicePart, controlPart = ''] = value.split('/');
    return `${devicePart}/${normalizeControl(devicePart.slice(1, -1), controlPart)}`;
  }
  if (value.includes('/')) {
    const [device, control] = value.split('/');
    return `<${capitalizeDevice(device)}>/${normalizeControl(device, control)}`;
  }
  return `<Keyboard>/${normalizeControl('Keyboard', value)}`;
}

function normalizeControl(device, control) {
  const text = String(control || '').trim();
  if (String(device).toLowerCase() === 'keyboard') return text.toLowerCase();
  return text;
}

function normalizeGroups(groups) {
  if (Array.isArray(groups)) return groups.map(String).filter(Boolean);
  if (groups == null || groups === '') return [];
  return String(groups).split(';').map((group) => group.trim()).filter(Boolean);
}

function displayFor(path, glyphs) {
  const normalized = normalizePath(path);
  return glyphs.get(normalized) || fallbackDisplay(normalized);
}

function fallbackDisplay(path) {
  const control = path.split('/').pop() || path;
  return control
    .split('+')
    .map((part) => normalizeKeyboardToken(part))
    .join('+');
}

function normalizeKeyboardToken(token) {
  const value = String(token || '').trim();
  const lower = value.toLowerCase();
  if (lower === 'ctrl' || lower === 'control') return 'Ctrl';
  if (lower === 'alt') return 'Alt';
  if (lower === 'shift') return 'Shift';
  if (lower === 'meta' || lower === 'cmd' || lower === 'command') return 'Meta';
  if (lower === 'space' || value === ' ') return 'Space';
  if (value.length === 1) return value.toUpperCase();
  return value;
}

function gamepadButtonIndex(control) {
  const map = {
    buttonSouth: 0,
    buttonEast: 1,
    buttonWest: 2,
    buttonNorth: 3,
    A: 0,
    B: 1,
    X: 2,
    Y: 3
  };
  return map[control] ?? null;
}

function capitalizeDevice(device) {
  const lower = String(device || '').replace(/[<>]/g, '').toLowerCase();
  if (lower === 'keyboard') return 'Keyboard';
  if (lower === 'gamepad') return 'Gamepad';
  if (lower === 'mouse') return 'Mouse';
  return lower ? lower[0].toUpperCase() + lower.slice(1) : 'Keyboard';
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default InputBindingProfile;
