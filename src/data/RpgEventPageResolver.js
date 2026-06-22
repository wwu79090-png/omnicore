import { createOmniError } from '../core/OmniError.js';

export class RpgEventPageResolver {
  constructor({ events = [] } = {}) {
    this.events = new Map();
    for (const event of events) {
      const id = String(event.id);
      this.events.set(id, {
        id,
        name: event.name || id,
        pages: normalizeArray(event.pages).map((page, index) => ({
          id: page.id || `page${index + 1}`,
          index,
          trigger: page.trigger || 'action',
          conditions: clone(page.conditions || {}),
          commands: clone(page.commands || []),
          metadata: clone(page.metadata || {})
        }))
      });
    }
  }

  resolve(eventId, state = {}) {
    const event = this.events.get(String(eventId));
    if (!event) throw createOmniError('RpgEventPageResolver', `Event is not registered: ${eventId}`);
    const page = [...event.pages].reverse().find((candidate) => pageMatches(event.id, candidate, state));
    if (!page) return null;
    return {
      eventId: event.id,
      eventName: event.name,
      pageId: page.id,
      pageIndex: page.index,
      trigger: page.trigger,
      conditions: clone(page.conditions),
      commands: clone(page.commands),
      metadata: clone(page.metadata)
    };
  }

  listActive(state = {}) {
    return [...this.events.keys()]
      .map((eventId) => this.resolve(eventId, state))
      .filter(Boolean);
  }
}

function pageMatches(eventId, page, state) {
  const conditions = page.conditions || {};
  return matchesSwitches(conditions.switches, state.switches)
    && matchesVariables(conditions.variables, state.variables)
    && matchesSelfSwitches(eventId, conditions.selfSwitches, state.selfSwitches)
    && matchesCollection(conditions.items, state.items)
    && matchesCollection(conditions.actors, state.actors);
}

function matchesSwitches(required = {}, actual = {}) {
  return Object.entries(required || {}).every(([key, value]) => Boolean(actual?.[key]) === Boolean(value));
}

function matchesSelfSwitches(eventId, required = {}, actual = {}) {
  return Object.entries(required || {}).every(([key, value]) => {
    const scoped = `${eventId}:${key}`;
    return Boolean(actual?.[scoped] ?? actual?.[key]) === Boolean(value);
  });
}

function matchesVariables(required = {}, actual = {}) {
  return Object.entries(required || {}).every(([key, rule]) => {
    const value = actual?.[key];
    if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
      if ('eq' in rule && value !== rule.eq) return false;
      if ('ne' in rule && value === rule.ne) return false;
      if ('gte' in rule && !(value >= rule.gte)) return false;
      if ('lte' in rule && !(value <= rule.lte)) return false;
      if ('gt' in rule && !(value > rule.gt)) return false;
      if ('lt' in rule && !(value < rule.lt)) return false;
      return true;
    }
    return value === rule;
  });
}

function matchesCollection(required = [], actual = []) {
  const values = normalizeArray(required);
  if (values.length === 0) return true;
  const owned = new Set(normalizeArray(actual));
  return values.every((value) => owned.has(value));
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RpgEventPageResolver;
