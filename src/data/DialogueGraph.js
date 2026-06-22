import { createOmniError } from '../core/OmniError.js';

export class DialogueGraph {
  constructor({ start = 'start', nodes = {} } = {}) {
    this.startNode = String(start);
    this.nodes = clone(nodes || {});
  }

  start({ nodeId = this.startNode, variables = {} } = {}) {
    return this._state(nodeId, clone(variables));
  }

  choose(state = {}, choiceIndex = 0) {
    const choice = normalizeArray(state.choices)[choiceIndex];
    if (!choice) throw createOmniError('DialogueGraph', `Dialogue choice is not available: ${choiceIndex}`);
    return this._state(choice.next, { ...(state.variables || {}), ...(choice.set || {}) });
  }

  _state(nodeId, variables = {}) {
    const node = this.nodes[nodeId];
    if (!node) throw createOmniError('DialogueGraph', `Dialogue node is not registered: ${nodeId}`);
    const current = {
      ...clone(node),
      text: interpolate(node.text || '', variables)
    };
    const choices = normalizeArray(node.choices)
      .filter((choice) => matchesWhen(choice.when, variables))
      .map((choice, index) => ({
        id: choice.id || `${nodeId}.${index}`,
        text: interpolate(choice.text || '', variables),
        next: choice.next,
        set: clone(choice.set || {})
      }));
    return {
      nodeId,
      current,
      choices,
      variables: clone(variables)
    };
  }
}

function matchesWhen(when = null, variables = {}) {
  if (!when) return true;
  return Object.entries(when).every(([key, expected]) => variables[key] === expected);
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

export default DialogueGraph;
