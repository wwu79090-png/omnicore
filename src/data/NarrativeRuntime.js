import { createOmniError } from '../core/OmniError.js';

export class NarrativeRuntime {
  constructor({ script = '', variables = {}, start = 'start' } = {}) {
    this.nodes = parseNarrativeScript(script);
    this.variables = clone(variables || {});
    this.current = start;
  }

  start(node = this.current) {
    this.current = node;
    return this.render();
  }

  choose(index = 0) {
    const step = this.render();
    const choice = step.choices[index];
    if (!choice) throw createOmniError('NarrativeRuntime', `Narrative choice is not available: ${index}`);
    this.variables = { ...this.variables, ...(choice.set || {}) };
    this.current = choice.next;
    return this.render();
  }

  continue() {
    const node = this.nodes[this.current];
    if (node?.jump) this.current = node.jump;
    return this.render();
  }

  render() {
    const node = this.nodes[this.current];
    if (!node) throw createOmniError('NarrativeRuntime', `Narrative node is not registered: ${this.current}`);
    return {
      node: this.current,
      text: node.text.map((line) => interpolate(line, this.variables)),
      choices: node.choices.map((choice, index) => ({
        id: choice.id || `${this.current}.${index}`,
        text: interpolate(choice.text, this.variables),
        next: choice.next,
        set: clone(choice.set || {})
      })),
      jump: node.jump || null,
      variables: clone(this.variables)
    };
  }
}

export function parseNarrativeScript(script = '') {
  const nodes = {};
  let current = null;
  for (const rawLine of String(script || '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = line.match(/^::\s*(.+)$/u);
    if (header) {
      current = header[1].trim();
      nodes[current] = { text: [], choices: [], jump: null };
      continue;
    }
    if (!current) continue;
    const choice = line.match(/^\[\[(.+?)\|(.+?)\]\](?:\s+\{set\s+([^\s]+)\s+(.+?)\})?$/u);
    if (choice) {
      nodes[current].choices.push({
        text: choice[1].trim(),
        next: choice[2].trim(),
        set: choice[3] ? { [choice[3].trim()]: parseValue(choice[4]) } : {}
      });
      continue;
    }
    const jump = line.match(/^->\s*(.+)$/u);
    if (jump) {
      nodes[current].jump = jump[1].trim();
      continue;
    }
    nodes[current].text.push(line);
  }
  return nodes;
}

function interpolate(text, variables = {}) {
  return String(text).replace(/\{\$([^}]+)\}/gu, (_, key) => String(variables[key.trim()] ?? ''));
}

function parseValue(value = '') {
  const text = String(value).trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(\.\d+)?$/u.test(text)) return Number(text);
  return text.replace(/^["']|["']$/gu, '');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default NarrativeRuntime;
