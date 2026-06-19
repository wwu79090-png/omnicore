import wasm from '../dist/omnicore_core.wasm';
import { createOmniCoreWorkerRuntime } from '../adapters/cloudflare-worker.js';

const runtimePromise = createOmniCoreWorkerRuntime(wasm);

export default {
  async fetch() {
    const runtime = await runtimePromise;
    const store = runtime.createStore();
    store.setI32(1, 100);
    return new Response(JSON.stringify({
      ok: true,
      version: runtime.version(),
      score: store.getI32(1, 0)
    }), {
      headers: { 'content-type': 'application/json' }
    });
  }
};
