import { formatOmniMessage } from './OmniError.js';
import { DEFAULT_DEBUG } from '../config/defaults.js';

/**
 * Namespaced logger with debug gating.
 *
 * @example
 * const logger = new Logger({ debug: true });
 * logger.info('renderer', 'Pixi renderer initialized');
 */
function isProductionBuild() {
  return Boolean(import.meta.env?.PROD);
}

function stripOmniPrefix(message) {
  return String(message).replace(/^\[OmniCore\]\s+\[[^\]]+\]\s+/, '');
}

function stringifyMessage(args) {
  return args.map((item) => {
    if (item instanceof Error) return stripOmniPrefix(item.message);
    if (typeof item === 'string') return stripOmniPrefix(item);
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  }).join(' ');
}

function parseStackLocation(stack = '') {
  const lines = stack.split('\n').slice(2);
  for (const lineText of lines) {
    const match = lineText.match(/\(?((?:file:\/\/\/)?[A-Za-z]:[^:)]+|https?:\/\/[^:)]+|\/[^:)]+|[^()]+\.js):(\d+):(\d+)\)?/);
    if (match) {
      return {
        file: match[1],
        line: Number(match[2]),
        column: Number(match[3])
      };
    }
  }
  return { file: 'unknown', line: 0, column: 0 };
}

function recordLastError(entry) {
  globalThis.__OmniCore_LastError = entry;
  if (typeof window !== 'undefined') {
    window.__OmniCore_LastError = entry;
  }
}

export class Logger {
  constructor({ debug = DEFAULT_DEBUG, namespace = 'OmniCore', events = null } = {}) {
    this.debugEnabled = debug;
    this.namespace = namespace;
    this.events = events;
  }

  setEventBus(events) {
    this.events = events;
    return this;
  }

  debug(scope, ...args) {
    if (this.debugEnabled && !isProductionBuild()) console.debug(formatOmniMessage(scope, stringifyMessage(args)));
  }

  info(scope, ...args) {
    if (!isProductionBuild()) console.info(formatOmniMessage(scope, stringifyMessage(args)));
  }

  warn(scope, ...args) {
    const stackSource = args.find((item) => item instanceof Error)?.stack || new Error().stack;
    const location = parseStackLocation(stackSource);
    this.events?.emit?.('warning', {
      namespace: this.namespace,
      scope,
      message: stringifyMessage(args),
      line: location.line,
      column: location.column,
      stack: stackSource
    });
    if (!isProductionBuild()) console.warn(formatOmniMessage(scope, stringifyMessage(args)));
  }

  error(scope, ...args) {
    const stackSource = args.find((item) => item instanceof Error)?.stack || new Error().stack;
    const location = parseStackLocation(stackSource);
    recordLastError({
      namespace: this.namespace,
      scope,
      message: stringifyMessage(args),
      timestamp: new Date().toISOString(),
      file: location.file,
      line: location.line,
      column: location.column,
      stack: stackSource
    });
    this.events?.emit?.('error', {
      namespace: this.namespace,
      scope,
      message: stringifyMessage(args),
      line: location.line,
      column: location.column,
      stack: stackSource
    });
    if (!isProductionBuild()) console.error(formatOmniMessage(scope, stringifyMessage(args)));
  }
}

export default Logger;
