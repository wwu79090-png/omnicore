import scene from '../scene.omnicore.json' assert { type: 'json' };
import {
  Runtime3DScene,
  createRapierDebugDrawVisualization,
  importGLBFile
} from 'omnicore/src/index.js';

export function createPlayable3DTemplateRuntime(options = {}) {
  const runtimeScene = new Runtime3DScene({
    name: scene.name,
    background: options.background || '#101820'
  });

  for (const camera of scene.runtime.cameras) runtimeScene.addCamera(camera);
  for (const light of scene.runtime.lights) runtimeScene.addLight(light);
  for (const material of scene.runtime.materials) runtimeScene.addPBRMaterial(material.id, material);
  for (const model of scene.runtime.models) runtimeScene.addGLTFModel(model);

  const controller = createThirdPersonCharacterController(scene.runtime.player);
  const rapier = createRapierRuntimeDescriptor(scene.runtime.physics);
  const pickups = scene.runtime.pickups.map((pickup) => ({ ...pickup, collected: false }));
  const debugDraw = createRapierDebugDrawVisualization({
    colliders: [
      {
        id: scene.runtime.physics.ground.id,
        shape: scene.runtime.physics.ground.shape,
        sensor: false,
        position: scene.runtime.physics.ground.position,
        size: scene.runtime.physics.ground.size
      },
      ...pickups.map((pickup) => ({
        id: `${pickup.id}-sensor`,
        shape: pickup.collider.shape,
        sensor: true,
        position: pickup.position,
        size: { x: pickup.collider.radius * 2, y: pickup.collider.radius * 2, z: pickup.collider.radius * 2 }
      }))
    ],
    raycasts: [{ id: 'camera-pick-ray', hit: false, origin: scene.runtime.cameras[0].position, point: scene.runtime.cameras[0].target }]
  });

  return {
    schema: 'omnicore.template-3d-playable-runtime.v1',
    controller: 'third-person-character',
    scene: runtimeScene.createRuntimeSnapshot(),
    player: {
      ...scene.runtime.player,
      state: controller.createState()
    },
    Rapier: rapier,
    pickups,
    debugDraw,
    export: scene.export
  };
}

export function createThirdPersonCharacterController(player = scene.runtime.player) {
  return {
    id: player.id || 'player',
    type: 'third-person-character',
    camera: player.camera,
    speed: player.speed || 4.5,
    jumpImpulse: player.jumpImpulse || 5,
    animations: player.animations || {},
    createState() {
      return {
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        grounded: true,
        activeAnimation: this.animations.idle || 'Idle'
      };
    },
    resolveAnimation(input = {}) {
      if (input.jump) return this.animations.jump || 'Jump';
      if (input.moveX || input.moveZ) return this.animations.move || 'Run';
      return this.animations.idle || 'Idle';
    }
  };
}

export function createRapierRuntimeDescriptor(physics = scene.runtime.physics) {
  return {
    backend: physics.backend,
    gravity: physics.gravity,
    ground: physics.ground,
    debugDraw: Boolean(physics.debugDraw),
    note: 'Rapier backend is used for ground collision, player capsule, pickup sensors, raycast picking, and debug visualization.'
  };
}

export async function importTemplateGLB(file) {
  return importGLBFile({ file }, {
    targetSceneId: scene.name,
    physicsBackend: scene.runtime.physics.backend
  });
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('#app') || document.body;
  const runtime = createPlayable3DTemplateRuntime();
  root.innerHTML = `
    <main>
      <h1>${scene.name}</h1>
      <p>third-person-character / Rapier / ${runtime.export.targets.join(', ')}</p>
      <pre>${JSON.stringify(runtime.scene.summary, null, 2)}</pre>
    </main>
  `;
}

export default createPlayable3DTemplateRuntime;
