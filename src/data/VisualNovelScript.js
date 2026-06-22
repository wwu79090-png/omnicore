import { createOmniError } from '../core/OmniError.js';

export class VisualNovelScript {
  constructor({ labels = {} } = {}) {
    this.labels = new Map();
    for (const [label, commands] of Object.entries(labels || {})) {
      this.labels.set(String(label), normalizeArray(commands).map(clone));
    }
  }

  run({
    start = 'start',
    variables = {},
    choices = [],
    choiceResolver = null,
    maxSteps = 1000
  } = {}) {
    const state = {
      label: String(start),
      pc: 0,
      variables: { ...variables },
      log: [],
      callStack: [],
      choices: [...normalizeArray(choices)],
      choiceIndex: 0,
      ended: false
    };
    this._assertLabel(state.label);

    let steps = 0;
    while (!state.ended) {
      if (steps >= maxSteps) {
        throw createOmniError('VisualNovelScript', `Script exceeded max step count: ${maxSteps}`);
      }
      steps += 1;
      const commands = this.labels.get(state.label);
      if (state.pc >= commands.length) {
        if (!this._returnFromCall(state)) state.ended = true;
        continue;
      }
      const command = commands[state.pc];
      state.pc += 1;
      this._execute(command, state, choiceResolver);
    }

    return {
      variables: { ...state.variables },
      log: state.log.map(clone),
      label: state.label,
      callStackDepth: state.callStack.length
    };
  }

  _execute(command, state, choiceResolver) {
    const action = command || {};
    if (action.op === 'say') {
      const entry = {
        type: 'say',
        text: interpolate(action.text || '', state.variables)
      };
      if (action.speaker != null) entry.speaker = interpolate(action.speaker, state.variables);
      state.log.push(entry);
    } else if (action.op === 'set') {
      state.variables[action.key] = resolveValue(action.value, state.variables);
      state.log.push({ type: 'set', key: action.key, value: clone(state.variables[action.key]) });
    } else if (action.op === 'menu') {
      this._runMenu(action, state, choiceResolver);
    } else if (action.op === 'jump') {
      this._jump(state, action.label);
    } else if (action.op === 'call') {
      state.callStack.push({ label: state.label, pc: state.pc });
      this._jump(state, action.label);
    } else if (action.op === 'return') {
      if (!this._returnFromCall(state)) state.ended = true;
    } else if (action.op === 'end') {
      state.log.push({ type: 'end', label: state.label });
      state.ended = true;
    }
  }

  _runMenu(command, state, choiceResolver) {
    const available = normalizeArray(command.choices).filter((choice) => matchesWhen(choice.when, state.variables));
    if (available.length === 0) {
      throw createOmniError('VisualNovelScript', `Menu has no available choices: ${command.prompt || state.label}`);
    }
    const index = this._resolveChoiceIndex(command, available, state, choiceResolver);
    const choice = available[index];
    state.log.push({
      type: 'choice',
      prompt: interpolate(command.prompt || '', state.variables),
      text: interpolate(choice.text || '', state.variables),
      index
    });
    for (const nested of normalizeArray(choice.commands)) {
      this._execute(nested, state, choiceResolver);
      if (state.ended) return;
    }
    if (choice.call) {
      state.callStack.push({ label: state.label, pc: state.pc });
      this._jump(state, choice.call);
    } else if (choice.jump) {
      this._jump(state, choice.jump);
    }
  }

  _resolveChoiceIndex(command, available, state, choiceResolver) {
    const resolved = choiceResolver
      ? choiceResolver({
        prompt: command.prompt || '',
        choices: available.map((choice) => ({ ...choice })),
        variables: { ...state.variables }
      })
      : state.choices[state.choiceIndex];
    state.choiceIndex += 1;
    if (typeof resolved === 'number' && available[resolved]) return resolved;
    if (typeof resolved === 'string') {
      const found = available.findIndex((choice) => choice.text === resolved);
      if (found >= 0) return found;
    }
    return 0;
  }

  _jump(state, label) {
    const next = String(label);
    this._assertLabel(next);
    state.label = next;
    state.pc = 0;
  }

  _returnFromCall(state) {
    const frame = state.callStack.pop();
    if (!frame) return false;
    state.label = frame.label;
    state.pc = frame.pc;
    return true;
  }

  _assertLabel(label) {
    if (!this.labels.has(String(label))) {
      throw createOmniError('VisualNovelScript', `Label is not registered: ${label}`);
    }
  }
}

function matchesWhen(when, variables) {
  if (!when) return true;
  return Object.entries(when).every(([key, expected]) => variables[key] === expected);
}

function resolveValue(value, variables) {
  if (typeof value === 'string') return interpolate(value, variables);
  return clone(value);
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

export default VisualNovelScript;
