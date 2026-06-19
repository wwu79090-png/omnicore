import Button from './Button.js';

export class UIButton extends Button {
  constructor(text, options = {}) {
    super(text, options);
    this.type = 'ui-button';
  }
}

export default UIButton;
