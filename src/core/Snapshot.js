const SNAPSHOT_SCHEMA_VERSION = 1;
const DEFAULT_SNAPSHOT_STORE_KEYS = [
  'currentScene',
  'levelId',
  'level.id',
  'player.position',
  'player.x',
  'player.y',
  'player.storeKey'
];

const DEFAULT_LEAK_RATIO = 50;

function safeClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeFrame(context = {}) {
  if (typeof context.frame === 'number' && Number.isFinite(context.frame)) return context.frame;
  return Number(context) || 0;
}

function normalizeLevelId(game, scene) {
  const currentScene = game?.store?.get?.('currentScene');
  if (currentScene != null) return currentScene;
  return game?.store?.get?.('levelId') || scene?.name || null;
}

function readPlayerPosition(game) {
  const direct = game?.store?.get?.('player.position');
  if (direct && typeof direct === 'object') {
    return {
      x: Number(direct.x) || 0,
      y: Number(direct.y) || 0
    };
  }
  return {
    x: Number(game?.store?.get?.('player.x')) || 0,
    y: Number(game?.store?.get?.('player.y')) || 0
  };
}

function safeEntityId(entity, fallback) {
  if (entity?.id != null) return String(entity.id);
  if (entity?.name != null) return String(entity.name);
  if (entity?.storeKey != null) return String(entity.storeKey);
  if (entity?.key != null) return String(entity.key);
  return fallback != null ? `__omnicore-${fallback}` : '__omnicore-entity';
}

function collectEntityEntries(scene) {
  const entries = [];
  if (!scene || !Array.isArray(scene.children)) return entries;

  const seen = new Set();
  const usedCounters = new Map();

  const ensureUniqueKey = (raw, fallback) => {
    const base = String(raw || fallback || '__omnicore-entity');
    const count = usedCounters.get(base) || 0;
    usedCounters.set(base, count + 1);
    return count === 0 ? base : `${base}#${count}`;
  };

  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    const candidate = safeEntityId(node, path);
    const entityKey = ensureUniqueKey(candidate, path);
    if (!seen.has(entityKey)) {
      seen.add(entityKey);
      entries.push({ key: entityKey, node });
    }
    const { children } = node;
    if (!Array.isArray(children)) return;
    for (let i = 0; i < children.length; i += 1) {
      visit(children[i], `${path || 'root'}/${i}`);
    }
  };

  for (let i = 0; i < scene.children.length; i += 1) {
    visit(scene.children[i], String(i));
  }
  return entries;
}

function makeEntitySet(entries) {
  const result = new Set();
  for (const entry of entries) result.add(entry.key);
  return result;
}

export class Snapshot {
  constructor({
    game = null,
    logger = null,
    storeKeys = DEFAULT_SNAPSHOT_STORE_KEYS,
    leakRatio = DEFAULT_LEAK_RATIO,
    enabled = true
  } = {}) {
    this.game = game;
    this.logger = logger;
    this.storeKeys = Array.isArray(storeKeys) && storeKeys.length > 0
      ? [...storeKeys]
      : [...DEFAULT_SNAPSHOT_STORE_KEYS];
    this.leakRatio = Number.isFinite(leakRatio) && leakRatio > 0 ? Number(leakRatio) : DEFAULT_LEAK_RATIO;
    this.enabled = enabled !== false;
    this.frameStart = null;
    this.lastCleanFrame = null;
  }

  startFrame(frameContext = {}) {
    if (!this.enabled || !this.game) return null;

    const scene = this.game.scene?.current || null;
    const entries = collectEntityEntries(scene);
    const frame = normalizeFrame(frameContext);
    const snapshot = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      frame,
      startedAt: new Date().toISOString(),
      startedTime: frameContext.time || 0,
      levelId: normalizeLevelId(this.game, scene),
      player: readPlayerPosition(this.game),
      entities: entries.map((entry) => entry.key)
    };

    const store = {};
    for (const key of this.storeKeys) {
      store[key] = safeClone(this.game.store?.get?.(key));
    }
    snapshot.store = store;
    this.frameStart = snapshot;
    return snapshot;
  }

  endFrame(frameContext = {}) {
    if (!this.enabled || !this.game || !this.frameStart) return null;

    const scene = this.game.scene?.current || null;
    const startSet = makeEntitySet(this.frameStart.entities.map((entry) => ({ key: entry })));
    const endEntries = collectEntityEntries(scene);
    const endSet = makeEntitySet(endEntries);

    const created = [...endSet].filter((key) => !startSet.has(key));
    const destroyed = [...startSet].filter((key) => !endSet.has(key));

    const frame = normalizeFrame(frameContext);

    if (frameContext.error) {
      this._logFrame({
        level: 'error',
        code: 'RUNTIME_FRAME_ERROR',
        frame,
        message: '未捕获异常：该帧未提交干净快照，保持上一次基线不变。',
        cause: frameContext.error?.message || String(frameContext.error || 'unknown'),
        createdCount: created.length,
        destroyedCount: destroyed.length,
        leakRatio: null
      });
      this.frameStart = null;
      return {
        frame,
        createdCount: created.length,
        destroyedCount: destroyed.length,
        created,
        destroyed,
        recovered: false
      };
    }

    const store = {};
    for (const key of this.storeKeys) {
      store[key] = safeClone(this.game.store?.get?.(key));
    }
    const levelId = normalizeLevelId(this.game, scene);
    const player = readPlayerPosition(this.game);

    this.lastCleanFrame = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      frame,
      levelId,
      player,
      entities: [...endSet],
      store,
      endedAt: new Date().toISOString(),
      endedTime: frameContext.time || 0
    };

    this._checkLeak(frame, {
      createdCount: created.length,
      destroyedCount: destroyed.length,
      created,
      destroyed
    });

    this.frameStart = null;
    return this.lastCleanFrame;
  }

  rollbackOnError(error, frameContext = {}) {
    if (!this.enabled || !this.game) {
      this._logFrame({
        level: 'error',
        code: 'RUNTIME_NO_ROLLBACK',
        frame: normalizeFrame(frameContext),
        message: '快照系统未启用，异常无法回滚。',
        cause: error?.message || String(error || 'unknown')
      });
      return { recovered: false, reason: 'snapshot-disabled' };
    }

    if (!this.lastCleanFrame) {
      this._logFrame({
        level: 'error',
        code: 'RUNTIME_NO_BASELINE',
        frame: normalizeFrame(frameContext),
        message: '未发现上一帧可恢复基线，无法执行回滚。',
        cause: error?.message || String(error || 'unknown')
      });
      return { recovered: false, reason: 'no-baseline' };
    }

    const restoreFrame = this.lastCleanFrame;
    for (const [key, value] of Object.entries(restoreFrame.store || {})) {
      this.game.store?.set?.(key, safeClone(value));
    }

    const scene = this.game.scene?.current || null;
    const targetSet = new Set(restoreFrame.entities || []);
    const currentEntries = collectEntityEntries(scene);
    const removedCount = [];
    for (const entry of currentEntries) {
      if (!targetSet.has(entry.key) && entry?.node?.destroy) {
        try {
          const { node } = entry;
          if (node.parent?.removeChild) node.parent.removeChild(node);
          else if (scene?.children?.includes?.(node)) {
            const index = scene.children.indexOf(node);
            if (index >= 0) scene.children.splice(index, 1);
          }
          node.destroy();
          removedCount.push(entry.key);
        } catch (removeError) {
          this._logFrame({
            level: 'warn',
            code: 'RUNTIME_ROLLBACK_CLEANUP_FAIL',
            frame: normalizeFrame(frameContext),
            message: '回滚清理新增实体时失败（部分对象可能仍留存）。',
            cause: removeError?.message || String(removeError || 'unknown'),
            entity: entry.key
          });
        }
      }
    }

    const currentSceneId = normalizeLevelId(this.game, scene);
    if (restoreFrame.levelId !== null && restoreFrame.levelId !== currentSceneId) {
      this.game.store?.set?.('currentScene', restoreFrame.levelId);
    }

    const player = readPlayerPosition(this.game);

    this._logFrame({
      level: 'error',
      code: 'RUNTIME_ROLLBACK',
      frame: normalizeFrame(frameContext),
      message: '捕获未处理异常，已回滚到上一帧快照状态。',
      cause: error?.message || String(error || 'unknown'),
      levelId: restoreFrame.levelId,
      player,
      entityCount: (restoreFrame.entities || []).length,
      removedCount: removedCount.length
    });

    this.game.events?.emit?.('runtime:rollback', {
      code: 'RUNTIME_ROLLBACK',
      frame: normalizeFrame(frameContext),
      cause: error?.message || String(error || 'unknown'),
      levelId: restoreFrame.levelId,
      player,
      entities: [...(restoreFrame.entities || [])],
      removedCount
    });

    return {
      recovered: true,
      frame: restoreFrame.frame,
      frameBeforeRollback: restoreFrame.frame,
      restoredLevelId: restoreFrame.levelId,
      restoredEntityCount: (restoreFrame.entities || []).length,
      removedCount
    };
  }

  _checkLeak(frame, { createdCount = 0, destroyedCount = 0, created = [], destroyed = [] }) {
    const hasDestroy = destroyedCount > 0;
    const ratio = hasDestroy ? (createdCount / Math.max(1, destroyedCount)) : (createdCount > 0 ? Number.POSITIVE_INFINITY : 0);
    const shouldWarn = hasDestroy ? ratio > this.leakRatio : createdCount > 0;
    if (!shouldWarn) return;

    this._logFrame({
      level: 'error',
      code: 'RESOURCE_LEAK',
      frame,
      message: `检测到异常高的实体创建/销毁比例（> ${this.leakRatio}:1）。`,
      createdCount,
      destroyedCount,
      leakRatio: hasDestroy ? ratio : null,
      created: created.slice(0, 20),
      destroyed: destroyed.slice(0, 20)
    });
  }

  _logFrame({
    level,
    code,
    frame,
    message,
    createdCount = 0,
    destroyedCount = 0,
    leakRatio = 0,
    cause = null,
    levelId = null,
    player = null,
    entityCount = 0,
    created = [],
    destroyed = [],
    entity = null,
    removedCount = 0
  }) {
    const severity = level === 'error' ? 'error' : 'warn';
    const payload = {
      schema: 'OmniCore.Snapshot/v1',
      code,
      frame,
      message,
      createdCount,
      destroyedCount,
      leakRatio: Number.isFinite(leakRatio) ? leakRatio : null,
      levelId,
      player,
      entityCount,
      created,
      destroyed,
      removedCount,
      entity,
      cause: cause || null,
      timestamp: new Date().toISOString()
    };
    const text = `[OmniCore][Snapshot][${severity.toUpperCase()}][${code}] frame=${frame} ${message}`;
    if (this.logger?.[severity]) {
      this.logger[severity]('RuntimeSnapshot', text, payload);
    } else if (severity === 'error' && typeof console.error === 'function') {
      console.error(text, payload);
    } else if (typeof console.warn === 'function') {
      console.warn(text, payload);
    }
    this.game?.events?.emit?.(`runtime:${severity}`, payload);
  }

  destroy() {
    this.game = null;
    this.logger = null;
    this.frameStart = null;
    this.lastCleanFrame = null;
  }
}

export default Snapshot;
