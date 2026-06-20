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
  constructor(moduleName, message, {
    cause = null,
    code = 'OMNICORE_ERROR',
    details = null,
    category = 'runtime',
    severity = 'error',
    recoverable = true,
    origin = null,
    userMessage = null
  } = {}) {
    super(formatOmniMessage(moduleName, message));
    this.name = 'OmniError';
    this.module = normalizeModuleName(moduleName);
    this.code = code;
    this.details = details;
    this.category = category;
    this.severity = severity;
    this.recoverable = recoverable !== false;
    this.origin = origin;
    this.userMessage = userMessage || message;
    if (cause) this.cause = cause;
  }
}

export function createOmniError(moduleName, message, options = {}) {
  return new OmniError(moduleName, message, options);
}

export function toOmniError(error, {
  module = 'Core',
  message = null,
  code = 'OMNICORE_ERROR',
  details = null,
  category = error?.category || 'runtime',
  severity = error?.severity || 'error',
  recoverable = error?.recoverable !== false,
  origin = error?.origin || null,
  userMessage = null
} = {}) {
  if (error instanceof OmniError) return error;
  const translated = message || normalizeNativeError(error);
  return new OmniError(module, translated, {
    cause: error,
    code,
    details,
    category,
    severity,
    recoverable,
    origin,
    userMessage: userMessage || translated
  });
}

export function normalizeNativeError(error) {
  const text = error?.message || String(error || '未知错误');
  if (/cannot read (?:properties|property) of undefined|undefined is not an object|is undefined/i.test(text)) {
    return '对象未初始化或属性不存在。请确认 Scene、Entity 或资源已创建，再访问对应方法。';
  }
  if (/cannot read (?:properties|property) of null|null is not an object/i.test(text)) {
    return '对象为空，无法继续操作。请检查 DOM、Canvas 或游戏对象是否已正确创建。';
  }
  if (/failed to fetch|failed to load resource|networkerror|404/i.test(text)) {
    return '资源路径不存在或网络不可用。请检查文件路径、协议限制或静态资源部署。';
  }
  if (/unexpected token|json/i.test(text)) {
    return '配置或资源文件格式不正确。请检查 JSON 内容是否完整、逗号和引号是否有效。';
  }
  if (/permission|denied|not allowed|security/i.test(text)) {
    return '浏览器或系统权限阻止了当前操作。请检查文件访问、跨域策略或安全上下文。';
  }
  if (/canvas|getcontext|webgl|webgpu/i.test(text)) {
    return '渲染上下文创建失败。请确认 Canvas 存在，并检查浏览器是否支持当前渲染后端。';
  }
  return text;
}

export function explainNativeError(error) {
  const userMessage = normalizeNativeError(error);
  return {
    title: inferFriendlyTitle(userMessage),
    message: userMessage,
    originalMessage: error?.message || String(error || '未知错误')
  };
}

export function captureOmniError(operation, {
  module = 'Core',
  fallback = null,
  onError = null,
  rethrow = false,
  ...options
} = {}) {
  try {
    return operation();
  } catch (error) {
    const omniError = toOmniError(error, { module, ...options });
    onError?.(omniError);
    if (rethrow) throw omniError;
    return fallback;
  }
}

function inferFriendlyTitle(userMessage) {
  if (userMessage.includes('对象未初始化') || userMessage.includes('对象为空')) return '对象未初始化';
  if (userMessage.includes('资源路径')) return '资源加载失败';
  if (userMessage.includes('JSON')) return '配置格式错误';
  if (userMessage.includes('权限')) return '权限受限';
  if (userMessage.includes('渲染上下文')) return '渲染初始化失败';
  return '运行时错误';
}

const OmniCoreErrorTools = Object.freeze({
  from: toOmniError,
  capture: captureOmniError,
  normalize: normalizeNativeError,
  explain: explainNativeError
});

export { OmniCoreErrorTools as Error };

export function warnMessage(moduleName, message) {
  return formatOmniMessage(moduleName, message);
}

export function errorMessage(moduleName, message) {
  return formatOmniMessage(moduleName, message);
}
