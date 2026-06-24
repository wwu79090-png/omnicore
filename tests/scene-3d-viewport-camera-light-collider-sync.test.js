import { describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';

describe('3D viewport camera, light, and collider authoring sync', () => {
  it('keeps camera, light, shadow, collider, and overlay edits in UI, session, and sync payload', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, { state: createEditorState() });

    app.EditorAPI.openScene3DViewport({
      cameras: [
        { id: 'game-camera', mode: 'orbit', fov: 60, active: true, position: { x: 0, y: 3, z: 6 }, target: { x: 0, y: 1, z: 0 } },
        { id: 'debug-camera', mode: 'free', fov: 70, active: false, position: { x: 8, y: 6, z: 8 } }
      ],
      lights: [{ id: 'sun', type: 'directional', intensity: 1, color: '#ffffff', position: { x: 2, y: 4, z: 3 }, castShadow: false }],
      materials: [{ id: 'hero-pbr', type: 'pbr' }],
      models: [{ id: 'hero-model', url: 'assets/hero.glb', material: 'hero-pbr', animations: ['Idle'] }]
    });

    const camera = app.EditorAPI.updateScene3DCamera('game-camera', {
      fov: 48,
      mode: 'free',
      position: { x: 2, y: 4, z: 8 },
      target: { x: 0, y: 1, z: 0 }
    });
    expect(camera).toMatchObject({
      id: 'game-camera',
      mode: 'free',
      fov: 48,
      position: { x: 2, y: 4, z: 8 },
      target: { x: 0, y: 1, z: 0 }
    });

    const activeCamera = app.EditorAPI.setScene3DActiveCamera('debug-camera');
    expect(activeCamera).toMatchObject({ id: 'debug-camera', active: true });
    expect(app.getState().scene3DViewport.cameras.find((item) => item.id === 'game-camera')?.active).toBe(false);

    const light = app.EditorAPI.updateScene3DLight('sun', {
      intensity: 2.25,
      color: '#ffeeaa',
      position: { x: 3, y: 5, z: 2 }
    });
    expect(light).toMatchObject({
      id: 'sun',
      intensity: 2.25,
      color: '#ffeeaa',
      position: { x: 3, y: 5, z: 2 }
    });
    const shadowLight = app.EditorAPI.toggleScene3DLightShadow('sun', true);
    expect(shadowLight).toMatchObject({ id: 'sun', castShadow: true });

    const collider = app.EditorAPI.updateScene3DModelCollider('hero-model', {
      shape: 'capsule',
      radius: 0.45,
      height: 1.8,
      sensor: true,
      debug: true
    });
    expect(collider).toMatchObject({
      modelId: 'hero-model',
      shape: 'capsule',
      radius: 0.45,
      height: 1.8,
      sensor: true,
      debug: true
    });
    const overlays = app.EditorAPI.toggleScene3DColliderOverlay(true);
    expect(overlays).toMatchObject({ colliders: true });

    expect(root.querySelector('[data-scene-3d-camera="game-camera"]')?.textContent).toContain('position 2, 4, 8');
    expect(root.querySelector('[data-scene-3d-camera="debug-camera"]')?.textContent).toContain('active true');
    expect(root.querySelector('[data-scene-3d-light="sun"]')?.textContent).toContain('#ffeeaa');
    expect(root.querySelector('[data-scene-3d-light="sun"]')?.textContent).toContain('shadow true');
    expect(root.querySelector('[data-scene-3d-collider="hero-model"]')?.textContent).toContain('capsule');
    expect(root.querySelector('[data-scene-3d-collider="hero-model"]')?.textContent).toContain('sensor true');

    const session = app.getState().scene3DRuntimeSession;
    expect(session.savePatch.runtime.cameras.find((item) => item.id === 'game-camera')).toMatchObject({
      fov: 48,
      mode: 'free',
      position: { x: 2, y: 4, z: 8 }
    });
    expect(session.savePatch.runtime.lights[0]).toMatchObject({
      id: 'sun',
      intensity: 2.25,
      color: '#ffeeaa',
      castShadow: true
    });
    expect(session.savePatch.runtime.models[0].collider).toMatchObject({
      shape: 'capsule',
      sensor: true,
      debug: true
    });
    expect(session.savePatch.runtime.colliders[0]).toMatchObject({
      modelId: 'hero-model',
      shape: 'capsule',
      sensor: true
    });
    expect(session.trace.map((entry) => entry.type)).toEqual(expect.arrayContaining([
      'update-camera',
      'set-active-camera',
      'update-light',
      'toggle-light-shadow',
      'update-collider',
      'toggle-collider-overlay',
      'save-patch',
      'export-plan'
    ]));

    const syncPayload = app.createRuntimeSyncPayload();
    expect(syncPayload.scene3DViewport.overlays.colliders).toBe(true);
    expect(syncPayload.scene3DRuntimeSession.savePatch.runtime.colliders[0]).toMatchObject({
      modelId: 'hero-model',
      shape: 'capsule',
      radius: 0.45
    });

    app.destroy();
  });
});
