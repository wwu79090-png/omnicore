function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function includesAny(text, tokens) {
  return tokens.some((token) => text.includes(token));
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function entityText(entity) {
  return normalizeText(`${entity?.id || ''} ${entity?.type || ''} ${entity?.name || ''}`);
}

function resolveAnchor(scene, prompt) {
  const entities = Array.isArray(scene?.entities) ? scene.entities : [];
  const promptText = normalizeText(prompt);
  const wantsMoon = includesAny(promptText, ['moon', '月亮']);
  const wantsForest = includesAny(promptText, ['forest', '树林', '森林', '林']);
  const anchorKind = wantsMoon ? 'moon' : (wantsForest ? 'forest' : 'scene');
  const tokens = anchorKind === 'moon' ? ['moon', '月亮'] : ['forest', '树林', '森林'];
  const anchor = entities.find((entity) => includesAny(entityText(entity), tokens));
  return { anchor, anchorKind };
}

function boundsOf(entity) {
  return {
    width: toNumber(entity?.bounds?.width ?? entity?.width, 96),
    height: toNumber(entity?.bounds?.height ?? entity?.height, 96)
  };
}

export class EditorCoCreator25D {
  plan({ prompt = '', scene = {}, terrain = null, availableAssets = [] } = {}) {
    const text = normalizeText(prompt);
    const { anchor, anchorKind } = resolveAnchor(scene, prompt);
    const warnings = [];
    if (!anchor && anchorKind !== 'scene') warnings.push(`anchor-not-found:${anchorKind}`);

    const structure = includesAny(text, ['tower', '高塔', '塔']) ? 'tower' : 'structure';
    const relation = includesAny(text, ['behind', '后']) ? 'behind' : 'near';
    const propType = includesAny(text, ['sword', '剑']) ? 'sword' : null;
    const propRelation = includesAny(text, ['on-top', 'top', '塔顶', '顶部']) ? 'on-top' : 'attached';
    const anchorId = anchor?.id ? String(anchor.id) : anchorKind;
    const entityId = `${anchorId}-${structure}`;
    const anchorBounds = boundsOf(anchor);
    const anchorX = toNumber(anchor?.x);
    const anchorY = toNumber(anchor?.y);
    const baselineY = relation === 'behind'
      ? anchorY + Math.max(16, anchorBounds.height * 0.35)
      : anchorY + anchorBounds.height;
    const towerX = anchorX + Math.round(anchorBounds.width * 0.5);
    const towerY = baselineY - 48;

    return {
      protocol: 'omnicore-editor-25d-cocreation/v1',
      prompt,
      confidence: warnings.length ? 0.35 : 0.86,
      warnings,
      intent: {
        structure,
        placement: { relation, anchor: anchorId },
        prop: propType ? { type: propType, relation: propRelation } : null
      },
      placement: {
        entityId,
        x: towerX,
        y: towerY,
        z: 0,
        baselineY,
        terrainSample: terrain?.id || terrain?.name || null
      },
      assets: this._assetTasks({ entityId, structure, propType, availableAssets }),
      occlusion: [{ entityId, anchorId, relation, baselineY, sortKey: baselineY }],
      shadows: [{ entityId, type: 'ellipse', x: towerX, y: baselineY, radiusX: 28, radiusY: 10, opacity: 0.3 }],
      eventGraph: {
        format: 'OmniCore.VisualEventGraph',
        version: 1,
        nodes: [{ id: propType === 'sword' ? 'inspect-sword' : 'inspect-prop', type: 'interaction', entityId, action: 'inspect' }],
        edges: []
      }
    };
  }

  _assetTasks({ entityId, structure, propType, availableAssets }) {
    const assets = Array.isArray(availableAssets) ? availableAssets : [];
    const reuse = (kind) => assets.find((asset) => normalizeText(`${asset.id || ''} ${asset.type || ''} ${asset.name || ''}`).includes(kind));
    return [
      { kind: 'model-task', id: `${entityId}-model`, target: structure, prompt: `Generate a 2.5D ${structure} model`, reuseAssetId: reuse(structure)?.id || null },
      { kind: 'model-task', id: `${entityId}-${propType || 'prop'}-model`, target: propType || 'prop', prompt: `Generate a 2.5D ${propType || 'prop'} for ${structure}`, reuseAssetId: propType ? reuse(propType)?.id || null : null }
    ];
  }
}

export class SocialAwareness25D {
  constructor({ greetingRadius = 48 } = {}) {
    this.greetingRadius = Math.max(0, toNumber(greetingRadius));
  }

  evaluate({ npcs = [], locations = [], weather = null } = {}) {
    const normalizedNpcs = (Array.isArray(npcs) ? npcs : []).map((npc) => ({
      ...npc,
      id: String(npc.id),
      x: toNumber(npc.x),
      y: toNumber(npc.y),
      z: toNumber(npc.z),
      tags: Array.isArray(npc.tags) ? npc.tags.map(String) : [],
      wants: Array.isArray(npc.wants) ? npc.wants.map(String) : []
    }));
    const normalizedLocations = Array.isArray(locations) ? locations : [];
    return [
      ...this._greetings(normalizedNpcs),
      ...this._queues(normalizedNpcs, normalizedLocations),
      ...this._shelters(normalizedNpcs, normalizedLocations, weather)
    ];
  }

  _greetings(npcs) {
    const decisions = [];
    for (let left = 0; left < npcs.length; left += 1) {
      for (let right = left + 1; right < npcs.length; right += 1) {
        const a = npcs[left];
        const b = npcs[right];
        if (!a.tags.includes('friendly') || !b.tags.includes('friendly')) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > this.greetingRadius) continue;
        decisions.push({ type: 'greet', actorId: a.id, targetId: b.id, animation: a.animationSet?.greet || 'nod', position: { x: a.x, y: a.y, z: a.z }, reason: 'proximity:friendly' });
      }
    }
    return decisions;
  }

  _queues(npcs, locations) {
    const shop = locations.find((location) => location.type === 'shop');
    if (!shop) return [];
    const direction = { x: toNumber(shop.queueDirection?.x), y: toNumber(shop.queueDirection?.y, 16), z: toNumber(shop.queueDirection?.z) };
    return npcs
      .filter((npc) => npc.wants.includes('shop'))
      .sort((a, b) => a.id.localeCompare(b.id, 'en'))
      .map((npc, slot) => ({
        type: 'queue',
        actorId: npc.id,
        locationId: shop.id,
        slot,
        position: { x: toNumber(shop.x) + direction.x * slot, y: toNumber(shop.y) + direction.y * slot, z: toNumber(shop.z) + direction.z * slot },
        reason: 'location:shop'
      }));
  }

  _shelters(npcs, locations, weather) {
    if (weather?.type !== 'rain' || toNumber(weather.intensity) <= 0) return [];
    const shelters = locations.filter((location) => location.type === 'shelter');
    if (!shelters.length) return [];
    return npcs.filter((npc) => npc.needsShelter).map((npc) => {
      const shelter = shelters[0];
      return { type: 'shelter', actorId: npc.id, locationId: shelter.id, groupId: `rain-shelter:${shelter.id}`, position: { x: toNumber(shelter.x), y: toNumber(shelter.y), z: toNumber(shelter.z) }, reason: 'weather:rain' };
    });
  }
}

export class WorldMemory25D {
  constructor({ maxEvents = 128 } = {}) {
    this.maxEvents = Math.max(1, Math.floor(toNumber(maxEvents, 128)));
    this.events = [];
  }

  record(event) {
    if (!event?.type) throw new Error('[OmniCore] WorldMemory25D event requires a type.');
    const normalized = { ...clone(event), type: String(event.type), id: event.id == null ? `${event.type}:${this.events.length}` : String(event.id), tags: Array.isArray(event.tags) ? event.tags.map(String) : [] };
    this.events.push(normalized);
    if (this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
    return clone(normalized);
  }

  snapshot() {
    return { format: 'OmniCore.WorldMemory25D', version: 1, maxEvents: this.maxEvents, events: clone(this.events) };
  }

  resolveScenePatches(scene = {}) {
    const entities = Array.isArray(scene.entities) ? scene.entities : [];
    return this.events
      .filter((event) => event.type === 'boss-defeated' && event.locationId)
      .filter((event) => !entities.length || entities.some((entity) => String(entity.id) === String(event.locationId)))
      .map((event) => ({
        entityId: String(event.locationId),
        reason: 'memory:boss-defeated',
        eventId: event.id,
        patch: { variant: 'scarred', decals: ['broken-window', 'smoke-stain'], tags: ['persistent', 'combat-aftermath'] }
      }));
  }

  resolveDialogue(npcId, { fallback = '' } = {}) {
    const event = [...this.events].reverse().find((item) => item.type === 'skill-used-nearby' && String(item.npcId) === String(npcId));
    if (!event) return { npcId: String(npcId), lineId: 'fallback', text: fallback, reason: 'fallback' };
    return { npcId: String(npcId), lineId: `saw-${event.skillId || 'skill'}`, text: `I saw you use ${event.skillId || 'that skill'}.`, reason: 'memory:skill-used-nearby', eventId: event.id };
  }
}
