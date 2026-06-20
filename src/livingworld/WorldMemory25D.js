import { createOmniError } from '../core/OmniError.js';

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeMaxEvents(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 128;
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.map(String) : [];
}

function sceneHasEntity(scene, entityId) {
  const entities = Array.isArray(scene?.entities) ? scene.entities : [];
  if (!entities.length) return true;
  return entities.some((entity) => String(entity?.id) === String(entityId));
}

export class WorldMemory25D {
  constructor({ maxEvents = 128, debug = false } = {}) {
    this.maxEvents = normalizeMaxEvents(maxEvents);
    this.debug = Boolean(debug);
    this.events = [];
  }

  record(event) {
    if (!event || !event.type) {
      throw createOmniError('LivingWorld', 'WorldMemory25D event requires a type.');
    }
    const normalized = {
      ...clone(event),
      type: String(event.type),
      id: event.id == null ? `${event.type}:${this.events.length}` : String(event.id),
      tags: normalizeTags(event.tags)
    };
    this.events.push(normalized);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
    return clone(normalized);
  }

  snapshot() {
    return {
      format: 'OmniCore.WorldMemory25D',
      version: 1,
      maxEvents: this.maxEvents,
      events: clone(this.events)
    };
  }

  restore(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.events)) {
      this.events = [];
      return this;
    }
    this.maxEvents = normalizeMaxEvents(snapshot.maxEvents || this.maxEvents);
    this.events = [];
    snapshot.events.forEach((event) => {
      if (event?.type) this.record(event);
    });
    return this;
  }

  resolveScenePatches(scene = {}) {
    return this.events.flatMap((event) => {
      if (event.type === 'boss-defeated') {
        return this._bossDefeatPatch(event, scene);
      }
      if (event.type === 'cocreation-applied') {
        return this._coCreationPatch(event, scene);
      }
      return [];
    });
  }

  resolveDialogue(npcId, { fallback = '' } = {}) {
    const targetNpcId = String(npcId);
    const skillEvent = [...this.events].reverse().find((event) => (
      event.type === 'skill-used-nearby' && String(event.npcId) === targetNpcId
    ));
    if (skillEvent) {
      return {
        npcId: targetNpcId,
        lineId: `saw-${skillEvent.skillId || 'skill'}`,
        text: `I saw you use ${skillEvent.skillId || 'that skill'}.`,
        reason: 'memory:skill-used-nearby',
        eventId: skillEvent.id
      };
    }

    const bossEvent = [...this.events].reverse().find((event) => (
      event.type === 'boss-defeated'
      && (String(event.npcId) === targetNpcId || event.tags.includes('public'))
    ));
    if (bossEvent) {
      return {
        npcId: targetNpcId,
        lineId: `remembers-${bossEvent.id}`,
        text: fallback || 'The town still remembers that battle.',
        reason: 'memory:boss-defeated',
        eventId: bossEvent.id
      };
    }

    return {
      npcId: targetNpcId,
      lineId: 'fallback',
      text: fallback,
      reason: 'fallback'
    };
  }

  _bossDefeatPatch(event, scene) {
    if (!event.locationId || !sceneHasEntity(scene, event.locationId)) return [];
    return [{
      entityId: String(event.locationId),
      reason: 'memory:boss-defeated',
      eventId: event.id,
      patch: {
        variant: 'scarred',
        decals: ['broken-window', 'smoke-stain'],
        tags: ['persistent', 'combat-aftermath']
      }
    }];
  }

  _coCreationPatch(event, scene) {
    if (!event.locationId || !sceneHasEntity(scene, event.locationId)) return [];
    return [{
      entityId: String(event.locationId),
      reason: 'memory:cocreation-applied',
      eventId: event.id,
      patch: {
        variant: 'co-created',
        plan: clone(event.plan),
        tags: ['persistent', 'co-created']
      }
    }];
  }
}

export default WorldMemory25D;
