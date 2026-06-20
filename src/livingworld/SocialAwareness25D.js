function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeNpcs(npcs) {
  return (Array.isArray(npcs) ? npcs : [])
    .filter((npc) => npc && npc.id != null)
    .map((npc, index) => ({
      ...npc,
      id: String(npc.id),
      x: toNumber(npc.x),
      y: toNumber(npc.y),
      z: toNumber(npc.z),
      tags: Array.isArray(npc.tags) ? npc.tags.map(String) : [],
      wants: Array.isArray(npc.wants) ? npc.wants.map(String) : [],
      index
    }));
}

function normalizeLocations(locations) {
  return (Array.isArray(locations) ? locations : [])
    .filter((location) => location && location.id != null)
    .map((location) => ({
      ...location,
      id: String(location.id),
      type: String(location.type || ''),
      x: toNumber(location.x),
      y: toNumber(location.y),
      z: toNumber(location.z)
    }));
}

function distance2D(left, right) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return Math.hypot(dx, dy);
}

function hasTag(npc, tag) {
  return npc.tags.includes(tag);
}

function compareById(left, right) {
  return left.id.localeCompare(right.id, 'en');
}

export class SocialAwareness25D {
  constructor({ greetingRadius = 48, debug = false } = {}) {
    this.greetingRadius = Math.max(0, toNumber(greetingRadius));
    this.debug = Boolean(debug);
  }

  evaluate({ npcs = [], locations = [], weather = null } = {}) {
    const validNpcs = normalizeNpcs(npcs);
    const validLocations = normalizeLocations(locations);
    return [
      ...this._greetings(validNpcs),
      ...this._queues(validNpcs, validLocations),
      ...this._shelters(validNpcs, validLocations, weather)
    ];
  }

  _greetings(npcs) {
    const decisions = [];
    for (let leftIndex = 0; leftIndex < npcs.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < npcs.length; rightIndex += 1) {
        const left = npcs[leftIndex];
        const right = npcs[rightIndex];
        if (!hasTag(left, 'friendly') || !hasTag(right, 'friendly')) continue;
        if (distance2D(left, right) > this.greetingRadius) continue;
        decisions.push({
          type: 'greet',
          actorId: left.id,
          targetId: right.id,
          animation: left.animationSet?.greet || 'nod',
          position: { x: left.x, y: left.y, z: left.z },
          reason: 'proximity:friendly'
        });
      }
    }
    return decisions;
  }

  _queues(npcs, locations) {
    const shop = locations.find((location) => location.type === 'shop');
    if (!shop) return [];
    const direction = {
      x: toNumber(shop.queueDirection?.x),
      y: toNumber(shop.queueDirection?.y, 16),
      z: toNumber(shop.queueDirection?.z)
    };
    return npcs
      .filter((npc) => npc.wants.includes('shop'))
      .sort(compareById)
      .map((npc, slot) => ({
        type: 'queue',
        actorId: npc.id,
        locationId: shop.id,
        slot,
        position: {
          x: shop.x + direction.x * slot,
          y: shop.y + direction.y * slot,
          z: shop.z + direction.z * slot
        },
        reason: 'location:shop'
      }));
  }

  _shelters(npcs, locations, weather) {
    if (weather?.type !== 'rain' || toNumber(weather.intensity) <= 0) return [];
    const shelters = locations.filter((location) => location.type === 'shelter');
    if (!shelters.length) return [];
    return npcs
      .filter((npc) => npc.needsShelter)
      .sort(compareById)
      .map((npc) => {
        const shelter = shelters.reduce((closest, candidate) => (
          distance2D(npc, candidate) < distance2D(npc, closest) ? candidate : closest
        ), shelters[0]);
        return {
          type: 'shelter',
          actorId: npc.id,
          locationId: shelter.id,
          groupId: `rain-shelter:${shelter.id}`,
          position: { x: shelter.x, y: shelter.y, z: shelter.z },
          reason: 'weather:rain'
        };
      });
  }
}

export default SocialAwareness25D;
