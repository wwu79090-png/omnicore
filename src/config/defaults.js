export const DEFAULT_CANVAS_WIDTH = 800;
export const DEFAULT_CANVAS_HEIGHT = 600;
export const DEFAULT_RENDERER_BACKEND = 'webgpu';
export const DEFAULT_PLATFORM = 'web';
export const DEFAULT_BACKGROUND_COLOR = '#111827';
export const DEFAULT_ASSET_MANIFEST = 'asset-manifest.json';
export const DEFAULT_AUTO_RESIZE = true;
export const DEFAULT_AUTO_START = true;
export const DEFAULT_AUTO_ATTACH = true;
export const DEFAULT_DEBUG = false;
export const DEFAULT_ENGINE_VERSION = '0.1.0';
export const DEFAULT_DIMENSION3D_BACKEND = 'three';
export const DEFAULT_LOADER_TIMEOUT_MS = 5000;
export const DEFAULT_LOADER_RETRIES = 1;
export const DEFAULT_LOOP_FPS = 60;
export const DEFAULT_MICROKERNEL_RENDERER = 'auto';
export const DEFAULT_ASSET_DIRECTORIES = Object.freeze([
  'sprites',
  'audio',
  'fonts',
  'icons',
  'branding',
  'prefabs'
]);

export const DEFAULT_GAME_CONFIG = Object.freeze({
  width: DEFAULT_CANVAS_WIDTH,
  height: DEFAULT_CANVAS_HEIGHT,
  renderer: DEFAULT_RENDERER_BACKEND,
  platform: DEFAULT_PLATFORM,
  parent: null,
  autoResize: DEFAULT_AUTO_RESIZE,
  autoStart: DEFAULT_AUTO_START,
  autoAttach: DEFAULT_AUTO_ATTACH,
  webkitLightMode: true,
  debug: DEFAULT_DEBUG,
  background: DEFAULT_BACKGROUND_COLOR,
  manifest: DEFAULT_ASSET_MANIFEST
});

export const DEFAULT_RENDERER_CONFIG = Object.freeze({
  backend: DEFAULT_RENDERER_BACKEND,
  width: DEFAULT_CANVAS_WIDTH,
  height: DEFAULT_CANVAS_HEIGHT,
  background: DEFAULT_BACKGROUND_COLOR,
  autoResize: DEFAULT_AUTO_RESIZE
});
