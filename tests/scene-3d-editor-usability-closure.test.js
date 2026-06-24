import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';

describe('3D editor usability closure', () => {
  it('syncs inspector, undo redo, hierarchy, GLTF import, Rapier, animation, and EXE E2E authoring state', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, { state: createEditorState() });

    app.EditorAPI.openScene3DViewport({
      cameras: [{ id: 'game-camera', mode: 'orbit', fov: 60, active: true }],
      lights: [{ id: 'sun', type: 'directional', intensity: 1, castShadow: true }],
      materials: [{ id: 'hero-pbr', type: 'pbr', roughness: 0.6 }],
      models: [{ id: 'hero-model', url: 'assets/hero.glb', material: 'hero-pbr', animations: ['Idle', 'Run'], activeAnimation: 'Idle' }]
    });

    const inspector = app.EditorAPI.configureScene3DInspector('hero-model', {
      component: 'Transform',
      fields: {
        position: { editor: 'vector3', step: 0.1 },
        visible: { editor: 'toggle' },
        roughness: { editor: 'slider', min: 0, max: 1 }
      },
      batchSelection: ['hero-model', 'crate-model'],
      clipboard: { component: 'Transform', values: { position: { x: 1, y: 2, z: 3 } } }
    });
    expect(inspector).toMatchObject({
      selectedNodeId: 'hero-model',
      component: 'Transform',
      gizmo: { mode: 'translate', space: 'local', snap: { enabled: true, translate: 0.5 } }
    });
    expect(app.EditorAPI.setScene3DGizmo({ mode: 'rotate', space: 'global', snap: { enabled: true, rotate: 15 } })).toMatchObject({
      mode: 'rotate',
      space: 'global',
      snap: { rotate: 15 }
    });
    expect(app.EditorAPI.pasteScene3DComponent('crate-model')).toMatchObject({
      nodeId: 'crate-model',
      component: 'Transform'
    });
    expect(app.EditorAPI.resetScene3DInspectorField('hero-model', 'roughness')).toMatchObject({
      field: 'roughness',
      reset: true
    });

    app.EditorAPI.moveScene3DModel('hero-model', { x: 3, y: 0, z: 1 });
    expect(app.EditorAPI.undoScene3DAction()).toMatchObject({ action: 'undo', canRedo: true });
    expect(app.getState().scene3DViewport.models.find((model) => model.id === 'hero-model')?.position).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(app.EditorAPI.redoScene3DAction()).toMatchObject({ action: 'redo', canUndo: true });
    expect(app.getState().scene3DViewport.models.find((model) => model.id === 'hero-model')?.position).toMatchObject({ x: 3, y: 0, z: 1 });

    app.EditorAPI.createScene3DNode({ id: 'crate-model', type: 'Mesh', parentId: 'hero-model', locked: false, visible: true });
    app.EditorAPI.renameScene3DNode('crate-model', 'Crate');
    app.EditorAPI.duplicateScene3DNode('crate-model', { id: 'crate-copy' });
    app.EditorAPI.groupScene3DNodes(['hero-model', 'crate-copy'], { id: 'group-gameplay', name: 'Gameplay' });
    app.EditorAPI.toggleScene3DNodeVisibility('crate-copy', false);
    app.EditorAPI.lockScene3DNode('crate-copy', true);
    const hierarchy = app.EditorAPI.selectScene3DNodes(['hero-model', 'crate-copy']);
    expect(hierarchy.selectedNodeIds).toEqual(['hero-model', 'crate-copy']);
    expect(hierarchy.nodes.find((node) => node.id === 'crate-copy')).toMatchObject({ visible: false, locked: true });

    const gltf = app.EditorAPI.importScene3DGLTFAsset({
      name: 'boss.glb',
      path: 'assets/boss.glb',
      byteLength: 8192,
      missingTextures: ['boss_albedo.png'],
      clips: ['Idle', 'Attack']
    });
    expect(gltf).toMatchObject({
      resourceRecord: { path: 'assets/boss.glb', type: 'model' },
      inspection: { missingTextureCount: 1, animationClipCount: 2 },
      sceneInsertion: { modelId: 'boss' }
    });
    expect(gltf.repairActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'relinkTexture' }),
      expect.objectContaining({ type: 'generateCollider' }),
      expect.objectContaining({ type: 'generateLOD' }),
      expect.objectContaining({ type: 'enableCompression' })
    ]));

    const rapier = app.EditorAPI.configureScene3DRapierBody('hero-model', {
      bodyType: 'dynamic',
      mass: 2,
      linearDamping: 0.4,
      collisionLayer: 'player',
      sensor: true,
      joint: { type: 'fixed', target: 'crate-copy' },
      debugDraw: true,
      simulation: 'step'
    });
    expect(rapier).toMatchObject({
      modelId: 'hero-model',
      bodyType: 'dynamic',
      mass: 2,
      joint: { type: 'fixed' },
      debugDraw: true
    });

    const animation = app.EditorAPI.configureScene3DAnimation('hero-model', {
      clip: 'Run',
      playing: true,
      speed: 1.25,
      loop: true,
      events: [{ frame: 12, name: 'footstep' }],
      stateMachine: {
        states: { idle: { clip: 'Idle' }, run: { clip: 'Run' } },
        transitions: [{ from: 'idle', to: 'run', when: 'speed > 0.1' }]
      },
      blendTree: { parameter: 'speed', clips: ['Idle', 'Run'] }
    });
    expect(animation).toMatchObject({
      modelId: 'hero-model',
      clip: 'Run',
      playing: true,
      stateMachine: { transitions: [{ to: 'run' }] }
    });

    const e2e = app.EditorAPI.createScene3DExeE2EPlan();
    expect(e2e.steps.map((step) => step.id)).toEqual([
      'launch-exe',
      'create-3d-project',
      'import-glb',
      'edit-transform-light-collider',
      'save-reopen',
      'export-project'
    ]);

    const panelText = root.querySelector('[data-panel="scene-3d-viewport"]')?.textContent || '';
    expect(panelText).toContain('Inspector Transform');
    expect(panelText).toMatch(/Undo \d+ \/ Redo 0/u);
    expect(panelText).toContain('Hierarchy 4 nodes');
    expect(panelText).toContain('GLTF boss.glb');
    expect(panelText).toContain('Rapier dynamic');
    expect(panelText).toContain('Animation Run');
    expect(panelText).toContain('EXE E2E 6 steps');

    const session = app.getState().scene3DRuntimeSession;
    expect(session.savePatch.runtime.inspector.selectedNodeId).toBe('hero-model');
    expect(session.savePatch.runtime.hierarchy.nodes.find((node) => node.id === 'crate-copy')).toMatchObject({ visible: false, locked: true });
    expect(session.savePatch.runtime.gltfImport.resourceRecord.path).toBe('assets/boss.glb');
    expect(session.savePatch.runtime.rapierPhysics.bodies[0]).toMatchObject({ modelId: 'hero-model', bodyType: 'dynamic' });
    expect(session.savePatch.runtime.animationAuthoring.clips[0]).toMatchObject({ modelId: 'hero-model', clip: 'Run' });
    expect(session.savePatch.runtime.exeE2E.steps).toHaveLength(6);
    expect(session.trace.map((entry) => entry.type)).toEqual(expect.arrayContaining([
      'configure-inspector',
      'undo-action',
      'redo-action',
      'create-node',
      'import-gltf',
      'configure-rapier',
      'configure-animation',
      'create-exe-e2e-plan'
    ]));

    const syncPayload = app.createRuntimeSyncPayload();
    expect(syncPayload.scene3DViewport.hierarchy.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(['hero-model', 'crate-copy', 'group-gameplay']));
    expect(syncPayload.scene3DRuntimeSession.savePatch.runtime.exeE2E.steps.at(-1).id).toBe('export-project');

    const e2eSpec = readFileSync('tests/e2e/electron-3d-editor-contract.spec.js', 'utf8');
    expect(e2eSpec).toContain('create-3d-project');
    expect(e2eSpec).toContain('save-reopen');
    expect(e2eSpec).toContain('edit-transform-light-collider');

    app.destroy();
  });
});
