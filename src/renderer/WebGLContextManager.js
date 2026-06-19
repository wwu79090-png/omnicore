/**
 * WebGL context loss/restoration manager.
 *
 * The manager listens to browser `webglcontextlost` and
 * `webglcontextrestored` events, prevents the default hard failure path, and
 * calls a canvas fallback hook when the context cannot be restored quickly.
 *
 * @example
 * const manager = new WebGLContextManager({
 *   canvas,
 *   onFallback: () => OmniCore.Backend.switch('canvas')
 * });
 */
export class WebGLContextManager {
  constructor({
    canvas = null,
    restoreTimeout = 2500,
    onLost = null,
    onRestored = null,
    onFallback = null,
    logger = null
  } = {}) {
    this.canvas = null;
    this.restoreTimeout = restoreTimeout;
    this.onLost = onLost;
    this.onRestored = onRestored;
    this.onFallback = onFallback;
    this.logger = logger;
    this.lost = false;
    this.restoreTimer = null;
    this.boundLost = (event) => this._handleLost(event);
    this.boundRestored = (event) => this._handleRestored(event);
    if (canvas) this.bind(canvas);
  }

  bind(canvas) {
    this.unbind();
    this.canvas = canvas;
    this.canvas?.addEventListener?.('webglcontextlost', this.boundLost, false);
    this.canvas?.addEventListener?.('webglcontextrestored', this.boundRestored, false);
    return this;
  }

  unbind() {
    if (!this.canvas) return;
    this.canvas.removeEventListener?.('webglcontextlost', this.boundLost, false);
    this.canvas.removeEventListener?.('webglcontextrestored', this.boundRestored, false);
    this.canvas = null;
  }

  destroy() {
    this.unbind();
    this._clearRestoreTimer();
    this.lost = false;
  }

  _handleLost(event) {
    event?.preventDefault?.();
    this.lost = true;
    this.logger?.warn?.('webgl', 'WebGL 上下文丢失，正在等待恢复后再决定是否降级 Canvas。');
    this.onLost?.({ event, canvas: this.canvas });
    this._clearRestoreTimer();

    if (this.restoreTimeout >= 0) {
      this.restoreTimer = setTimeout(() => {
        if (this.lost) this._fallback('restore-timeout');
      }, this.restoreTimeout);
    }
  }

  _handleRestored(event) {
    this._clearRestoreTimer();
    this.lost = false;
    this.logger?.info?.('webgl', 'WebGL 上下文已恢复。');
    this.onRestored?.({ event, canvas: this.canvas });
  }

  _fallback(reason) {
    this.logger?.warn?.('webgl', `WebGL 恢复失败，已降级至 Canvas：${reason}`);
    this.onFallback?.({ reason, canvas: this.canvas });
  }

  _clearRestoreTimer() {
    if (this.restoreTimer != null) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }
  }
}

export default WebGLContextManager;
