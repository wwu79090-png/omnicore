import { describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';

describe('desktop 3D runtime session integration', () => {
  it('creates save/export-ready runtime session state from desktop 3D and GLB commands', async () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, { state: createEditorState() });

    root.querySelector('[data-desktop-command="scene-3d-demo"]').click();
    await Promise.resolve();
    const demoSession = app.getState().scene3DRuntimeSession;

    expect(demoSession).toMatchObject({
      schema: 'omnicore.editor-scene-3d-runtime-session.v1',
      summary: {
        mounted: false,
        rapierOverlayCount: 2,
        webgpuPassedCount: 1
      },
      savePatch: {
        schema: 'omnicore.editor-scene-3d-save-patch.v1',
        runtime: {
          selectedModelId: 'hero'
        }
      },
      exportPlan: {
        schema: 'omnicore.editor-scene-3d-export-plan.v1',
        target: 'electron'
      }
    });
    expect(demoSession.exportPlan.steps.map((step) => step.id)).toEqual([
      'write-scene',
      'bundle-assets',
      'include-rapier-debug',
      'include-webgpu-report',
      'package-electron'
    ]);
    expect(demoSession.trace.map((entry) => entry.type)).toEqual(expect.arrayContaining([
      'desktop-session-created',
      'rapier-debug-draw',
      'webgpu-hardware',
      'save-patch',
      'export-plan'
    ]));

    root.querySelector('[data-desktop-command="gltf-import"]').click();
    await Promise.resolve();
    const importSession = app.getState().scene3DRuntimeSession;

    expect(importSession.summary.importedAssetCount).toBe(1);
    expect(importSession.importedAssets[0]).toMatchObject({ id: 'hero', path: 'assets/hero.glb', type: 'model' });
    expect(importSession.savePatch.runtime.importedAssets[0]).toMatchObject({ id: 'hero', path: 'assets/hero.glb' });
    expect(importSession.trace.map((entry) => entry.type)).toEqual(expect.arrayContaining([
      'import-glb',
      'save-patch',
      'export-plan'
    ]));

    app.destroy();
  });
});
