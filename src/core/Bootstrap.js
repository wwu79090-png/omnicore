import { DEFAULT_GAME_CONFIG } from '../config/defaults.js';
import { createOmniError, toOmniError } from './OmniError.js';

/**
 * Bootstrapping helpers for standard OmniCore configuration and DOM attachment.
 *
 * @example
 * const config = normalizeConfig({ width: 960, height: 540, platform: 'web' });
 * const container = resolveContainer(config.container);
 */
export const STANDARD_DIRECTORIES = [
  'src/core',
  'src/renderer',
  'src/scene',
  'src/loop',
  'src/store',
  'src/loader',
  'src/math',
  'src/audio',
  'src/data',
  'src/net',
  'src/debug',
  'src/pool',
  'src/compliance',
  'src/prefab',
  'src/ui',
  'src/platform',
  'src/dimension3d',
  'tests',
  'examples'
];

/**
 * @param {Partial<typeof DEFAULT_GAME_CONFIG>} config Runtime overrides.
 * @returns {typeof DEFAULT_GAME_CONFIG & Record<string, *>} Normalized runtime config.
 */
export function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_GAME_CONFIG,
    ...config
  };
}

/**
 * @returns {boolean} Whether a browser-like document is available.
 */
export function hasDocument() {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

/**
 * @param {string|Element|null} container CSS selector or DOM element.
 * @returns {Element|null} Resolved container or null outside the DOM.
 */
export function resolveContainer(container) {
  if (!hasDocument()) return null;
  if (!container) return document.body;
  if (typeof container === 'string') return document.querySelector(container);
  return container;
}

/**
 * @param {number} width Canvas width in pixels.
 * @param {number} height Canvas height in pixels.
 * @param {HTMLCanvasElement|null} providedCanvas Existing canvas to reuse.
 * @returns {HTMLCanvasElement|{style: object}} Prepared canvas-like object.
 */
export function createCanvas(width, height, providedCanvas) {
  const canvas = providedCanvas || (hasDocument() ? document.createElement('canvas') : { style: {} });
  canvas.width = width;
  canvas.height = height;
  canvas.style = canvas.style || {};
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  return canvas;
}

/**
 * @param {Element|null} container Container that may hold runtime canvases.
 * @returns {void}
 */
export function removeContainerCanvases(container) {
  if (!container?.querySelectorAll) return;
  container.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
}

/**
 * @returns {CanvasRenderingContext2D|Record<string, Function>} No-op canvas 2D context.
 */
export function createNoopCanvasContext() {
  const noop = () => {};
  return {
    canvas: null,
    save: noop,
    restore: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    fillText: noop,
    strokeText: noop,
    drawImage: noop,
    measureText: (text) => ({ width: String(text).length * 8 }),
    setTransform: noop,
    translate: noop,
    rotate: noop,
    scale: noop
  };
}

function createMiniGameResponse(payload) {
  const status = payload.statusCode || payload.status || 200;
  const data = payload.data ?? '';
  const headers = payload.header || payload.headers || {};
  const toText = () => (typeof data === 'string' ? data : JSON.stringify(data));

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: {
      get: (name) => headers[name] || headers[String(name).toLowerCase()] || ''
    },
    json: async () => (typeof data === 'string' ? JSON.parse(data) : data),
    text: async () => toText(),
    arrayBuffer: async () => {
      if (data instanceof ArrayBuffer) return data;
      if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(toText()).buffer;
      return new ArrayBuffer(0);
    },
    blob: async () => (typeof Blob !== 'undefined' ? new Blob([toText()]) : data)
  };
}

function createMiniGameFetcher(api) {
  return (urlOrRequest, options = {}) => new Promise((resolve, reject) => {
    const url = typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest?.url;
    const method = options.method || urlOrRequest?.method || 'GET';
    const headers = options.headers || urlOrRequest?.headers || {};
    const body = options.body ?? urlOrRequest?.body;

    api.request({
      url,
      method,
      header: headers,
      data: body,
      success: (response) => resolve(createMiniGameResponse(response)),
      fail: (error) => reject(createOmniError('Bootstrap', error?.errMsg || '小游戏请求失败。', { cause: error }))
    });
  });
}

/**
 * Detects runtime capabilities and returns platform-specific fallbacks.
 *
 * @example
 * const env = detectEnvironment(globalThis);
 * const response = await env.fetcher('/asset-manifest.json');
 */
/**
 * @param {typeof globalThis|Record<string, *>} env Runtime global object.
 * @returns {{platform: string, runtime: string, isMiniGame: boolean, isWechat: boolean, isDouyin: boolean, isElectron: boolean, isWeb: boolean, fetcher: Function|undefined, request: Function|null, skipThree: boolean, skipPixiViewport: boolean, supportsWebGL: boolean, raw: object}} Environment descriptor.
 */
export function detectEnvironment(env = globalThis) {
  const navigatorRef = env.navigator || {};
  const userAgent = navigatorRef.userAgent || '';
  const wxApi = env.wx;
  const ttApi = env.tt;
  const isWechat = Boolean(wxApi?.request) || /MicroMessenger|MiniGame/i.test(userAgent);
  const isDouyin = Boolean(ttApi?.request) || /ToutiaoMicroApp|Douyin|ByteDance/i.test(userAgent);
  const miniGameApi = wxApi?.request ? wxApi : ttApi?.request ? ttApi : null;
  const isElectron = Boolean(env.process?.versions?.electron) || /Electron/i.test(userAgent);
  const platform = isWechat ? 'wechat' : isDouyin ? 'douyin' : isElectron ? 'electron' : 'web';
  const fetcher = miniGameApi?.request
    ? createMiniGameFetcher(miniGameApi)
    : env.fetch?.bind?.(env) || globalThis.fetch?.bind?.(globalThis);

  return {
    platform,
    runtime: platform,
    isMiniGame: isWechat || isDouyin,
    isWechat,
    isDouyin,
    isElectron,
    isWeb: platform === 'web',
    fetcher,
    request: miniGameApi?.request || null,
    skipThree: isWechat || isDouyin,
    skipPixiViewport: isWechat || isDouyin,
    supportsWebGL: !isWechat && !isDouyin,
    raw: env
  };
}

/**
 * Runs a module initializer with a local fallback path.
 *
 * @example
 * const renderer = await safeInitialize('PixiRenderer', () => createPixi(), () => createCanvasRenderer(), logger);
 */
/**
 * @param {string} name Module name used in logs.
 * @param {Function} initializer Initialization callback.
 * @param {*|Function} fallback Fallback value or callback invoked with the error.
 * @param {object|null} logger Logger-like object.
 * @returns {*} Initializer result or fallback result.
 */
export function safeInitialize(name, initializer, fallback, logger) {
  const fail = (error) => {
    const omniError = toOmniError(error, {
      module: 'Bootstrap',
      message: `${name} 初始化失败。`
    });
    logger?.error?.('bootstrap', `${name} 初始化失败。`, omniError);
    if (typeof fallback === 'function') return fallback(omniError);
    return fallback;
  };

  try {
    const result = initializer();
    if (result && typeof result.then === 'function') {
      return result.catch((error) => fail(error));
    }
    return result;
  } catch (error) {
    return fail(error);
  }
}
