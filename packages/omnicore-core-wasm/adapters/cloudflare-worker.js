import { createRuntime } from './node.js';

export async function createOmniCoreWorkerRuntime(wasmModuleOrBytes, importObject = {}) {
  const result = await WebAssembly.instantiate(wasmModuleOrBytes, importObject);
  return createRuntime(result.instance || result);
}

export function createFetchHandler(runtimePromise) {
  return {
    async fetch() {
      const runtime = await runtimePromise;
      const store = runtime.createStore();
      store.setI32(1, 200);
      return new Response(JSON.stringify({
        ok: true,
        version: runtime.version(),
        score: store.getI32(1, 0)
      }), {
        headers: { 'content-type': 'application/json' }
      });
    }
  };
}

export default createOmniCoreWorkerRuntime;
