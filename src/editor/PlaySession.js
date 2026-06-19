import { createOmniError } from '../core/OmniError.js';

const VALID_MODES = new Set(['editing', 'playing', 'paused']);
const COMMAND_LIMIT = 200;

export class PlaySession {
  constructor({
    game = null,
    mode = 'editing',
    maxCommandIds = COMMAND_LIMIT,
    clock = () => Date.now(),
    publish = null
  } = {}) {
    this.game = game;
    this.mode = VALID_MODES.has(mode) ? mode : 'editing';
    this.maxCommandIds = maxCommandIds;
    this.clock = clock;
    this.publish = publish;
    this.startedAt = null;
    this.pausedAt = null;
    this.frame = 0;
    this.lastCommandId = null;
    this.appliedCommandIds = new Set();
    this.commandOrder = [];
    this.publishState();
  }

  setPublisher(publish) {
    this.publish = publish;
    return this;
  }

  snapshot() {
    return {
      mode: this.mode,
      startedAt: this.startedAt,
      pausedAt: this.pausedAt,
      frame: this.frame,
      lastCommandId: this.lastCommandId
    };
  }

  setMode(mode) {
    if (!VALID_MODES.has(mode)) throw playSessionError(`Invalid play mode: ${mode}`);
    const now = this.clock();
    this.mode = mode;
    if (mode === 'playing' && !this.startedAt) this.startedAt = now;
    if (mode === 'paused') this.pausedAt = now;
    if (mode === 'editing') {
      this.startedAt = null;
      this.pausedAt = null;
    }
    return this.publishState();
  }

  shouldAdvanceSimulation() {
    return this.mode === 'playing';
  }

  advanceFrame() {
    this.frame += 1;
    return this.frame;
  }

  publishState() {
    const state = this.snapshot();
    this.game?.store?.set?.('editor:playState', state);
    this.game?.events?.emit?.('runtime:play-state', state);
    this.publish?.('runtime:play-state', state);
    return state;
  }

  applyEditorMessage(message = {}) {
    try {
      return this.applyCommand(message.type, message.payload || {});
    } catch (error) {
      return this._commandError(message.type || 'unknown', error.message || String(error), message.payload || {});
    }
  }

  applyCommand(type, payload = {}) {
    if (!type) throw playSessionError('Missing editor command type');
    if (this._isDuplicate(payload.commandId)) {
      return { ok: true, duplicate: true, commandId: payload.commandId };
    }
    if (payload.commandId) this._rememberCommand(payload.commandId);

    if (type === 'editor:set-play-mode') {
      const playState = this.setMode(payload.mode);
      return { ok: true, type, playState };
    }
    if (type === 'editor:update-entity') return this.applyEntityPatch(payload);
    if (type === 'editor:create-entity') return this.createEntity(payload);
    if (type === 'editor:update-database-record') return this.updateDatabaseRecord(payload);
    if (type === 'editor:update-tilemap') return this.updateTilemap(payload);
    if (type === 'editor:request-scene') return { ok: true, type };
    if (type === 'editor:request-profiler') {
      this.game?.store?.set?.('profiler:enabled', payload.enabled !== false);
      return { ok: true, type, enabled: payload.enabled !== false };
    }
    throw playSessionError(`Unsupported editor command: ${type}`);
  }

  applyEntityPatch({ id, patch } = {}) {
    if (!id) throw playSessionError('Missing entity id');
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw playSessionError('Missing entity patch');
    const entity = this._findEntity(id);
    if (!entity) throw playSessionError(`Entity not found: ${id}`);
    const safePatch = sanitizePatch(patch);
    Object.assign(entity, safePatch);
    this.game?.store?.set?.('editor:lastEntityPatch', { id, patch: safePatch });
    this.game?.events?.emit?.('editor:entity-updated', { id, entity, patch: safePatch });
    this.requestRender();
    return { ok: true, type: 'editor:update-entity', entity };
  }

  createEntity({ entity } = {}) {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) throw playSessionError('Missing entity payload');
    const scene = this.game?.scene?.current;
    if (!scene) throw playSessionError('No active scene');
    const next = normalizeEntity(entity, scene.children?.length || 0);
    if (this._findEntity(next.id)) return { ok: true, type: 'editor:create-entity', duplicateEntity: true, entity: this._findEntity(next.id) };
    if (typeof scene.add === 'function') scene.add(next);
    else scene.children?.push?.(next);
    this.game?.store?.set?.('editor:lastCreatedEntity', serializeEntity(next));
    this.game?.events?.emit?.('editor:entity-created', { entity: next });
    this.requestRender();
    return { ok: true, type: 'editor:create-entity', entity: next };
  }

  updateDatabaseRecord({ table, id, patch } = {}) {
    if (!table || !id) throw playSessionError('Missing database table or id');
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw playSessionError('Missing database patch');
    const current = this.game?.database?.get?.(table, id) || { id };
    const record = this.game?.database?.register?.(table, id, { ...current, ...sanitizePatch(patch) });
    const payload = { table, id, record };
    this.game?.store?.set?.('database:lastUpdatedRecord', payload);
    this.game?.events?.emit?.('database:record-updated', payload);
    this.publish?.('runtime:database', { table, id, record });
    return { ok: true, type: 'editor:update-database-record', record };
  }

  updateTilemap(payload = {}) {
    const current = this.game?.store?.get?.('tilemap:current') || {};
    const source = payload.tilemap || { ...current, ...(payload.patch || {}) };
    const tilemap = normalizeTilemap(source);
    this.game?.store?.set?.('tilemap:current', tilemap);
    this.game?.store?.set?.('editor:tilemap', tilemap);
    this._applyTilemapToScene(tilemap);
    this.game?.events?.emit?.('tilemap:updated', tilemap);
    this.publish?.('runtime:tilemap', tilemap);
    this.requestRender();
    return { ok: true, type: 'editor:update-tilemap', tilemap };
  }

  requestRender() {
    const scene = this.game?.scene?.current || null;
    this.game?.renderer?.renderScene?.(scene);
    return scene;
  }

  _findEntity(id) {
    return (this.game?.scene?.current?.children || []).find((entity) => entity.id === id || entity.name === id) || null;
  }

  _applyTilemapToScene(tilemap) {
    const children = this.game?.scene?.current?.children || [];
    for (const entity of children) {
      if (entity.type !== 'tilemap' && !entity.layers && !entity.tileWidth) continue;
      entity.width = tilemap.width;
      entity.height = tilemap.height;
      entity.tileWidth = tilemap.tileWidth;
      entity.tileHeight = tilemap.tileHeight;
      entity.data = [...tilemap.data];
      entity.collisions = [...tilemap.collisions];
      const layer = entity.layers?.find?.((item) => item.type === 'tilelayer') || entity.layers?.[0];
      if (layer?.data) layer.data = [...tilemap.data];
    }
  }

  _isDuplicate(commandId) {
    return Boolean(commandId && this.appliedCommandIds.has(commandId));
  }

  _rememberCommand(commandId) {
    this.lastCommandId = commandId;
    this.appliedCommandIds.add(commandId);
    this.commandOrder.push(commandId);
    while (this.commandOrder.length > this.maxCommandIds) {
      const oldest = this.commandOrder.shift();
      this.appliedCommandIds.delete(oldest);
    }
  }

  _commandError(type, message, payload = {}) {
    const error = { ok: false, type, message, payload };
    this.game?.store?.set?.('editor:lastCommandError', error);
    this.game?.events?.emit?.('runtime:command-error', error);
    this.publish?.('runtime:command-error', error);
    return error;
  }
}

function sanitizePatch(patch = {}) {
  const next = {};
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'number' && !Number.isFinite(value)) throw playSessionError(`Invalid numeric value for ${key}`);
    next[key] = cloneSerializable(value);
  }
  return next;
}

function normalizeEntity(entity = {}, index = 0) {
  const next = sanitizePatch(entity);
  next.id = String(next.id || next.name || `entity-${index + 1}`);
  next.name = next.name || next.id;
  next.type = next.type || 'entity';
  next.x = finiteNumber(next.x, 0);
  next.y = finiteNumber(next.y, 0);
  next.width = finiteNumber(next.width, 32);
  next.height = finiteNumber(next.height, 32);
  next.rotation = finiteNumber(next.rotation, 0);
  next.scaleX = finiteNumber(next.scaleX ?? next.scale, 1);
  next.scaleY = finiteNumber(next.scaleY ?? next.scale, 1);
  next.sprite = next.sprite || next.texture || next.type || true;
  return next;
}

function normalizeTilemap(tilemap = {}) {
  const width = Math.max(0, finiteNumber(tilemap.width, 16));
  const height = Math.max(0, finiteNumber(tilemap.height, 12));
  const size = width * height;
  const data = Array.isArray(tilemap.data) ? [...tilemap.data] : [];
  while (data.length < size) data.push(0);
  return {
    width,
    height,
    tileWidth: finiteNumber(tilemap.tileWidth ?? tilemap.tilewidth, 16),
    tileHeight: finiteNumber(tilemap.tileHeight ?? tilemap.tileheight, 16),
    data: data.slice(0, size).map((value) => finiteNumber(value, 0)),
    collisions: Array.isArray(tilemap.collisions) ? [...tilemap.collisions] : []
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cloneSerializable(value) {
  if (Array.isArray(value)) return value.map(cloneSerializable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => typeof nested !== 'function')
      .map(([key, nested]) => [key, cloneSerializable(nested)])
  );
}

function serializeEntity(entity = {}) {
  const output = {};
  for (const [key, value] of Object.entries(entity)) {
    if (key === 'parent' || key === 'displayObject' || key.startsWith('__') || typeof value === 'function') continue;
    output[key] = cloneSerializable(value);
  }
  return output;
}

function playSessionError(message, details = null) {
  return createOmniError('PlaySession', message, { code: 'OMNICORE_PLAY_SESSION_ERROR', details });
}

export default PlaySession;
