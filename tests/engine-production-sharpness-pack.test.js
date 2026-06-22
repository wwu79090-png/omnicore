import { describe, expect, it } from 'vitest';
import {
  ApiSurfaceFocusLens,
  EditorSceneDependencyGraph,
  PhaserRuntimeParityLayer,
  PixiRenderHardeningProfile,
  ThreePhysicsBridge
} from '../src/index.js';

describe('engine production sharpness pack', () => {
  it('syncs Three-style scene objects with rigid bodies, constraints, and debug primitives', () => {
    const physicsWorld = {
      steps: [],
      step(delta) {
        this.steps.push(delta);
      }
    };
    const object = { position: {}, quaternion: {} };
    const bridge = new ThreePhysicsBridge({ physicsWorld });

    bridge.addRigidBody({
      id: 'crate',
      object,
      body: {
        position: { x: 1, y: 2, z: 3 },
        quaternion: { x: 0, y: 0.5, z: 0, w: 1 }
      },
      collider: { type: 'box', size: [1, 2, 3] },
      debug: true
    });
    bridge.addConstraint({ id: 'hinge-1', a: 'crate', b: 'door', type: 'hinge', limits: { min: -1, max: 1 } });

    const report = bridge.step(1 / 60);

    expect(physicsWorld.steps).toEqual([1 / 60]);
    expect(object.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(object.quaternion).toEqual({ x: 0, y: 0.5, z: 0, w: 1 });
    expect(report).toEqual({
      syncedBodies: ['crate'],
      constraints: ['hinge-1'],
      debugPrimitives: [
        { id: 'crate', type: 'box', position: { x: 1, y: 2, z: 3 }, size: [1, 2, 3] }
      ]
    });
  });

  it('inspects editor nodes, patches component properties, and plans asset hot reload', () => {
    const graph = new EditorSceneDependencyGraph({
      nodes: [
        {
          id: 'player',
          prefab: 'prefabs/player',
          components: {
            Sprite: { texture: 'hero.png' },
            RigidBody: { mass: 1 }
          },
          children: ['weapon']
        }
      ],
      assets: [{ id: 'hero.png', type: 'texture' }],
      prefabs: [{ id: 'prefabs/player', assets: ['hero.png'] }]
    });

    expect(graph.inspectNode('player')).toMatchObject({
      id: 'player',
      componentNames: ['RigidBody', 'Sprite'],
      assetRefs: ['hero.png'],
      prefabRefs: ['prefabs/player']
    });

    graph.applyPropertyPatch('player', 'components.Sprite.tint', 0xff0000);

    expect(graph.inspectNode('player').components.Sprite.tint).toBe(0xff0000);
    expect(graph.buildDependencyGraph().nodes.player.dependencies).toEqual(['hero.png', 'prefabs/player', 'weapon']);
    expect(graph.planHotReload('hero.png')).toEqual({
      asset: 'hero.png',
      affectedNodes: ['player'],
      affectedPrefabs: ['prefabs/player'],
      actions: ['reloadAsset:hero.png', 'refreshNode:player', 'reinstantiatePrefab:prefabs/player']
    });
  });

  it('runs Phaser-style scene lifecycle, arcade bodies, and tilemap coordinate helpers', () => {
    const calls = [];
    const runtime = new PhaserRuntimeParityLayer();
    runtime.addScene('level', {
      init(data) { calls.push(`init:${data.stage}`); },
      preload() { calls.push('preload'); },
      create() { calls.push('create'); },
      update(delta) { calls.push(`update:${delta}`); }
    });

    runtime.start('level', { stage: 1 });
    const sprite = { x: 0, y: 0, width: 16, height: 16 };
    runtime.arcade.addBody(sprite, {
      velocity: { x: 60, y: 0 },
      gravity: { x: 0, y: 120 },
      collideWorldBounds: true,
      worldBounds: { x: 0, y: 0, width: 64, height: 64 }
    });
    const layer = runtime.tilemaps.createLayer({
      width: 2,
      height: 2,
      tileWidth: 16,
      tileHeight: 16,
      data: [0, 1, 1, 0]
    });

    runtime.step(0.5);

    expect(calls).toEqual(['init:1', 'preload', 'create', 'update:0.5']);
    expect(sprite).toMatchObject({ x: 30, y: 30 });
    expect(layer.worldToTile(20, 4)).toEqual({ x: 1, y: 0, index: 1 });
  });

  it('hardens Pixi render frames with state reset, texture GC, batching, and filter diagnostics', () => {
    const report = new PixiRenderHardeningProfile().guardFrame({
      frame: 260,
      backend: 'webgpu',
      mixedRenderers: ['three', 'pixi'],
      drawCalls: 1800,
      drawCallBudget: 1200,
      textureIdleFrames: 120,
      textures: [
        { id: 'hero', lastUsedFrame: 10, sizeMB: 4 },
        { id: 'boss', lastUsedFrame: 220, sizeMB: 64 }
      ],
      filters: [
        { id: 'bloom', cost: 3 },
        { id: 'blur', cost: 2 }
      ],
      filterBudget: 4
    });

    expect(report).toEqual({
      backend: 'webgpu',
      resetSequence: ['three.resetState', 'pixi.resetState', 'pixi.render'],
      textureGc: ['hero'],
      warnings: ['draw-call-budget', 'filter-budget'],
      recommendations: ['enableBatchAtlasDiagnostics', 'runTextureGc:hero', 'collapseFilterChain']
    });
  });

  it('keeps the growing API surface focused on core workflows', () => {
    const report = new ApiSurfaceFocusLens().analyze({
      coreWorkflows: ['start-game', 'load-scene', 'render-sprite'],
      apis: [
        { name: 'Game.init', tier: 'core', workflows: ['start-game'], docs: true, tests: true },
        { name: 'Scene.load', tier: 'core', workflows: ['load-scene'], docs: false, tests: true },
        { name: 'Renderer.drawSprite', tier: 'core', workflows: ['render-sprite'], docs: true, tests: true },
        { name: 'ExperimentalFoo', tier: 'experimental', workflows: [], docs: false, tests: false }
      ]
    });

    expect(report.summary).toEqual({
      apiCount: 4,
      coreWorkflowCount: 3,
      coveredCoreWorkflowCount: 3,
      focusScore: 75,
      ready: false
    });
    expect(report.weakCoreApis).toEqual(['Scene.load']);
    expect(report.noisyApis).toEqual(['ExperimentalFoo']);
    expect(report.recommendations).toEqual(['document:Scene.load', 'hideOrMoveExperimental:ExperimentalFoo']);
  });
});
