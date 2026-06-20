import { toOmniError } from './OmniError.js';

export class OmniCoreErrorBoundary {
  constructor({
    module = 'Runtime',
    events = null,
    logger = null,
    fallback = null,
    recover = null
  } = {}) {
    this.module = module;
    this.events = events;
    this.logger = logger;
    this.defaultFallback = fallback;
    this.recoverHandler = recover;
    this.errors = [];
    this.recoveries = [];
  }

  run(operation, options = {}) {
    try {
      return operation();
    } catch (error) {
      return this.handle(error, options);
    }
  }

  async runAsync(operation, options = {}) {
    try {
      return await operation();
    } catch (error) {
      return this.handle(error, options);
    }
  }

  handle(error, {
    module = this.module,
    phase = 'runtime',
    fallback = this.defaultFallback,
    recover = this.recoverHandler,
    scene = null,
    rethrow = false
  } = {}) {
    const omniError = toOmniError(error, {
      module,
      code: error?.code || 'OMNICORE_RUNTIME_ERROR',
      category: error?.category || phase,
      recoverable: error?.recoverable !== false,
      details: {
        ...(error?.details || {}),
        phase,
        scene: scene?.name || scene || null
      }
    });
    const record = {
      error: omniError,
      module: omniError.module,
      phase,
      category: omniError.category,
      recoverable: omniError.recoverable,
      scene: scene?.name || scene || null,
      at: Date.now()
    };
    this.errors.push(record);
    this.logger?.error?.(module, omniError.message, omniError);
    this.events?.emit?.('runtime:error', record);
    this.events?.emit?.('error', record);

    if (rethrow || omniError.recoverable === false) throw omniError;

    const recovered = recover?.(omniError, record);
    this.recoveries.push({
      ...record,
      recovered: recovered !== undefined,
      fallback: recovered ?? fallback
    });
    this.events?.emit?.('runtime:recover', this.recoveries[this.recoveries.length - 1]);
    return recovered ?? fallback;
  }

  attachScene(scene) {
    if (!scene) return () => {};
    const boundary = this;
    const originalUpdate = scene.update?.bind(scene);
    const originalRender = scene.render?.bind(scene);
    if (originalUpdate) {
      scene.update = function wrappedSceneUpdate(...args) {
        return boundary.run(() => originalUpdate(...args), {
          module: 'Scene',
          phase: 'scene:update',
          scene,
          fallback: scene
        });
      };
    }
    if (originalRender) {
      scene.render = function wrappedSceneRender(...args) {
        return boundary.run(() => originalRender(...args), {
          module: 'Scene',
          phase: 'scene:render',
          scene,
          fallback: scene
        });
      };
    }
    return () => {
      if (originalUpdate) scene.update = originalUpdate;
      if (originalRender) scene.render = originalRender;
    };
  }

  snapshot() {
    return {
      errors: this.errors.map(serializeRecord),
      recoveries: this.recoveries.map(serializeRecord)
    };
  }

  clear() {
    this.errors.length = 0;
    this.recoveries.length = 0;
  }
}

function serializeRecord(record) {
  return {
    module: record.module,
    phase: record.phase,
    category: record.category,
    recoverable: record.recoverable,
    scene: record.scene,
    at: record.at,
    message: record.error?.message || null,
    code: record.error?.code || null
  };
}

export default OmniCoreErrorBoundary;
