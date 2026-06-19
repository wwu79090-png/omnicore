import { createOmniError } from '../core/OmniError.js';

export class HotfixManager {
  constructor({
    url = '/config/hotfix.json',
    fetcher = globalThis.fetch?.bind(globalThis),
    runtime = {},
    intervalMs = 30000
  } = {}) {
    this.url = url;
    this.fetcher = fetcher;
    this.runtime = runtime;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.version = null;
  }

  async checkNow() {
    if (!this.fetcher) throw createOmniError('Hotfix', '缺少 hotfix fetcher。');
    const response = await this.fetcher(this.url);
    if (!response?.ok) return null;
    const patch = await response.json();
    if (!patch || patch.version === this.version) return patch;
    this.apply(patch);
    this.version = patch.version;
    return patch;
  }

  apply(patch = {}) {
    if (patch.scenes) {
      this.runtime.scenes ||= {};
      for (const [name, scenePatch] of Object.entries(patch.scenes)) {
        this.runtime.scenes[name] = {
          ...(this.runtime.scenes[name] || {}),
          ...scenePatch
        };
      }
    }

    if (patch.functions) {
      this.runtime.functions ||= {};
      for (const [name, body] of Object.entries(patch.functions)) {
        this.runtime.functions[name] = createHotfixFunction(body, this.runtime);
      }
    }
  }

  start() {
    if (this.timer || this.intervalMs <= 0) return this;
    this.timer = setInterval(() => {
      this.checkNow().catch(() => {});
    }, this.intervalMs);
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return this;
  }
}

function createHotfixFunction(body, runtime) {
  if (typeof body === 'function') return body;
  const expression = String(body).trim().replace(/^return\s+/u, '').replace(/;$/u, '');
  return (input) => evaluateExpression(expression, { input, runtime });
}

function evaluateExpression(expression, scope) {
  const multiply = expression.split('*').map((part) => part.trim());
  if (multiply.length === 2) return resolveOperand(multiply[0], scope) * resolveOperand(multiply[1], scope);
  const add = expression.split('+').map((part) => part.trim());
  if (add.length === 2) return resolveOperand(add[0], scope) + resolveOperand(add[1], scope);
  return resolveOperand(expression, scope);
}

function resolveOperand(value, scope) {
  if (/^-?\d+(?:\.\d+)?$/u.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return String(value)
    .split('.')
    .reduce((cursor, key) => (cursor == null ? undefined : cursor[key]), scope);
}

export default HotfixManager;
