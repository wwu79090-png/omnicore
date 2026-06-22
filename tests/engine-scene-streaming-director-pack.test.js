import { describe, expect, it } from 'vitest';
import { SceneStreamingDirector } from '../src/index.js';

describe('engine scene streaming director pack', () => {
  it('plans additive scene streaming, threaded asset requests, bundle preloads, and safe unloads', () => {
    const director = new SceneStreamingDirector({
      cellSize: 100,
      scenes: [
        {
          id: 'boot',
          x: 0,
          y: 0,
          spatial: false,
          persistent: true,
          bundle: 'boot',
          assets: ['ui.shell']
        },
        {
          id: 'hub',
          x: 0,
          y: 0,
          layers: ['base'],
          bundle: 'hub',
          assets: ['hub.map', 'shared.npc'],
          priority: 10
        },
        {
          id: 'cave',
          x: 240,
          y: 0,
          layers: ['base'],
          bundle: 'cave',
          assets: ['cave.map']
        },
        {
          id: 'night-market',
          x: 0,
          y: 0,
          layers: ['night'],
          bundle: 'night',
          assets: ['night.shop']
        }
      ]
    });

    const report = director.plan({
      sources: [{ id: 'player', x: 0, y: 0, radius: 120, preloadRadius: 280 }],
      activeLayers: ['base'],
      loadedScenes: ['boot', 'night-market'],
      residentBundles: ['boot'],
      residentAssets: ['ui.shell']
    });

    expect(report.summary).toEqual({
      sceneCount: 4,
      activeSceneCount: 2,
      preloadSceneCount: 1,
      unloadSceneCount: 1,
      actionCount: 8,
      ready: true
    });
    expect(report.activeScenes).toEqual(['boot', 'hub']);
    expect(report.preloadScenes).toEqual(['cave']);
    expect(report.unloadScenes).toEqual(['night-market']);
    expect(report.cells).toEqual({
      active: ['0,0'],
      preload: ['2,0']
    });
    expect(report.actions).toEqual([
      {
        type: 'loadBundle',
        bundle: 'hub',
        scenes: ['hub'],
        enginePattern: 'Cocos Creator Asset Bundle'
      },
      {
        type: 'requestThreadedLoad',
        asset: 'hub.map',
        scene: 'hub',
        preload: false,
        enginePattern: 'Godot ResourceLoader'
      },
      {
        type: 'requestThreadedLoad',
        asset: 'shared.npc',
        scene: 'hub',
        preload: false,
        enginePattern: 'Godot ResourceLoader'
      },
      {
        type: 'loadSceneAdditive',
        scene: 'hub',
        mode: 'additive',
        enginePattern: 'Unity LoadSceneMode.Additive'
      },
      {
        type: 'preloadBundle',
        bundle: 'cave',
        scenes: ['cave'],
        enginePattern: 'Cocos Creator Asset Bundle'
      },
      {
        type: 'requestThreadedLoad',
        asset: 'cave.map',
        scene: 'cave',
        preload: true,
        enginePattern: 'Godot ResourceLoader'
      },
      {
        type: 'unloadSceneAdditive',
        scene: 'night-market',
        enginePattern: 'Unity SceneManager.UnloadSceneAsync'
      },
      {
        type: 'releaseBundle',
        bundle: 'night',
        scene: 'night-market',
        enginePattern: 'Cocos Creator Asset Manager'
      }
    ]);
    expect(report.crossEngineProfile).toEqual({
      sources: [
        'Unreal World Partition',
        'Unity Additive Scene Loading',
        'Godot ResourceLoader threaded loading',
        'Cocos Creator Asset Bundle'
      ],
      capabilities: [
        'runtime-streaming-sources',
        'additive-scene-load-unload',
        'threaded-resource-prefetch',
        'bundle-preload-and-release',
        'layer-aware-world-partition',
        'deterministic-streaming-action-plan'
      ]
    });
  });
});
