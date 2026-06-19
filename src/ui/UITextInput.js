import UIElement from './UIElement.js';

export class UITextInput extends UIElement {
  constructor({ value = '', placeholder = '', style = {}, ...options } = {}) {
    super({ width: 160, height: 32, ...options });
    this.type = 'ui-text-input';
    this.value = value;
    this.placeholder = placeholder;
    this.focused = false;
    this.style = {
      background: '#020617',
      foreground: '#f8fafc',
      placeholder: '#64748b',
      border: '#38bdf8',
      font: '14px system-ui, sans-serif',
      ...style
    };
  }

  focus() {
    this.focused = true;
    this.dispatch('focus', { target: this });
  }

  blur() {
    this.focused = false;
    this.dispatch('blur', { target: this });
  }

  handleText(text) {
    if (!this.focused) return this.value;
    this.value += text;
    this.dispatch('input', { value: this.value, target: this });
    return this.value;
  }

  backspace() {
    if (!this.focused) return this.value;
    this.value = this.value.slice(0, -1);
    this.dispatch('input', { value: this.value, target: this });
    return this.value;
  }

  render(ctx) {
    if (!this.visible || !ctx) return;
    ctx.save?.();
    ctx.fillStyle = this.style.background;
    ctx.strokeStyle = this.focused ? this.style.border : '#334155';
    ctx.fillRect?.(this.x, this.y, this.width, this.height);
    ctx.strokeRect?.(this.x, this.y, this.width, this.height);
    ctx.font = this.style.font;
    ctx.fillStyle = this.value ? this.style.foreground : this.style.placeholder;
    ctx.fillText?.(this.value || this.placeholder, this.x + 8, this.y + this.height / 2 + 5);
    ctx.restore?.();
  }
}

export default UITextInput;
