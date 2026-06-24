import { describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';

describe('3D viewport model transform sync', () => {
  it('keeps moved, rotated, scaled, and reset transforms in viewport UI, runtime session, and sync payload', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, { state: createEditorState() });

    app.EditorAPI.openScene3DViewport({
      materials: [{ id: 'hero-pbr', type: 'pbr', roughness: 0.6 }],
      models: [{
        id: 'hero-model',
        url: 'assets/hero.glb',
        material: 'hero-pbr',
        animations: ['Idle'],
        position: { x: 0, y: 0, z: 0 }
      }]
    });

    const dragged = app.EditorAPI.dragScene3DModel('hero-model', { x: 1.5, y: 0, z: -2 });
    expect(dragged).toMatchObject({
      id: 'hero-model',
      selected: true,
      position: { x: 1.5, y: 0, z: -2 }
    });

    const moved = app.EditorAPI.moveScene3DModel('hero-model', { x: 4, y: 1, z: 2 });
    expect(moved).toMatchObject({
      id: 'hero-model',
      selected: true,
      position: { x: 4, y: 1, z: 2 }
    });

    const rotated = app.EditorAPI.rotateScene3DModel('hero-model', { x: 0, y: 90, z: 0 });
    expect(rotated).toMatchObject({
      id: 'hero-model',
      selected: true,
      rotation: { x: 0, y: 90, z: 0 }
    });

    const scaled = app.EditorAPI.scaleScene3DModel('hero-model', { x: 1.5, y: 2, z: 1.25 });
    expect(scaled).toMatchObject({
      id: 'hero-model',
      selected: true,
      scale: { x: 1.5, y: 2, z: 1.25 }
    });

    expect(root.querySelector('[data-scene-3d-model="hero-model"]')?.textContent).toContain('position 4, 1, 2');
    expect(root.querySelector('[data-scene-3d-model="hero-model"]')?.textContent).toContain('rotation 0, 90, 0');
    expect(root.querySelector('[data-scene-3d-model="hero-model"]')?.textContent).toContain('scale 1.5, 2, 1.25');

    const session = app.getState().scene3DRuntimeSession;
    expect(session.savePatch.runtime.models[0]).toMatchObject({
      id: 'hero-model',
      selected: true,
      position: { x: 4, y: 1, z: 2 },
      rotation: { x: 0, y: 90, z: 0 },
      scale: { x: 1.5, y: 2, z: 1.25 }
    });
    expect(session.trace.map((entry) => entry.type)).toEqual(expect.arrayContaining([
      'open-viewport',
      'drag-model',
      'move-model',
      'rotate-model',
      'scale-model',
      'save-patch',
      'export-plan'
    ]));

    const syncPayload = app.createRuntimeSyncPayload();
    expect(syncPayload.scene3DViewport.models[0]).toMatchObject({
      id: 'hero-model',
      position: { x: 4, y: 1, z: 2 },
      rotation: { x: 0, y: 90, z: 0 },
      scale: { x: 1.5, y: 2, z: 1.25 }
    });
    expect(syncPayload.scene3DRuntimeSession.savePatch.runtime.models[0]).toMatchObject({
      id: 'hero-model',
      position: { x: 4, y: 1, z: 2 },
      rotation: { x: 0, y: 90, z: 0 },
      scale: { x: 1.5, y: 2, z: 1.25 }
    });

    const reset = app.EditorAPI.resetScene3DModelTransform('hero-model');
    expect(reset).toMatchObject({
      id: 'hero-model',
      selected: true,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
    expect(app.getState().scene3DRuntimeSession.savePatch.runtime.models[0]).toMatchObject({
      id: 'hero-model',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });

    app.destroy();
  });
});
