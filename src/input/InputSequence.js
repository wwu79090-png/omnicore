import EventBus from '../core/EventBus.js';

/**
 * Key sequence recognizer for QTE and combo inputs.
 */
export class InputSequence {
  constructor({ events = new EventBus(), timeout = 600 } = {}) {
    this.events = events;
    this.timeout = timeout;
    this.definitions = new Map();
    this.buffer = [];
  }

  define(name, keys, options = {}) {
    this.definitions.set(name, {
      name,
      keys: [...keys],
      timeout: options.timeout || this.timeout,
      event: options.event || 'input:sequence'
    });
    return this;
  }

  feed(code, time = Date.now()) {
    this.buffer.push({ code, time });
    this._trim(time);
    for (const definition of this.definitions.values()) {
      if (this._matches(definition)) {
        const payload = { name: definition.name, keys: [...definition.keys], at: time };
        this.events.emit(definition.event, payload);
        this.buffer.length = 0;
        return payload;
      }
    }
    return null;
  }

  clear() {
    this.buffer.length = 0;
  }

  _trim(time) {
    const oldest = time - this.timeout;
    this.buffer = this.buffer.filter((entry) => entry.time >= oldest);
  }

  _matches({ keys, timeout }) {
    if (this.buffer.length < keys.length) return false;
    const recent = this.buffer.slice(-keys.length);
    if (recent[recent.length - 1].time - recent[0].time > timeout) return false;
    return keys.every((key, index) => recent[index].code === key);
  }
}

export default InputSequence;
