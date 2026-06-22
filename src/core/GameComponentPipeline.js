import { createOmniError } from './OmniError.js';

export class GameComponentPipeline {
  constructor() {
    this.components = new Map();
    this.sequence = 0;
  }

  add(component = {}) {
    if (!component.id) throw createOmniError('GameComponentPipeline', 'Component id is required.');
    const id = String(component.id);
    this.components.set(id, {
      ...component,
      id,
      enabled: component.enabled !== false,
      visible: component.visible !== false,
      updateOrder: Number(component.updateOrder || 0),
      drawOrder: Number(component.drawOrder || 0),
      initialized: false,
      sequence: this.sequence
    });
    this.sequence += 1;
    return this;
  }

  initialize() {
    for (const component of this._orderedBy('updateOrder')) {
      if (!component.initialized) {
        component.initialize?.(this._context(component));
        component.initialized = true;
      }
    }
    return this;
  }

  setEnabled(id, enabled) {
    this._component(id).enabled = Boolean(enabled);
    return this;
  }

  setVisible(id, visible) {
    this._component(id).visible = Boolean(visible);
    return this;
  }

  update(gameTime = {}) {
    for (const component of this._orderedBy('updateOrder')) {
      if (component.enabled) component.update?.(this._context(component, gameTime), gameTime);
    }
    return this;
  }

  draw(gameTime = {}) {
    for (const component of this._orderedBy('drawOrder')) {
      if (component.visible) component.draw?.(this._context(component, gameTime), gameTime);
    }
    return this;
  }

  snapshot() {
    return [...this.components.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((component) => ({
        id: component.id,
        enabled: component.enabled,
        visible: component.visible,
        updateOrder: component.updateOrder,
        drawOrder: component.drawOrder,
        initialized: component.initialized
      }));
  }

  _orderedBy(field) {
    return [...this.components.values()].sort((a, b) => {
      const order = a[field] - b[field];
      return order || a.sequence - b.sequence;
    });
  }

  _context(component, gameTime = {}) {
    return {
      pipeline: this,
      component,
      gameTime
    };
  }

  _component(id) {
    const component = this.components.get(String(id));
    if (!component) throw createOmniError('GameComponentPipeline', `Component is not registered: ${id}`);
    return component;
  }
}

export default GameComponentPipeline;
