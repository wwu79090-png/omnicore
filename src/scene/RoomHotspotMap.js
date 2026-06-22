import { createOmniError } from '../core/OmniError.js';

export class RoomHotspotMap {
  constructor({ hotspots = [] } = {}) {
    this.hotspots = hotspots.map(normalizeHotspot);
  }

  hitTest(x, y) {
    const point = { x: Number(x), y: Number(y) };
    return this.hotspots.find((hotspot) => contains(hotspot.bounds, point)) || null;
  }

  locationName(x, y) {
    const hotspot = this.hitTest(x, y);
    return hotspot?.name || '';
  }

  interactAt(point = {}, verb = 'interact', context = {}) {
    const hotspot = this.hitTest(point.x, point.y);
    if (!hotspot) return { ok: false, reason: 'no-hotspot' };
    return this.interact(hotspot.id, verb, context);
  }

  interact(id, verb = 'interact', context = {}) {
    const hotspot = this.hotspots.find((item) => item.id === String(id));
    if (!hotspot) throw createOmniError('RoomHotspotMap', `Hotspot is not registered: ${id}`);
    const interaction = hotspot.interactions[verb];
    if (!interaction) return { ok: false, hotspot: hotspot.id, reason: 'missing-interaction' };
    const missing = normalizeArray(interaction.requires).filter((item) => !normalizeArray(context.inventory).includes(item));
    if (missing.length) {
      return {
        ok: false,
        hotspot: hotspot.id,
        reason: 'missing-requirement',
        missing
      };
    }
    const variables = { ...(context.variables || {}), ...(interaction.set || {}) };
    if (interaction.emit) {
      context.emit?.(interaction.emit, { hotspot: hotspot.id, verb });
    }
    return {
      ok: true,
      hotspot: hotspot.id,
      verb,
      text: interaction.text || '',
      walkTo: clone(hotspot.walkTo || null),
      variables
    };
  }
}

function normalizeHotspot(hotspot = {}) {
  return {
    id: String(hotspot.id || hotspot.name || 'hotspot'),
    name: hotspot.name || hotspot.id || 'Hotspot',
    bounds: {
      x: Number(hotspot.bounds?.x ?? hotspot.x ?? 0),
      y: Number(hotspot.bounds?.y ?? hotspot.y ?? 0),
      width: Number(hotspot.bounds?.width ?? hotspot.width ?? 0),
      height: Number(hotspot.bounds?.height ?? hotspot.height ?? 0)
    },
    walkTo: hotspot.walkTo ? clone(hotspot.walkTo) : null,
    interactions: clone(hotspot.interactions || {})
  };
}

function contains(bounds, point) {
  return point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RoomHotspotMap;
