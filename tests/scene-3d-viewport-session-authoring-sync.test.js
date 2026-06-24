import { describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';

describe('3D viewport authoring session sync', () => {
  it('keeps model selection, animation preview, and material edits in the runtime session save/export state', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, { state: createEditorState() });

    app.EditorAPI.openScene3DViewport({
      cameras: [{ id: 'game-camera', mode: 'orbit', fov: 65, active: true }],
      lights: [{ id: 'sun', type: 'directional', intensity: 1.25, castShadow: true }],
      materials: [{ id: 'hero-pbr', type: 'pbr', roughness: 0.8, metallic: 0.1 }],
      models: [{ id: 'hero-model', url: 'assets/hero.glb', material: 'hero-pbr', animations: ['Idle', 'Run'], activeAnimation: 'Idle' }]
    });
    app.EditorAPI.selectScene3DModel('hero-model');
    app.EditorAPI.previewScene3DAnimation('hero-model', 'Run');
    app.EditorAPI.updateScene3DMaterial('hero-pbr', { roughness: 0.35, metallic: 0.2, albedo: '#4f8cff' });

    const session = app.getState().scene3DRuntimeSession;
    expect(session).toMatchObject({
      schema: 'omnicore.editor-scene-3d-runtime-session.v1',
      summary: {
        modelCount: 1,
        materialCount: 1,
        selectedModelId: 'hero-model'
      },
      savePatch: {
        schema: 'omnicore.editor-scene-3d-save-patch.v1',
        runtime: {
          selectedModelId: 'hero-model',
          models: [{ id: 'hero-model', activeAnimation: 'Run', selected: true }],
          materials: [{ id: 'hero-pbr', roughness: 0.35, metallic: 0.2, albedo: '#4f8cff' }]
        }
      },
      exportPlan: {
        schema: 'omnicore.editor-scene-3d-export-plan.v1',
        target: 'electron'
      }
    });
    expect(session.trace.map((entry) => entry.type)).toEqual(expect.arrayContaining([
      'open-viewport',
      'select-model',
      'preview-animation',
      'update-material',
      'save-patch',
      'export-plan'
    ]));

    const syncPayload = app.createRuntimeSyncPayload();
    expect(syncPayload.scene3DRuntimeSession.savePatch.runtime.models[0]).toMatchObject({
      id: 'hero-model',
      activeAnimation: 'Run',
      selected: true
    });
    expect(syncPayload.scene3DRuntimeSession.savePatch.runtime.materials[0]).toMatchObject({
      id: 'hero-pbr',
      roughness: 0.35,
      metallic: 0.2
    });

    app.destroy();
  });
});
