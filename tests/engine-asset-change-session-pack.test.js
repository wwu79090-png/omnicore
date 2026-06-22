import { describe, expect, it } from 'vitest';
import { AssetRegistry, AssetRegistryChangeSet } from '../src/index.js';

describe('engine asset change session pack', () => {
  it('turns editor asset changes into dependency-aware refresh, repair, and browser events', () => {
    const registry = new AssetRegistry({
      assets: [
        {
          uid: 'uid://scene-main',
          primaryId: 'Scene:Main',
          address: 'scene.main',
          path: 'scenes/main.scene.json',
          type: 'Scene',
          dependencies: ['uid://hero-prefab']
        },
        {
          uid: 'uid://hero-prefab',
          primaryId: 'Prefab:Hero',
          address: 'prefab.hero',
          path: 'prefabs/hero.prefab.json',
          type: 'Prefab',
          dependencies: ['uid://hero-texture', 'Audio:Jump']
        },
        {
          uid: 'uid://hero-texture',
          primaryId: 'Texture:Hero',
          address: 'texture.hero',
          path: 'assets/characters/hero.png',
          type: 'Texture',
          dependencies: ['assets/materials/hero.material.json']
        },
        {
          uid: 'uid://hero-material',
          primaryId: 'Material:Hero',
          address: 'material.hero',
          path: 'assets/materials/hero.material.json',
          type: 'Material'
        },
        {
          uid: 'uid://jump-audio',
          primaryId: 'Audio:Jump',
          address: 'audio.jump',
          path: 'assets/audio/jump.wav',
          type: 'Audio'
        }
      ]
    });

    const session = new AssetRegistryChangeSet({ registry, source: 'editor-file-watch' });
    session.record({ kind: 'modified', reference: 'texture.hero' });
    session.record({
      kind: 'moved',
      reference: 'material.hero',
      from: 'assets/materials/hero.material.json',
      to: 'assets/materials/hero-lit.material.json'
    });
    session.record({ kind: 'deleted', reference: 'audio.jump' });
    session.record({
      kind: 'imported',
      asset: {
        uid: 'uid://enemy-texture',
        primaryId: 'Texture:Enemy',
        address: 'texture.enemy',
        path: 'assets/characters/enemy.png',
        type: 'Texture',
        labels: ['enemy']
      }
    });

    const plan = session.plan();

    expect(plan.schema).toBe('omnicore.asset-registry-change-plan.v1');
    expect(plan.summary).toEqual({
      source: 'editor-file-watch',
      changeCount: 4,
      directAssetCount: 4,
      affectedAssetCount: 3,
      runtimeActionCount: 7,
      repairActionCount: 1,
      brokenReferenceCount: 2,
      requiresSceneRefresh: true
    });
    expect(plan.directAssets).toEqual(['audio.jump', 'material.hero', 'texture.enemy', 'texture.hero']);
    expect(plan.affectedAssets).toEqual(['prefab.hero', 'scene.main', 'texture.hero']);
    expect(plan.runtimeActions).toEqual([
      {
        type: 'reloadAsset',
        asset: 'texture.hero',
        reason: 'modified'
      },
      {
        type: 'reloadAsset',
        asset: 'material.hero',
        reason: 'moved'
      },
      {
        type: 'unloadAsset',
        asset: 'audio.jump',
        reason: 'deleted'
      },
      {
        type: 'preloadAsset',
        asset: 'texture.enemy',
        reason: 'imported'
      },
      {
        type: 'refreshAsset',
        asset: 'prefab.hero',
        reason: 'depends-on:texture.hero'
      },
      {
        type: 'refreshAsset',
        asset: 'scene.main',
        reason: 'depends-on:texture.hero'
      },
      {
        type: 'refreshAsset',
        asset: 'texture.hero',
        reason: 'depends-on:material.hero'
      }
    ]);
    expect(plan.repairActions).toEqual([
      {
        type: 'rewriteDependency',
        source: 'texture.hero',
        from: 'assets/materials/hero.material.json',
        to: 'uid://hero-material'
      }
    ]);
    expect(plan.brokenReferences).toEqual([
      {
        source: 'prefab.hero',
        missingAsset: 'audio.jump',
        reason: 'deleted'
      },
      {
        source: 'scene.main',
        missingAsset: 'audio.jump',
        reason: 'deleted'
      }
    ]);
    expect(plan.editorEvents).toEqual([
      {
        type: 'asset:changed',
        asset: 'texture.hero',
        kind: 'modified'
      },
      {
        type: 'asset:moved',
        asset: 'material.hero',
        from: 'assets/materials/hero.material.json',
        to: 'assets/materials/hero-lit.material.json'
      },
      {
        type: 'asset:deleted',
        asset: 'audio.jump'
      },
      {
        type: 'asset:imported',
        asset: 'texture.enemy'
      }
    ]);
    expect(plan.crossEngineProfile.capabilities).toEqual([
      'asset-import-finished-session',
      'filesystem-change-signal',
      'dependency-aware-refresh',
      'reverse-reference-invalidation',
      'rename-repair-actions',
      'editor-browser-events'
    ]);
  });
});
