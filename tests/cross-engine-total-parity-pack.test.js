import { describe, expect, it } from 'vitest';
import {
  CrossEngineAdoptionPlanner,
  CrossEngineParityMatrix,
  EngineAdvantageAssimilator
} from '../src/index.js';

describe('cross-engine total parity pack', () => {
  it('tracks full advantage coverage across Phaser, Godot, Cocos Creator, PixiJS, and Three physics', () => {
    const matrix = new CrossEngineParityMatrix({
      sources: {
        phaser: ['scenes', 'arcade-physics', 'tilemaps', 'input', 'loader'],
        godot: ['nodes', 'signals', 'resources', 'animation-tree'],
        cocosCreator: ['prefabs', 'component-editor', 'asset-db'],
        pixijs: ['webgpu-renderer', 'filters', 'texture-gc'],
        threePhysics: ['scenegraph3d', 'gltf', 'materials', 'lights', 'physics-adapter']
      }
    });

    const report = matrix.evaluate({
      implemented: {
        phaser: ['scenes', 'input', 'loader'],
        godot: ['nodes', 'signals'],
        cocosCreator: ['prefabs'],
        pixijs: ['webgpu-renderer', 'filters'],
        threePhysics: ['scenegraph3d', 'gltf', 'lights']
      }
    });

    expect(report.summary).toEqual({
      sourceCount: 5,
      requiredCapabilityCount: 20,
      coveredCapabilityCount: 11,
      coverageScore: 55,
      ready: false
    });
    expect(report.sources.phaser).toMatchObject({
      score: 60,
      missing: ['arcade-physics', 'tilemaps']
    });
    expect(report.sources.threePhysics).toMatchObject({
      score: 60,
      missing: ['materials', 'physics-adapter']
    });
    expect(report.missingCapabilities.map((item) => `${item.source}:${item.capability}`)).toEqual([
      'phaser:arcade-physics',
      'phaser:tilemaps',
      'godot:resources',
      'godot:animation-tree',
      'cocosCreator:component-editor',
      'cocosCreator:asset-db',
      'pixijs:texture-gc',
      'threePhysics:materials',
      'threePhysics:physics-adapter'
    ]);
  });

  it('routes missing cross-engine advantages into local engine modules and strategies', () => {
    const assimilator = new EngineAdvantageAssimilator({
      engineModules: {
        renderer: ['webgpu-renderer', 'filters'],
        physics: ['arcade-physics'],
        tilemap: ['tilemaps'],
        assets: ['asset-db'],
        editor: ['component-editor']
      }
    });

    const plan = assimilator.assimilate([
      { source: 'phaser', capability: 'tilemaps' },
      { source: 'threePhysics', capability: 'physics-adapter' },
      { source: 'godot', capability: 'resources' },
      { source: 'pixijs', capability: 'texture-gc' }
    ]);

    expect(plan.summary).toEqual({
      adoptionCount: 4,
      nativeCount: 1,
      extensionCount: 3
    });
    expect(plan.adoptions).toEqual([
      {
        source: 'phaser',
        capability: 'tilemaps',
        module: 'tilemap',
        strategy: 'harden-existing',
        priority: 'P0'
      },
      {
        source: 'threePhysics',
        capability: 'physics-adapter',
        module: 'physics',
        strategy: 'extend-module',
        priority: 'P0'
      },
      {
        source: 'godot',
        capability: 'resources',
        module: 'assets',
        strategy: 'extend-module',
        priority: 'P1'
      },
      {
        source: 'pixijs',
        capability: 'texture-gc',
        module: 'renderer',
        strategy: 'extend-module',
        priority: 'P1'
      }
    ]);
  });

  it('builds executable adoption steps with verification commands', () => {
    const planner = new CrossEngineAdoptionPlanner();
    const plan = planner.plan([
      { source: 'phaser', capability: 'tilemaps', module: 'tilemap', priority: 'P0' },
      { source: 'threePhysics', capability: 'physics-adapter', module: 'physics', priority: 'P0' },
      { source: 'pixijs', capability: 'texture-gc', module: 'renderer', priority: 'P1' }
    ]);

    expect(plan.summary).toEqual({
      stepCount: 3,
      p0Count: 2,
      p1Count: 1,
      estimatedCoverageGain: 15
    });
    expect(plan.steps).toEqual([
      {
        id: 'phaser:tilemaps',
        priority: 'P0',
        module: 'tilemap',
        action: 'adopt-tilemaps',
        verification: 'npm test -- tests/engine-pattern-scalability-optimization-pack.test.js tests/phaser-compat-layer.test.js'
      },
      {
        id: 'threePhysics:physics-adapter',
        priority: 'P0',
        module: 'physics',
        action: 'adopt-physics-adapter',
        verification: 'npm test -- tests/physics-backends.test.js tests/dimension3d-performance-guards.test.js'
      },
      {
        id: 'pixijs:texture-gc',
        priority: 'P1',
        module: 'renderer',
        action: 'adopt-texture-gc',
        verification: 'npm test -- tests/lifecycle-leak-guards.test.js tests/renderer-backends-mvp.test.js'
      }
    ]);
  });
});
