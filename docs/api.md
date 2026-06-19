# OmniCore API Reference

Generated: 2026-06-19T19:02:16.228Z

## 高频 API

- Kernel.use - 9 calls, avg 1.00 ms
- Renderer.drawRect - 4 calls, avg 2.00 ms

## src/core/Bootstrap.js

### normalizeConfig

@param {Partial<typeof DEFAULT_GAME_CONFIG>} config Runtime overrides.
@returns {typeof DEFAULT_GAME_CONFIG & Record<string, *>} Normalized runtime config.
/

### hasDocument

@returns {boolean} Whether a browser-like document is available.
/

### resolveContainer

@param {string|Element|null} container CSS selector or DOM element.
@returns {Element|null} Resolved container or null outside the DOM.
/

### createCanvas

@param {number} width Canvas width in pixels.
@param {number} height Canvas height in pixels.
@param {HTMLCanvasElement|null} providedCanvas Existing canvas to reuse.
@returns {HTMLCanvasElement|{style: object}} Prepared canvas-like object.
/

### removeContainerCanvases

@param {Element|null} container Container that may hold runtime canvases.
@returns {void}
/

### createNoopCanvasContext

@returns {CanvasRenderingContext2D|Record<string, Function>} No-op canvas 2D context.
/

### detectEnvironment

@param {typeof globalThis|Record<string, *>} env Runtime global object.
@returns {{platform: string, runtime: string, isMiniGame: boolean, isWechat: boolean, isDouyin: boolean, isElectron: boolean, isWeb: boolean, fetcher: Function|undefined, request: Function|null, skipThree: boolean, skipPixiViewport: boolean, supportsWebGL: boolean, raw: object}} Environment descriptor.
/

### safeInitialize

@param {string} name Module name used in logs.
@param {Function} initializer Initialization callback.
@param {*|Function} fallback Fallback value or callback invoked with the error.
@param {object|null} logger Logger-like object.
@returns {*} Initializer result or fallback result.
/

## src/core/EventBus.js

### on

/**
   * @param {string} event Event name.
   * @param {Function} handler Event handler.
   * @returns {Function} Unsubscribe callback.

### once

/**
   * @param {string} event Event name.
   * @param {Function} handler Event handler invoked once.
   * @returns {Function} Unsubscribe callback.

### off

/**
   * @param {string} event Event name.
   * @param {Function} handler Event handler to remove.
   * @returns {void}

### emit

/**
   * @param {string} event Event name.
   * @param {*} payload Event payload.
   * @returns {void}

### queueEvent

/**
   * @param {string} event Event name.
   * @param {*} payload Event payload.
   * @returns {number} Number of queued events.

### processEventFrame

/**
   * @returns {number} Number of queued events processed this frame.

### pendingEventCount

/**
   * @returns {number} Number of timestamped events waiting for frame processing.

### flushMicrobatches

/**
   * @param {number} limit Maximum queued events to flush.
   * @returns {number} Number of queued events flushed.

### pendingMicrobatchCount

/**
   * @returns {number} Number of events deferred into the microbatch queue.

### resetFrameBudget

/**
   * @returns {void}

### getRecursionDiagnostics

/**
   * @returns {object} Last recursion or cycle diagnostic.

### clear

/**
   * @returns {void}

## src/store/Store.js

### atom

/**
   * @param {string} key State key.
   * @param {*} initialValue Initial value used when creating a store.
   * @returns {{get: Function, set: Function, subscribe: Function}} Nano store atom.

### set

/**
   * @param {string} key State key.
   * @param {*} value Next value.
   * @returns {*} Stored value after emergency patching.
   *
   * @deprecated since 0.3.0, removeIn 2.0.0. Use `store.setValue(key, value)`.
   * @replacement Store#setValue
   * @removeIn 2.0.0

### setValue

/**
   * @param {string} key State key.
   * @param {*} value Next value.
   * @returns {*} Stored value after emergency patching.

### derive

/**
   * Defines a state value derived from other Store keys.
   *
   * @param {string} name Derived state key.
   * @param {string[]} deps Dependency keys.
   * @param {Function} computeFn Function receiving ({ depName: value }, store).
   * @returns {Function} Dispose function that removes the derived definition.

### underive

/**
   * Removes a derived value definition.
   *
   * @param {string} name Derived state key.
   * @returns {boolean} True when a derived definition was removed.

### use

/**
   * Register a Store middleware.
   *
   * @param {Function} middleware Interceptor receiving { key, value, previous, store }.
   * @returns {Function} Unsubscribe function that removes the middleware.

### get

/**
   * @param {string} key State key.
   * @returns {*} Current value.

### subscribe

/**
   * @param {string} key State key.
   * @param {Function} listener Subscription callback.
   * @returns {Function} Unsubscribe callback.

### injectBackend

/**
   * @param {string} backend Active renderer backend.
   * @returns {void}

### snapshot

/**
   * @returns {Record<string, *>} Plain state snapshot.

### configurePluginMarket

/**
   * @param {object} options Plugin market options.
   * @returns {{cdn: string, fetcher: Function, moduleLoader: Function, installed: Map}} Plugin market config.

### getPlugin

/**
   * @param {string} name Plugin name.
   * @returns {object|null} Installed plugin record or null.

### registerPlugin

/**
   * @param {string} name Plugin name.
   * @param {Record<string, *>} exports Plugin exports.
   * @param {Record<string, *>} manifest Plugin manifest.
   * @returns {object} Installed plugin record.

## src/microkernel/RendererAdapter.js

### init

/**
   * @param {Record<string, *>} context Runtime renderer context.
   * @returns {Promise<object>} Active renderer backend.

### destroy

/**
   * @returns {void}

### drawRect

/**
   * @param {Record<string, *>} options Rectangle draw options.
   * @returns {*} Backend draw result.

### drawText

/**
   * @param {Record<string, *>} options Text draw options.
   * @returns {*} Backend draw result.

## src/microkernel/Kernel.js

### addon

/**
   * @param {string} name Addon name.
   * @param {object} instance Addon instance.
   * @returns {Kernel} This kernel.

### use

/**
   * @param {string} name Addon name.
   * @param {Record<string, *>} options Addon init options.
   * @returns {object} Activated addon.

### has

/**
   * @param {string} name Addon name.
   * @returns {boolean} Whether the addon is registered.

### set

/**
   * @param {string} key State key.
   * @param {*} value State value.
   * @returns {*} Stored value.

### get

/**
   * @param {string} key State key.
   * @returns {*} Stored value.

### snapshot

/**
   * @returns {Record<string, *>} Plain state snapshot.

### updateEntity

/**
   * @param {string} id Entity id.
   * @param {Record<string, *>} patch Entity patch.
   * @returns {Record<string, *>} Updated entity state.

### markDirty

/**
   * @param {string} key Dirty state key.
   * @param {*} value Dirty value.
   * @returns {void}

### attachRenderer

/**
   * @param {object} renderer Renderer-like object.
   * @returns {Kernel} This kernel.

### detachRenderer

/**
   * @param {object} renderer Renderer-like object.
   * @returns {Kernel} This kernel.

### recordDrawInstruction

/**
   * @param {number} count Draw instruction count to add.
   * @returns {void}

### destroy

/**
   * @returns {Promise<void>} Resolves after active addons are destroyed.

