# OmniCore Server Runtime Compatibility Report

Date: 2026-06-19

## Scope

This report covers the first server-runtime slice for:

- `packages/omnicore-core-wasm`: Store, EventBus, and ECS C ABI surface.
- Node.js adapter and loading example.
- Cloudflare Worker module example.
- Runtime developer knowledge diagnostics.
- Physics backend switching state migration.
- AI fuzz replay and watermark verification tools.

## Environment

- Node.js: available at `C:\Program Files\nodejs\node.exe`.
- npm: available at `C:\Program Files\nodejs\npm.ps1`.
- GitHub CLI: available at `C:\Program Files\GitHub CLI\gh.exe`.
- `emcc`: not installed in this environment.
- `clang`: not installed in this environment.
- `wasm-ld`: not installed in this environment.
- Git remote: not configured for this workspace.

## WASM Build Result

Command:

```powershell
node packages/omnicore-core-wasm/build.js
```

Result:

```json
{"builder":"generated-minimal-wasm","output":"dist/omnicore_core.wasm","note":"emcc not found; emitted dependency-free ABI-compatible test module"}
```

The generated module is browser-glue-free and can be loaded with `WebAssembly.instantiate` in Node.js and Worker-style runtimes. Production Emscripten output requires installing `emsdk` so the same build script can use:

```powershell
emcc src/omnicore_core.c -O3 -sSTANDALONE_WASM=1 -sALLOW_MEMORY_GROWTH=0 -sEXPORTED_FUNCTIONS=[...] -Wl,--no-entry -o dist/omnicore_core.wasm
```

## Runtime Loading

Node example:

```powershell
node packages/omnicore-core-wasm/examples/node-load.js
```

Result:

```json
{
  "version": 1,
  "score": 9001,
  "entity": 1,
  "position": {
    "x": 5,
    "y": 7.5
  }
}
```

Cloudflare Worker example:

```js
import wasm from '../dist/omnicore_core.wasm';
import { createOmniCoreWorkerRuntime } from '../adapters/cloudflare-worker.js';

const runtimePromise = createOmniCoreWorkerRuntime(wasm);
```

Cloudflare Workers should instantiate imported `.wasm` modules with `WebAssembly.instantiate`; `instantiateStreaming` is not used.

## Tests

Command:

```powershell
npm test -- tests/server-runtime-wasm.test.js tests/knowledge-base-console.test.js tests/physics-backends.test.js tests/ai-fuzz-replay.test.js tests/watermark-verification.test.js
```

Result:

```text
Test Files  5 passed (5)
Tests  10 passed (10)
```

No warnings or console errors were emitted by this focused test run.

Additional runtime smoke checks:

```powershell
node scripts/ai-fuzz-test.js --iterations 3 --seed 7 --model ollama:llama3.2
```

Result:

```json
{"mode":"fuzz","provider":"local-llm","model":"ollama:llama3.2","seed":7,"operations":3,"status":"pass"}
```

Targeted lint also passed for the new WASM, knowledge-base, physics-backend, fuzz, and watermark files:

```powershell
npx eslint -c .eslintrc.json --no-eslintrc packages/omnicore-core-wasm/adapters/node.js packages/omnicore-core-wasm/adapters/cloudflare-worker.js packages/omnicore-core-wasm/src/generated-minimal-wasm.js packages/omnicore-core-wasm/build.js packages/omnicore-core-wasm/examples/node-load.js scripts/lib/crash-replay.js scripts/ai-fuzz-test.js scripts/watermark-build.js scripts/verify-watermark.js scripts/extract-knowledge-from-issues.js src/debug/KnowledgeBaseDiagnostics.js src/debug/ErrorDiagnostics.js src/physics/backends/PhysicsBackend.js src/physics/backends/MatterBackend.js src/physics/backends/RapierBackend.js src/physics/backends/Box2DWasmBackend.js src/physics/backends/index.js
```

## Remaining Production Blockers

- Real Emscripten `.wasm` output is blocked until `emcc` is installed.
- GitHub Issue extraction is blocked until a repository is configured with `--repo owner/name` or a Git remote is added.
- `.knowledge-base/patterns.json` currently ships 100 open seed patterns; run `node scripts/extract-knowledge-from-issues.js --repo owner/name` to replace or augment them with resolved GitHub Issue data.
- Rapier.js and Box2D.wasm adapters are optional wrappers and do not add runtime dependencies. Production use should pass the concrete backend module into `setBackend`.
