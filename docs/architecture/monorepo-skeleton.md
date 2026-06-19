# OmniCore Monorepo Skeleton

This skeleton keeps the current OmniCore direction split into small workspaces:

| Workspace | Role |
| --- | --- |
| `packages/core` | Scene, entity, and extension host primitives. |
| `packages/physics` | Physics registry plus backend switching boundary. |
| `packages/editor-protocol` | Editor patch protocol and hot edit session boundary. |
| `examples/platformer` | Runnable hello scene demo. |
| `tools/build` | Minimal workspace build manifest generator. |

## Extension Points

### Wasm

`packages/core` exposes `createWasmExtensionSlot()`. Native or generated Wasm systems can attach through this slot so compute-heavy modules are added without changing scene or entity contracts.

### Physics Backend Switching

`packages/physics` exposes `createPhysicsWorld()` with `switchBackend(id)`. The demo starts with `arcade-lite` and switches to `noop`, which is the seam for later Box2D, Rapier, or Wasm physics adapters.

### Editor Hot Edit

`packages/editor-protocol` exposes `createEditorPatch()` and `createHotEditSession()`. The editor can send deterministic patches to a running scene, and runtime code only needs to accept protocol messages instead of depending on the full editor UI.

## Commands

```bash
npm run demo:platformer
npm run build:workspace
```
