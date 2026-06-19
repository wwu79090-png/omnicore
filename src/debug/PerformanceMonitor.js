import { warnMessage } from '../core/OmniError.js';
import { DEFAULT_DEBUG } from '../config/defaults.js';

/**
 * Debug-only runtime performance monitor.
 *
 * Shows FPS, render time, active GameObject count, and memory usage in the
 * top-right corner when `debug: true`. It also warns when FPS remains below a
 * threshold for several consecutive frames.
 *
 * @example
 * const monitor = new PerformanceMonitor({ debug: true });
 * monitor.attach();
 * monitor.update({ fps: 58, renderMs: 2.4, gameObjects: 12 });
 */
export class PerformanceMonitor {
  constructor({
    debug = DEFAULT_DEBUG,
    lowFpsThreshold = 30,
    lowFpsFrames = 120,
    container = null
  } = {}) {
    this.debug = debug;
    this.lowFpsThreshold = lowFpsThreshold;
    this.lowFpsFrames = lowFpsFrames;
    this.container = container;
    this.panel = null;
    this.lowFpsCount = 0;
    this.lastWarningAt = 0;
    this.lastFrameTime = 0;
    this.current = {
      fps: 0,
      renderMs: 0,
      gameObjects: 0,
      memory: 0
    };
  }

  attach(container = this.container) {
    if (!this.debug || typeof document === 'undefined') return;
    this.container = container || document.body;
    if (this.panel) return;
    this.panel = document.createElement('div');
    this.panel.dataset.omnicorePerformance = 'true';
    Object.assign(this.panel.style, {
      position: 'fixed',
      top: '8px',
      right: '8px',
      zIndex: '2147483647',
      padding: '6px 8px',
      borderRadius: '4px',
      font: '12px/1.4 monospace',
      color: '#f8fafc',
      background: 'rgba(15, 23, 42, 0.82)',
      pointerEvents: 'none',
      whiteSpace: 'pre'
    });
    this.container.appendChild(this.panel);
    this._renderPanel();
  }

  update(stats = {}) {
    this.current = {
      fps: Number.isFinite(stats.fps) ? stats.fps : this.current.fps,
      renderMs: Number.isFinite(stats.renderMs) ? stats.renderMs : this.current.renderMs,
      gameObjects: Number.isFinite(stats.gameObjects) ? stats.gameObjects : this.current.gameObjects,
      memory: Number.isFinite(stats.memory) ? stats.memory : this._readMemory()
    };
    this._checkLowFps();
    this._renderPanel();
  }

  updateFromGame(game, delta, renderMs = 0) {
    const fps = delta > 0 ? Math.round(1 / delta) : this.current.fps;
    this.update({
      fps,
      renderMs,
      gameObjects: PerformanceMonitor.countGameObjects(game),
      memory: this._readMemory()
    });
  }

  destroy() {
    this.panel?.remove?.();
    this.panel = null;
    this.lowFpsCount = 0;
  }

  static countGameObjects(game) {
    const scenes = game?.scene?.stack || [];
    return scenes.reduce((total, scene) => total + (scene.children?.length || 0), 0);
  }

  _renderPanel() {
    if (!this.panel) return;
    const memoryText = this.current.memory ? `${(this.current.memory / 1024 / 1024).toFixed(1)} MB` : 'n/a';
    this.panel.textContent = [
      `FPS: ${Math.round(this.current.fps)}`,
      `Render: ${this.current.renderMs.toFixed(2)} ms`,
      `Objects: ${this.current.gameObjects}`,
      `Memory: ${memoryText}`
    ].join('\n');
  }

  _checkLowFps() {
    if (this.current.fps > 0 && this.current.fps < this.lowFpsThreshold) {
      this.lowFpsCount += 1;
    } else {
      this.lowFpsCount = 0;
    }

    if (this.lowFpsCount >= this.lowFpsFrames) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - this.lastWarningAt > 1000 || this.lastWarningAt === 0) {
        if (!import.meta.env?.PROD) {
          console.warn(warnMessage('Performance', `FPS 低于 ${this.lowFpsThreshold}：${Math.round(this.current.fps)}`));
        }
        this.lastWarningAt = now;
      }
    }
  }

  _readMemory() {
    const memory = typeof performance !== 'undefined' ? performance.memory : null;
    return memory?.usedJSHeapSize || 0;
  }
}

export default PerformanceMonitor;
