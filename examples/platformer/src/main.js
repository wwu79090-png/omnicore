import { pathToFileURL } from 'node:url';
import { createExtensionHost, createHelloScene, createWasmExtensionSlot } from '@omnicore/core';
import { createPhysicsWorld } from '@omnicore/physics';
import { createEditorPatch, createHotEditSession, EDITOR_PROTOCOL_NAME } from '@omnicore/editor-protocol';

export function runPlatformerDemo() {
  const scene = createHelloScene();
  const extensionHost = createExtensionHost();
  const wasmSlot = extensionHost.register(createWasmExtensionSlot());
  const physics = createPhysicsWorld({ backend: 'arcade-lite' });
  const firstStep = physics.step(scene, 1 / 60);
  physics.switchBackend('noop');
  const secondStep = physics.step(scene, 1 / 60);
  const hotEdit = createHotEditSession({ scene });
  const patch = createEditorPatch({
    id: 'hello-title-edit',
    targetId: 'hero',
    set: { label: 'Hello OmniCore' }
  });
  const patchResult = hotEdit.apply(patch);
  return {
    name: 'hello-platformer',
    scene: scene.toJSON(),
    physics: {
      activeBackend: firstStep.backend,
      switchedBackend: secondStep.backend,
      availableBackends: physics.registry.listBackends()
    },
    editor: {
      protocol: EDITOR_PROTOCOL_NAME,
      hotEditApplied: patchResult.applied,
      session: hotEdit.summary()
    },
    wasm: {
      extensionPoint: wasmSlot.id,
      slots: extensionHost.describe()
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify(runPlatformerDemo(), null, 2)}\n`);
}

export default runPlatformerDemo;
