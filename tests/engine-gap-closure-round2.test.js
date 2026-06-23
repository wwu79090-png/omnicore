import { afterEach, describe, expect, it } from 'vitest';
import { createEditorApp } from 'omnicore-editor/src/editor-app.js';
import { createEditorState } from 'omnicore-editor/src/live-sync-protocol.js';
import OmniCore, {
  ApiSurfaceFocusLens,
  PhysicsWorld,
  Scene3DKit,
  createWebGPUFrameBudgetReport,
  createWebGPUResourceLifecyclePlan
} from '../src/index.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('engine gap closure round 2', () => {
  it('adds a full 3D scene kit with camera, lights, PBR material, GLTF animation, postprocess, and asset validation', () => {
    const scene = new Scene3DKit({ name: 'hangar', width: 1280, height: 720 });
    const camera = scene.setCamera({
      id: 'gameplay',
      mode: 'free',
      controls: ['orbit', 'pointer-lock'],
      fov: 70,
      position: { x: 1, y: 2, z: 6 }
    });
    const light = scene.addLight('sun', {
      type: 'directional',
      intensity: 2,
      castShadow: true,
      shadow: { mapSize: 2048 }
    });
    const material = scene.addMaterial('hero-pbr', {
      type: 'pbr',
      baseColor: '#dbeafe',
      metallic: 0.2,
      roughness: 0.45,
      normalMap: 'assets/hero_n.png'
    });
    const model = scene.addGLTFModel({
      id: 'hero',
      url: 'models/hero.glb',
      material: 'hero-pbr',
      animations: ['Idle', 'Run'],
      animation: 'Idle',
      rigidBody: { type: 'dynamic', mass: 1 },
      collider: { shape: 'capsule', radius: 0.4, height: 1.8 }
    });
    scene.addPostProcess({ id: 'bloom', type: 'bloom', budgetMs: 1.2 });

    const validation = scene.validateAssets({
      availableAssets: ['models/hero.glb', 'assets/hero_n.png']
    });
    const demo = scene.createDebugDemo();

    expect(scene.capabilities).toEqual(expect.arrayContaining([
      'full-3d-scene',
      'free-camera',
      'shadow-map',
      'pbr-material',
      'gltf-animation',
      'postprocessing',
      'physics-binding'
    ]));
    expect(camera).toMatchObject({ id: 'gameplay', mode: 'free', fov: 70 });
    expect(light.shadow.mapSize).toBe(2048);
    expect(material.workflow).toBe('metallic-roughness');
    expect(model.physics.collider.shape).toBe('capsule');
    expect(validation).toMatchObject({
      ok: true,
      missingAssets: [],
      modelCount: 1,
      pbrMaterialCount: 1
    });
    expect(demo.debugDraw).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'camera-frustum', id: 'gameplay' }),
      expect.objectContaining({ type: 'collider', id: 'hero', shape: 'capsule' })
    ]));
    expect(OmniCore.Scene3DKit).toBe(Scene3DKit);
  });

  it('creates a 3D scene readiness report with budget gates and guided fixes', () => {
    const scene = new Scene3DKit({ name: 'boss-room', width: 1920, height: 1080 });
    scene.setCamera({ id: 'gameplay', mode: 'free', controls: ['orbit'] });
    scene.addLight('key', {
      type: 'directional',
      intensity: 4,
      castShadow: true,
      shadow: { mapSize: 4096 }
    });
    scene.addMaterial('hero-pbr', {
      type: 'pbr',
      normalMap: 'assets/hero_n.png',
      emissive: 'assets/hero_e.png'
    });
    scene.addGLTFModel({
      id: 'hero',
      url: 'models/hero.glb',
      material: 'hero-pbr',
      rigidBody: { type: 'dynamic' },
      collider: { shape: 'capsule', radius: 0.4, height: 1.8 }
    });
    scene.addGLTFModel({
      id: 'crate',
      url: 'models/crate.glb',
      material: 'missing-mat',
      rigidBody: { type: 'dynamic' }
    });
    scene.addPostProcess({ id: 'bloom', type: 'bloom', budgetMs: 2.4 });
    scene.addPostProcess({ id: 'grade', type: 'color-grading', budgetMs: 0.8 });

    const report = scene.createReadinessReport({
      availableAssets: ['models/hero.glb', 'models/crate.glb', 'assets/hero_n.png'],
      budgets: {
        maxShadowMapSize: 2048,
        postprocessMs: 2,
        maxDynamicBodies: 1
      }
    });

    expect(report).toMatchObject({
      format: 'OmniCore.Scene3DReadinessReport',
      ok: false,
      summary: {
        cameraCount: 1,
        modelCount: 2,
        colliderCount: 1,
        dynamicBodyCount: 2,
        postprocessMs: 3.2,
        issueCount: 5
      }
    });
    expect(report.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'assets', ok: false }),
      expect.objectContaining({ id: 'materials', ok: false }),
      expect.objectContaining({ id: 'shadow-map-budget', ok: false }),
      expect.objectContaining({ id: 'postprocess-budget', ok: false }),
      expect.objectContaining({ id: 'physics-binding', ok: false })
    ]));
    expect(report.issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
      'missing-asset:assets/hero_e.png',
      'missing-material:crate:missing-mat',
      'missing-collider:crate',
      'shadow-map-budget:key',
      'postprocess-budget'
    ]));
    expect(report.recommendations).toEqual(expect.arrayContaining([
      'addAsset:assets/hero_e.png',
      'createMaterial:missing-mat',
      'addCollider:crate',
      'reduceShadowMap:key:2048',
      'optimizePostprocess:3.2>2'
    ]));
    expect(report.debugDraw).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'camera-frustum', id: 'gameplay' }),
      expect.objectContaining({ type: 'collider', id: 'hero', shape: 'capsule' }),
      expect.objectContaining({ type: 'shadow-map', id: 'key', mapSize: 4096 })
    ]));
    expect(report.crossEngineProfile.sources.map((source) => source.engine)).toEqual([
      'Godot',
      'Unity',
      'Unreal',
      'Three.js'
    ]);
  });

  it('plans and applies safe 3D scene readiness fixes while keeping missing assets manual', () => {
    const scene = new Scene3DKit({ name: 'boss-room', width: 1920, height: 1080 });
    scene.setCamera({ id: 'gameplay', mode: 'free', controls: ['orbit'] });
    scene.addLight('key', {
      type: 'directional',
      castShadow: true,
      shadow: { mapSize: 4096 }
    });
    scene.addMaterial('hero-pbr', {
      type: 'pbr',
      normalMap: 'assets/hero_n.png',
      emissive: 'assets/hero_e.png'
    });
    scene.addGLTFModel({
      id: 'hero',
      url: 'models/hero.glb',
      material: 'hero-pbr',
      rigidBody: { type: 'dynamic' },
      collider: { shape: 'capsule', radius: 0.4, height: 1.8 }
    });
    scene.addGLTFModel({
      id: 'crate',
      url: 'models/crate.glb',
      material: 'missing-mat',
      rigidBody: { type: 'dynamic' }
    });
    scene.addPostProcess({ id: 'bloom', type: 'bloom', budgetMs: 2.4 });
    scene.addPostProcess({ id: 'grade', type: 'color-grading', budgetMs: 0.8 });
    const readiness = scene.createReadinessReport({
      availableAssets: ['models/hero.glb', 'models/crate.glb', 'assets/hero_n.png'],
      budgets: { maxShadowMapSize: 2048, postprocessMs: 2 }
    });

    const plan = scene.createReadinessFixPlan(readiness, {
      generatedAt: '2026-01-01T00:00:00.000Z'
    });
    const apply = scene.applyReadinessFixPlan(plan, {
      appliedAt: '2026-01-01T00:00:01.000Z'
    });
    const after = scene.createReadinessReport({
      availableAssets: ['models/hero.glb', 'models/crate.glb', 'assets/hero_n.png'],
      budgets: { maxShadowMapSize: 2048, postprocessMs: 2 }
    });

    expect(plan).toMatchObject({
      format: 'OmniCore.Scene3DReadinessFixPlan',
      sourceScene: 'boss-room',
      status: 'needs-action',
      generatedAt: '2026-01-01T00:00:00.000Z',
      summary: {
        actionCount: 5,
        autoFixCount: 4,
        manualActionCount: 1
      }
    });
    expect(plan.actions.map((action) => action.type)).toEqual([
      'requestAsset',
      'createPlaceholderMaterial',
      'addDefaultCollider',
      'capShadowMap',
      'scalePostprocessBudget'
    ]);
    expect(apply).toMatchObject({
      format: 'OmniCore.Scene3DReadinessFixApplyReport',
      status: 'partial',
      appliedAt: '2026-01-01T00:00:01.000Z',
      summary: {
        requestedCount: 5,
        appliedCount: 4,
        skippedCount: 1,
        failedCount: 0
      }
    });
    expect(scene.materials.get('missing-mat')).toMatchObject({
      id: 'missing-mat',
      placeholder: true
    });
    expect(scene.models.get('crate').physics.collider).toMatchObject({
      shape: 'box',
      generatedBy: 'readiness-fix'
    });
    expect(scene.lights.get('key').shadow.mapSize).toBe(2048);
    expect(scene.postprocess.reduce((sum, pass) => sum + pass.budgetMs, 0)).toBe(2);
    expect(after.issues.map((issue) => issue.id)).toEqual(['missing-asset:assets/hero_e.png']);
    expect(after.gates.find((gate) => gate.id === 'materials').ok).toBe(true);
    expect(after.gates.find((gate) => gate.id === 'physics-binding').ok).toBe(true);
    expect(after.gates.find((gate) => gate.id === 'shadow-map-budget').ok).toBe(true);
    expect(after.gates.find((gate) => gate.id === 'postprocess-budget').ok).toBe(true);
  });

  it('hardens physics backends with colliders, sensors, constraints, raycast, debug draw, and capability reports', async () => {
    const world = new PhysicsWorld();
    await world.setBackend('rapier');
    world.createRigidBody({
      id: 'hero',
      x: 0,
      y: 0,
      vx: 10,
      collider: { shape: 'capsule', radius: 0.5, height: 2 },
      material: { friction: 0.4, restitution: 0.1 },
      collisionFilter: { category: 'player', mask: ['world', 'trigger'] }
    });
    world.createRigidBody({
      id: 'trigger',
      x: 5,
      y: 0,
      type: 'static',
      collider: { shape: 'box', width: 2, height: 2, sensor: true }
    });
    const joint = world.createConstraint({
      id: 'door-hinge',
      type: 'revolute',
      bodyA: 'hero',
      bodyB: 'trigger',
      limits: { min: -0.5, max: 0.5 }
    });

    const hit = world.raycast({ x: -10, y: 0 }, { x: 1, y: 0 }, 30);
    const defaultDistanceHit = world.raycast({ x: -10, y: 0 }, { x: 1, y: 0 });
    const debug = world.createDebugDraw();
    const report = world.createBackendCapabilityReport();

    expect(joint).toMatchObject({ id: 'door-hinge', type: 'revolute' });
    expect(hit).toMatchObject({ bodyId: 'hero', point: { x: 0, y: 0 } });
    expect(defaultDistanceHit).toMatchObject({ bodyId: 'hero' });
    expect(debug.colliders).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hero', shape: 'capsule' }),
      expect.objectContaining({ id: 'trigger', sensor: true })
    ]));
    expect(debug.constraints[0]).toMatchObject({ id: 'door-hinge', bodyA: 'hero', bodyB: 'trigger' });
    expect(report.backends.map((backend) => backend.id)).toEqual(['matter', 'rapier', 'box2d-wasm']);
    expect(report.capabilities).toEqual(expect.arrayContaining([
      'rigid-bodies',
      'colliders',
      'sensors',
      'constraints',
      'raycast',
      'debug-draw'
    ]));
  });

  it('adds WebGPU resource lifecycle and frame budget diagnostics beyond descriptor MVPs', () => {
    const lifecycle = createWebGPUResourceLifecyclePlan({
      currentFrame: 120,
      idleFrameLimit: 60,
      memoryBudgetMB: 64,
      textures: [
        { id: 'hero', sizeMB: 32, lastUsedFrame: 10 },
        { id: 'ui', sizeMB: 4, lastUsedFrame: 118 }
      ],
      buffers: [
        { id: 'instances', sizeMB: 12, mapped: true },
        { id: 'particles', sizeMB: 24, mapped: false }
      ]
    });
    const frame = createWebGPUFrameBudgetReport({
      frameBudgetMs: 16.6,
      passes: [
        { name: 'upload', ms: 5 },
        { name: 'render', ms: 12 }
      ],
      drawCalls: 900,
      batchCount: 42,
      pipelineCache: { hits: 18, misses: 6 },
      deviceLost: true,
      fallbackOrder: ['webgpu', 'pixi', 'canvas']
    });

    expect(lifecycle.toEvict).toEqual(['hero']);
    expect(lifecycle.totalMemoryMB).toBe(72);
    expect(lifecycle.warnings).toEqual(expect.arrayContaining(['texture-idle', 'memory-budget']));
    expect(lifecycle.recommendations).toEqual(expect.arrayContaining(['evictTexture:hero', 'unmapBuffer:instances']));
    expect(frame.totalMs).toBe(17);
    expect(frame.pipelineCacheHitRate).toBe(75);
    expect(frame.fallbackNext).toBe('pixi');
    expect(frame.warnings).toEqual(expect.arrayContaining(['frame-budget-exceeded', 'device-lost']));
  });

  it('exports a VisualScript editor session for node graph E2E checks and beginner trace panels', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        flowGraph: {
          variables: { score: 0 },
          nodes: [
            { id: 'start', type: 'event', label: 'Start', data: { event: 'start' } },
            { id: 'set-score', type: 'action', label: 'Set Score', data: { op: 'set', target: 'variables.score', value: 10 } }
          ],
          edges: [{ from: 'start', to: 'set-score' }]
        },
        dockLayout: { left: ['hierarchy'], center: ['visual-scripting'], right: ['inspector'], bottom: ['runtime-debug'] }
      })
    });

    const before = app.EditorAPI.exportVisualScriptEditorSession({ includeTrace: true });
    const run = app.EditorAPI.runVisualScript('start');
    const after = app.EditorAPI.exportVisualScriptEditorSession({ includeTrace: true });

    expect(before.palette.groups.map((group) => group.id)).toEqual(['flow', 'logic', 'runtime']);
    expect(before.selectors).toMatchObject({
      runStart: '[data-visual-script-run="start"]',
      validate: '[data-visual-script-validate="true"]',
      trace: '[data-visual-script-trace="true"]'
    });
    expect(run.variables.score).toBe(10);
    expect(after.lastRun.traceRows.map((row) => row.nodeId)).toEqual(['start', 'set-score']);
    expect(after.beginnerChecklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'run-start', done: true })
    ]));
    expect(root.querySelector('[data-visual-script-trace-node="set-score"]')).not.toBeNull();
    app.destroy();
  });

  it('creates a recommended API path so the broad surface has a beginner-safe route', () => {
    const lens = new ApiSurfaceFocusLens();
    const path = lens.createRecommendedPath({
      target: '2d-platformer',
      experience: 'beginner',
      engines: ['phaser', 'godot', 'cocos'],
      templates: ['platformer', 'rpg-dialogue'],
      apis: [
        { name: 'Game.init', tier: 'core', workflows: ['start-game'], docs: true, tests: true },
        { name: 'Scene.add', tier: 'core', workflows: ['load-scene'], docs: true, tests: true },
        { name: 'VisualScriptGraphRuntime', tier: 'recommended', workflows: ['script-gameplay'], docs: true, tests: true }
      ]
    });

    expect(path.steps.map((step) => step.id)).toEqual(['template', 'runtime', 'editor', 'diagnostics', 'publish']);
    expect(path.steps[0]).toMatchObject({ recommendedTemplate: 'platformer' });
    expect(path.stableApis).toEqual(['Game.init', 'Scene.add']);
    expect(path.migrationNotes).toEqual(expect.arrayContaining([
      expect.objectContaining({ engine: 'phaser', use: 'Scene lifecycle + Arcade-style PhysicsWorld' }),
      expect.objectContaining({ engine: 'godot', use: 'SceneDocument + PrefabRegistry + VisualScriptGraphRuntime' }),
      expect.objectContaining({ engine: 'cocos', use: 'ComponentTreeRuntime + editor property panels + prefab variants' })
    ]));
    expect(path.e2eChecklist.map((item) => item.id)).toEqual([
      'editor-open',
      'asset-import',
      'prefab-hot-reload',
      'template-run',
      'webgpu-fallback',
      'mobile-viewport'
    ]);
  });
});
