import { createOmniError } from '../core/OmniError.js';

export class EventCommandQueue {
  constructor({ customEvents = {} } = {}) {
    this.customEvents = clone(customEvents || {});
    this.commands = [];
  }

  enqueue(commands = []) {
    this.commands.push(...normalizeArray(commands).map(clone));
    return this;
  }

  run({ variables = {}, emit = null } = {}) {
    const state = {
      variables: { ...variables },
      log: [],
      scene: null,
      emit
    };
    this._runCommands(this.commands, state);
    return {
      variables: state.variables,
      log: state.log,
      scene: state.scene
    };
  }

  _runCommands(commands, state) {
    for (const command of normalizeArray(commands)) {
      if (command.op === 'dialogue') {
        state.log.push({ type: 'dialogue', text: interpolate(command.text || '', state.variables) });
      } else if (command.op === 'set') {
        state.variables[command.key] = clone(command.value);
        state.log.push({ type: 'set', key: command.key, value: clone(command.value) });
      } else if (command.op === 'emit') {
        state.emit?.(command.event, clone(command.payload || {}));
      } else if (command.op === 'changeScene') {
        state.scene = { name: command.scene, x: Number(command.x || 0), y: Number(command.y || 0) };
        state.log.push({ type: 'scene', scene: command.scene, x: state.scene.x, y: state.scene.y });
      } else if (command.op === 'call') {
        const nested = this.customEvents[command.event];
        if (!nested) throw createOmniError('EventCommandQueue', `Custom event is not registered: ${command.event}`);
        this._runCommands(nested, state);
      }
    }
  }
}

function interpolate(text, variables = {}) {
  return String(text).replace(/\{([^}]+)\}/gu, (_, key) => String(variables[key.trim()] ?? ''));
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default EventCommandQueue;
