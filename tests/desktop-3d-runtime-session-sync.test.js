import { describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';

describe('desktop 3D runtime session sync and command windows', () => {
  it('publishes desktop 3D runtime session through sync payload, apply, and command results', async () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, { state: createEditorState() });

    root.querySelector('[data-desktop-command="scene-3d-demo"]').click();
    await Promise.resolve();

    const demoDetail = root.querySelector('[data-desktop-command-window="scene-3d-demo"] [data-desktop-command-window-result-detail]')?.textContent || '';
    expect(demoDetail).toContain('scene3DRuntimeSession');
    expect(demoDetail).toContain('savePatch');
    expect(demoDetail).toContain('exportPlan');

    const syncPayload = app.createRuntimeSyncPayload();
    expect(syncPayload.scene3DRuntimeSession).toMatchObject({
      schema: 'omnicore.editor-scene-3d-runtime-session.v1',
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

    const applied = app.applyRuntimeSyncPayload(syncPayload);
    expect(applied.scene3DRuntimeSession).toMatchObject({
      schema: 'omnicore.editor-scene-3d-runtime-session.v1',
      summary: {
        webgpuPassedCount: 1,
        rapierOverlayCount: 2
      }
    });

    root.querySelector('[data-desktop-command="gltf-import"]').click();
    await Promise.resolve();

    const importDetail = root.querySelector('[data-desktop-command-window="gltf-import"] [data-desktop-command-window-result-detail]')?.textContent || '';
    expect(importDetail).toContain('scene3DRuntimeSession');
    expect(importDetail).toContain('importedAssets');
    expect(importDetail).toContain('assets/hero.glb');

    app.destroy();
  });
});
