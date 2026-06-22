import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '../src/index.js';

describe('engine asset registry pack', () => {
  it('indexes unloaded assets for editor search, recursive dependencies, reverse references, and rename repair plans', () => {
    const registry = new AssetRegistry({
      assets: [
        {
          uid: 'uid://scene-main',
          primaryId: 'Scene:Main',
          address: 'scene.main',
          path: 'scenes/main.scene.json',
          type: 'Scene',
          labels: ['startup'],
          tags: { world: 'town' },
          loaded: false,
          dependencies: ['uid://hero-prefab', 'missing://boss-audio']
        },
        {
          uid: 'uid://hero-prefab',
          primaryId: 'Prefab:Hero',
          address: 'prefab.hero',
          path: 'prefabs/hero.prefab.json',
          type: 'Prefab',
          labels: ['player', 'startup'],
          tags: { class: 'Character', faction: 'player' },
          dependencies: ['uid://hero-texture', 'Audio:Jump']
        },
        {
          uid: 'uid://hero-texture',
          primaryId: 'Texture:Hero',
          address: 'texture.hero',
          path: 'assets/characters/hero.png',
          type: 'Texture',
          labels: ['player'],
          tags: { atlas: 'characters' },
          dependencies: ['assets/materials/hero.material.json']
        },
        {
          uid: 'uid://hero-material',
          primaryId: 'Material:Hero',
          address: 'material.hero',
          path: 'assets/materials/hero.material.json',
          type: 'Material',
          labels: ['player'],
          tags: { shader: 'sprite-lit' }
        },
        {
          uid: 'uid://jump-audio',
          primaryId: 'Audio:Jump',
          address: 'audio.jump',
          path: 'assets/audio/jump.wav',
          type: 'Audio',
          labels: ['startup']
        },
        {
          uid: 'uid://hero-texture',
          primaryId: 'Texture:HeroCopy',
          address: 'texture.hero-copy',
          path: 'assets/characters/hero-copy.png',
          type: 'Texture',
          labels: ['broken-meta']
        },
        {
          uid: 'uid://unused',
          primaryId: 'Texture:Unused',
          address: 'texture.unused',
          path: 'assets/unused/debug.png',
          type: 'Texture',
          labels: ['debug']
        }
      ]
    });

    expect(registry.resolve('uid://hero-prefab')).toMatchObject({
      address: 'prefab.hero',
      path: 'prefabs/hero.prefab.json',
      type: 'Prefab'
    });
    expect(registry.resolve('Audio:Jump')).toMatchObject({ address: 'audio.jump' });
    expect(registry.resolve('assets/materials/hero.material.json')).toMatchObject({ address: 'material.hero' });

    expect(registry.query({ type: 'Texture', labels: ['player'], unloadedOnly: true }).map((asset) => asset.address)).toEqual([
      'texture.hero'
    ]);
    expect(registry.query({ tags: { class: 'Character' } }).map((asset) => asset.address)).toEqual(['prefab.hero']);
    expect(registry.query({ pathPrefix: 'assets/characters' }).map((asset) => asset.address)).toEqual([
      'texture.hero',
      'texture.hero-copy'
    ]);

    expect(registry.getDependencies('scene.main', { recursive: true }).map((edge) => edge.asset)).toEqual([
      'prefab.hero',
      'texture.hero',
      'material.hero',
      'audio.jump'
    ]);
    expect(registry.getDependencies('scene.main', { recursive: true, includeMissing: true }).at(-1)).toEqual({
      asset: 'missing://boss-audio',
      missing: true,
      depth: 1,
      via: 'scene.main'
    });
    expect(registry.getReferencers('material.hero', { recursive: true }).map((edge) => edge.asset)).toEqual([
      'texture.hero',
      'prefab.hero',
      'scene.main'
    ]);

    expect(registry.planMove('uid://hero-texture', 'assets/characters/player.png')).toEqual({
      asset: 'texture.hero',
      from: 'assets/characters/hero.png',
      to: 'assets/characters/player.png',
      stableUid: 'uid://hero-texture',
      affectedAssets: ['prefab.hero'],
      rewriteActions: [
        {
          type: 'rewriteDependency',
          source: 'prefab.hero',
          from: 'uid://hero-texture',
          to: 'uid://hero-texture'
        }
      ]
    });

    const audit = registry.audit({ entrypoints: ['scene.main'] });

    expect(audit.schema).toBe('omnicore.asset-registry-audit.v1');
    expect(audit.summary).toEqual({
      assetCount: 7,
      missingReferenceCount: 1,
      duplicateUidCount: 1,
      orphanAssetCount: 2,
      cycleCount: 0,
      ready: false
    });
    expect(audit.missingReferences).toEqual([
      {
        source: 'scene.main',
        reference: 'missing://boss-audio',
        severity: 'error'
      }
    ]);
    expect(audit.duplicateUids).toEqual([
      {
        uid: 'uid://hero-texture',
        assets: ['texture.hero', 'texture.hero-copy'],
        severity: 'error'
      }
    ]);
    expect(audit.orphanAssets).toEqual(['texture.hero-copy', 'texture.unused']);
    expect(audit.crossEngineProfile.capabilities).toEqual([
      'unloaded-asset-search',
      'stable-uid-resolution',
      'recursive-dependency-query',
      'reverse-reference-query',
      'missing-reference-audit',
      'meta-guid-conflict-audit',
      'move-rename-repair-plan'
    ]);
  });
});
