import { readFile } from 'node:fs/promises';
import { OMNICORE_CORE_WASM_BYTES } from '../src/generated-minimal-wasm.js';

export async function createOmniCoreWasm({ bytes = null, path = null, importObject = {} } = {}) {
  const wasmBytes = bytes || (path ? await readFile(path) : OMNICORE_CORE_WASM_BYTES);
  const result = await WebAssembly.instantiate(wasmBytes, importObject);
  const instance = result.instance || result;
  return createRuntime(instance);
}

export function createRuntime(instance) {
  const { exports } = instance;
  assertExports(exports);

  return {
    instance,
    exports,
    version: () => exports.omni_version(),
    createStore() {
      const id = exports.omni_store_create();
      assertHandle(id, 'Store');
      return {
        id,
        setI32(key, value) {
          return exports.omni_store_set_i32(id, key, value) === 1;
        },
        getI32(key, fallback = 0) {
          return exports.omni_store_get_i32(id, key, fallback);
        },
        has(key) {
          return exports.omni_store_has(id, key) === 1;
        }
      };
    },
    createEventBus() {
      const id = exports.omni_eventbus_create();
      assertHandle(id, 'EventBus');
      return {
        id,
        emit(event, payload = 0) {
          return exports.omni_eventbus_emit(id, event, payload);
        },
        pending() {
          return exports.omni_eventbus_pending(id);
        },
        drain() {
          return exports.omni_eventbus_drain(id);
        },
        last() {
          return {
            event: exports.omni_eventbus_last_event(id),
            payload: exports.omni_eventbus_last_payload(id)
          };
        }
      };
    },
    createWorld({ capacity = 1024 } = {}) {
      const id = exports.omni_ecs_create(capacity);
      assertHandle(id, 'ECS world');
      return {
        id,
        createEntity() {
          const entity = exports.omni_ecs_create_entity(id);
          assertHandle(entity, 'ECS entity');
          return entity;
        },
        destroyEntity(entity) {
          return exports.omni_ecs_destroy_entity(id, entity) === 1;
        },
        isAlive(entity) {
          return exports.omni_ecs_is_alive(id, entity) === 1;
        },
        addPosition(entity, x, y) {
          return exports.omni_ecs_add_position(id, entity, x, y) === 1;
        },
        addVelocity(entity, x, y) {
          return exports.omni_ecs_add_velocity(id, entity, x, y) === 1;
        },
        stepMovement(delta) {
          return exports.omni_ecs_step_movement(id, delta) === 1;
        },
        position(entity) {
          return {
            x: normalizeFloat(exports.omni_ecs_get_position_x(id, entity)),
            y: normalizeFloat(exports.omni_ecs_get_position_y(id, entity))
          };
        }
      };
    }
  };
}

function assertExports(exports) {
  for (const name of [
    'omni_version',
    'omni_store_create',
    'omni_store_set_i32',
    'omni_store_get_i32',
    'omni_store_has',
    'omni_eventbus_create',
    'omni_eventbus_emit',
    'omni_eventbus_pending',
    'omni_eventbus_drain',
    'omni_eventbus_last_event',
    'omni_eventbus_last_payload',
    'omni_ecs_create',
    'omni_ecs_create_entity',
    'omni_ecs_destroy_entity',
    'omni_ecs_is_alive',
    'omni_ecs_add_position',
    'omni_ecs_add_velocity',
    'omni_ecs_get_position_x',
    'omni_ecs_get_position_y',
    'omni_ecs_step_movement'
  ]) {
    if (typeof exports[name] !== 'function') {
      throw new Error(`OmniCore WASM export missing: ${name}`);
    }
  }
}

function assertHandle(value, label) {
  if (!value) throw new Error(`Unable to allocate ${label} in OmniCore WASM runtime.`);
}

function normalizeFloat(value) {
  return Number(Number(value).toFixed(6));
}

export default createOmniCoreWasm;
