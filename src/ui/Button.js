import UIElement from './UIElement.js';

/**
 * Canvas-rendered button.
 *
 * @example
 * const button = new Button('Switch', { x: 16, y: 16, width: 120, height: 36 });
 * button.onClick(() => OmniCore.Backend.switch('canvas'));
 */
export class Button extends UIElement {
  constructor(text, options = {}) {
    super({ width: 120, height: 36, ...options });
    this.type = 'button';
    this.text = text;
    this.style = {
      background: '#0f172a',
      foreground: '#f8fafc',
      border: '#38bdf8',
      font: '14px system-ui, sans-serif',
      ...options.style
    };
  }

  onClick(handler) {
    return this.on('click', handler);
  }

  render(ctx) {
    if (!this.visible || !ctx) return;
    ctx.save();
    ctx.fillStyle = this.style.background;
    ctx.strokeStyle = this.style.border;
    ctx.lineWidth = 1;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    ctx.fillStyle = this.style.foreground;
    ctx.font = this.style.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2);
    ctx.restore();
  }
}

export default Button;
