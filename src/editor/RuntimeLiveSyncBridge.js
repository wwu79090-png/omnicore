import PlaySession from './PlaySession.js';

export class RuntimeLiveSyncBridge {
  constructor({ game, transport = null, playSession = null } = {}) {
    this.game = game;
    this.transport = transport;
    this.playSession = playSession || game?.playSession || null;
  }

  connect(transport = this.transport) {
    this.transport = transport;
    this.playSession = this._ensurePlaySession();
    this.publishHello();
    this.publishPlayState();
    this.publishScene();
    return this;
  }

  publishHello() {
    return this._send('runtime:hello', {
      version: this.game?.config?.engineVersion || '0.1.0',
      capabilities: {
        playMode: true,
        liveEdit: true,
        profiler: Boolean(this.game?.frameProfiler)
      }
    });
  }

  publishScene(scene = this.game?.scene?.current) {
    const payload = serializeScene(scene);
    const message = this._send('runtime:scene', payload);
    this.game?.store?.set?.('editor:liveSyncScene', payload);
    return message;
  }

  publishPlayState() {
    return this._send('runtime:play-state', this._ensurePlaySession().snapshot());
  }

  publishProfilerFrame(frame = this.game?.frameProfiler?.latest?.()) {
    if (!frame) return null;
    return this._send('runtime:profiler-frame', frame);
  }

  handleEditorMessage(message = {}) {
    const parsed = typeof message === 'string' ? JSON.parse(message) : message;
    const result = this._ensurePlaySession().applyEditorMessage(parsed);
    if (result?.ok && ['editor:update-entity', 'editor:create-entity'].includes(parsed.type)) {
      if (parsed.type === 'editor:update-entity') {
        this._send('runtime:entity-updated', {
          id: parsed.payload?.id,
          patch: parsed.payload?.patch || {},
          entity: result.entity || null,
          commandId: parsed.payload?.commandId || null,
          playMode: this._ensurePlaySession().mode
        });
      }
      this.publishScene();
    }
    return result;
  }

  applyEditorCommand(command = {}) {
    const result = this.handleEditorMessage({ type: 'editor:update-entity', payload: command });
    return result?.entity || null;
  }

  _send(type, payload = {}) {
    const message = {
      type,
      payload,
      meta: {
        source: 'omnicore-runtime',
        sentAt: new Date().toISOString()
      }
    };
    this.transport?.send?.(JSON.stringify(message));
    return message;
  }

  _ensurePlaySession() {
    if (!this.playSession) {
      this.playSession = new PlaySession({
        game: this.game,
        publish: (type, payload) => this._send(type, payload)
      });
      if (this.game) this.game.playSession = this.playSession;
    } else {
      this.playSession.setPublisher?.((type, payload) => this._send(type, payload));
      if (this.game && !this.game.playSession) this.game.playSession = this.playSession;
    }
    return this.playSession;
  }
}

function serializeScene(scene = {}) {
  return {
    name: scene?.name || 'untitled',
    entities: (scene?.children || []).map((entity, index) => serializeEntity(entity, index))
  };
}

function serializeEntity(entity = {}, index = 0) {
  const output = {};
  const seen = new WeakSet();
  for (const [key, value] of Object.entries(entity)) {
    if (key === 'parent' || key === 'game' || key === 'displayObject' || key.startsWith('__')) continue;
    const serialized = serializeValue(value, seen);
    if (serialized !== undefined) output[key] = serialized;
  }
  return {
    ...output,
    id: output.id || output.name || `entity-${index}`,
    name: output.name || output.id || `Entity ${index + 1}`,
    type: output.type || 'entity',
    texture: output.texture || output.sprite || null,
    x: output.x ?? 0,
    y: output.y ?? 0,
    width: output.width ?? 0,
    height: output.height ?? 0,
    rotation: output.rotation ?? 0,
    scaleX: output.scaleX ?? output.scale ?? 1,
    scaleY: output.scaleY ?? output.scale ?? 1
  };
}

function serializeValue(value, seen) {
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => serializeValue(item, seen))
      .filter((item) => item !== undefined);
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'parent' && key !== 'game' && key !== 'displayObject' && !key.startsWith('__'))
      .map(([key, item]) => [key, serializeValue(item, seen)])
      .filter(([, item]) => item !== undefined)
  );
}

export default RuntimeLiveSyncBridge;
