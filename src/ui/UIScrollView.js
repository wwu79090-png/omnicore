import UIElement, { sortByZIndex } from './UIElement.js';

export class UIScrollView extends UIElement {
  constructor({ children = [], scrollY = 0, style = {}, ...options } = {}) {
    super({ width: 200, height: 120, ...options });
    this.type = 'ui-scroll-view';
    this.children = [...children];
    this.scrollY = scrollY;
    this.style = {
      background: 'rgba(15, 23, 42, 0.85)',
      ...style
    };
  }

  add(child) {
    this.children.push(child);
    return child;
  }

  scrollTo(y) {
    this.scrollY = Math.max(0, Number(y) || 0);
    this.dispatch('scroll', { y: this.scrollY, target: this });
  }

  render(ctx) {
    if (!this.visible || !ctx) return;
    ctx.save?.();
    ctx.fillStyle = this.style.background;
    ctx.fillRect?.(this.x, this.y, this.width, this.height);
    ctx.beginPath?.();
    ctx.rect?.(this.x, this.y, this.width, this.height);
    ctx.clip?.();
    ctx.translate?.(this.x, this.y - this.scrollY);
    for (const child of sortByZIndex(this.children)) child.render?.(ctx);
    ctx.restore?.();
  }
}

export default UIScrollView;
