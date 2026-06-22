import { createOmniError } from '../core/OmniError.js';

export const REMOTE_EVENT_SCHEMA = 'omnicore.remote-event.v1';

export class RemoteEventContract {
  constructor({ events = {}, schema = REMOTE_EVENT_SCHEMA } = {}) {
    this.schema = schema;
    this.events = new Map(Object.entries(events || {}).map(([name, config]) => [name, normalizeEvent(name, config)]));
  }

  get(event) {
    return this.events.get(String(event)) || null;
  }

  validate(event, payload = {}, { direction = null } = {}) {
    const name = String(event);
    const contract = this.get(name);
    const errors = [];
    if (!contract) {
      errors.push({ code: 'unknown-event', path: name, message: `Remote event is not registered: ${name}` });
      return { ok: false, event: name, errors };
    }
    if (direction && direction !== contract.direction) {
      errors.push({
        code: 'invalid-direction',
        path: name,
        message: `Remote event ${name} expects ${contract.direction}, received ${direction}.`
      });
    }
    for (const [field, expected] of Object.entries(contract.payload)) {
      const optional = expected.endsWith('?');
      const type = optional ? expected.slice(0, -1) : expected;
      const value = payload?.[field];
      if (value == null) {
        if (!optional) errors.push({ code: 'missing-field', path: `${name}.${field}`, message: `${field} is required.` });
        continue;
      }
      if (!matchesType(value, type)) {
        errors.push({
          code: 'invalid-type',
          path: `${name}.${field}`,
          message: `${field} must be ${type}.`
        });
      }
    }
    errors.sort((left, right) => errorOrder(left.code) - errorOrder(right.code));
    return { ok: errors.length === 0, event: name, direction: contract.direction, errors };
  }

  serialize(event, payload = {}, options = {}) {
    const contract = this.get(event);
    const direction = options.direction || contract?.direction;
    const report = this.validate(event, payload, { direction });
    if (!report.ok) {
      const message = report.errors.map((error) => error.message).join('\n');
      throw createOmniError('RemoteEventContract', message);
    }
    return {
      schema: this.schema,
      event: String(event),
      direction: contract.direction,
      reliable: contract.reliable,
      payload: clone(payload)
    };
  }

  manifest() {
    return {
      schema: this.schema,
      events: Object.fromEntries([...this.events.entries()].map(([name, config]) => [name, clone(config)]))
    };
  }
}

function normalizeEvent(name, config = {}) {
  return {
    name,
    direction: config.direction || 'bidirectional',
    reliable: config.reliable !== false,
    payload: Object.fromEntries(
      Object.entries(config.payload || {}).map(([field, type]) => [field, String(type)])
    ),
    rateLimit: clone(config.rateLimit || null)
  };
}

function matchesType(value, type) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  switch (type) {
    case 'bigint':
      return typeof value === 'bigint';
    case 'boolean':
      return typeof value === 'boolean';
    case 'function':
      return typeof value === 'function';
    case 'number':
      return typeof value === 'number';
    case 'string':
      return typeof value === 'string';
    case 'symbol':
      return typeof value === 'symbol';
    case 'undefined':
      return typeof value === 'undefined';
    default:
      return false;
  }
}

function errorOrder(code) {
  return ['invalid-direction', 'invalid-type', 'missing-field'].indexOf(code);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RemoteEventContract;
