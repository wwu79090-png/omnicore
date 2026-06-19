function normalizeModuleName(moduleName = 'Core') {
  const text = String(moduleName || 'Core').replace(/[^a-z0-9]+/gi, ' ').trim();
  if (!text) return 'Core';
  return text
    .split(/\s+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}

export function formatOmniMessage(moduleName, message) {
  return `[OmniCore] [${normalizeModuleName(moduleName)}] ${message}`;
}

export class OmniError extends Error {
  constructor(moduleName, message, { cause = null, code = 'OMNICORE_ERROR', details = null } = {}) {
    super(formatOmniMessage(moduleName, message));
    this.name = 'OmniError';
    this.module = normalizeModuleName(moduleName);
    this.code = code;
    this.details = details;
    if (cause) this.cause = cause;
  }
}

export function createOmniError(moduleName, message, options = {}) {
  return new OmniError(moduleName, message, options);
}

export function toOmniError(error, { module = 'Core', message = null, code = 'OMNICORE_ERROR', details = null } = {}) {
  if (error instanceof OmniError) return error;
  return new OmniError(module, message || normalizeNativeError(error), { cause: error, code, details });
}

export function normalizeNativeError(error) {
  const text = error?.message || String(error || '未知错误');
  if (/failed to fetch|failed to load resource|networkerror|404/i.test(text)) {
    return '资源路径不存在或网络不可用。';
  }
  return text;
}

export function warnMessage(moduleName, message) {
  return formatOmniMessage(moduleName, message);
}

export function errorMessage(moduleName, message) {
  return formatOmniMessage(moduleName, message);
}
