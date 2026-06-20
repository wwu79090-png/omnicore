import EventBus from '../core/EventBus.js';
import Rect from '../math/Rect.js';

/**
 * Native Canvas UI primitive.
 *
 * UI elements are declared as objects and rendered by Canvas; OmniCore never
 * generates UI source code.
 *
 * @example
 * const panel = new UIElement({ x: 20, y: 20, width: 200, height: 64, zIndex: 2 });
 * panel.on('click', () => console.log('clicked'));
 */
export class UIElement {
  constructor({ x = 0, y = 0, width = 0, height = 0, zIndex = 0, visible = true } = {}) {
    this.type = 'ui';
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.zIndex = zIndex;
    this.visible = visible;
    this.events = new EventBus();
    this.dirty = true;
    this.renderCache = null;
    this.uiRenderManager = null;
  }

  get bounds() {
    return new Rect(this.x, this.y, this.width, this.height);
  }

  hitTest(x, y) {
    return this.visible && this.bounds.contains(x, y);
  }

  on(event, handler) {
    return this.events.on(event, handler);
  }

  markDirty(reason = 'state') {
    this.dirty = true;
    if (this.renderCache) this.renderCache.dirty = true;
    return this.uiRenderManager?.markDirty?.(this, reason) || this.bounds;
  }

  setBounds({ x = this.x, y = this.y, width = this.width, height = this.height } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.markDirty('bounds');
    return this;
  }

  setVisible(visible) {
    if (this.visible === visible) return this;
    this.visible = visible;
    this.markDirty('visibility');
    return this;
  }

  dispatch(event, payload = {}) {
    this.events.emit(event, payload);
  }

  render(ctx) {
    if (!this.visible || !ctx) return;
    ctx.save();
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.restore();
  }
}

export function sortByZIndex(elements) {
  return [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
}

export default UIElement;
