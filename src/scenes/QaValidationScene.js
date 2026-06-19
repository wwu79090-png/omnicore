/**
 * QaValidationScene scene.
 */
export default class QaValidationScene {
  constructor(options = {}) {
    this.options = options;
    this.children = [];
  }

  mount(context) {
    this.context = context;
  }

  update(delta, time) {
    for (const child of this.children) child.update?.(delta, time);
  }

  unmount() {
    this.children.length = 0;
    this.context = null;
  }
}
