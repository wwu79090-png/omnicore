import { describe, expect, it } from 'vitest';
import { AssetReferenceIntegrityAuditor } from '../src/index.js';

describe('engine asset reference integrity pack', () => {
  it('audits stable resource ids, addressables, bundles, primary assets, and scene repair plans', () => {
    const auditor = new AssetReferenceIntegrityAuditor({
      catalog: {
        entries: [
          {
            uid: 'uid://hero',
            primaryId: 'Character:Hero',
            address: 'hero.sprite',
            path: 'assets/characters/hero.png',
            bundle: 'characters',
            dependencies: ['shared.atlas'],
            labels: ['startup']
          },
          {
            uid: 'uid://atlas',
            primaryId: 'Atlas:Shared',
            address: 'shared.atlas',
            path: 'assets/shared/atlas.png',
            bundle: 'environment'
          },
          {
            uid: 'uid://menu-bg',
            primaryId: 'Texture:MenuBg',
            address: 'menu.bg',
            path: 'assets/ui/menu-bg.png',
            bundle: 'ui'
          },
          {
            uid: 'uid://jump',
            path: 'assets/audio/jump.wav',
            bundle: 'audio'
          }
        ]
      },
      scenes: [
        {
          id: 'scene.menu',
          assets: ['uid://hero', 'assets/old/menu-bg.png', 'Missing:Audio'],
          prefabs: ['prefab.hero']
        }
      ],
      prefabs: [
        {
          id: 'prefab.hero',
          assets: ['Character:Hero', 'assets/audio/jump.wav']
        }
      ]
    });

    const report = auditor.audit({
      renamed: {
        'assets/old/menu-bg.png': 'assets/ui/menu-bg.png'
      },
      startupBundles: ['characters']
    });

    expect(auditor.resolve('uid://hero')).toMatchObject({
      address: 'hero.sprite',
      path: 'assets/characters/hero.png',
      primaryId: 'Character:Hero'
    });
    expect(auditor.resolve('Character:Hero')).toMatchObject({ uid: 'uid://hero' });
    expect(auditor.resolve('assets/characters/hero.png')).toMatchObject({ uid: 'uid://hero' });

    expect(report.summary).toEqual({
      assetCount: 4,
      sceneCount: 1,
      prefabCount: 1,
      issueCount: 5,
      repairActionCount: 5,
      ready: false
    });
    expect(report.issues.map((issue) => issue.code)).toEqual([
      'stale-path',
      'missing-reference',
      'missing-address',
      'missing-primary-asset-id',
      'cross-bundle-dependency'
    ]);
    expect(report.references).toEqual([
      {
        source: 'scene.menu',
        sourceType: 'scene',
        reference: 'uid://hero',
        resolved: true,
        resolvedBy: 'uid',
        asset: 'hero.sprite'
      },
      {
        source: 'scene.menu',
        sourceType: 'scene',
        reference: 'assets/old/menu-bg.png',
        resolved: true,
        resolvedBy: 'renamed-path',
        asset: 'menu.bg'
      },
      {
        source: 'scene.menu',
        sourceType: 'scene',
        reference: 'Missing:Audio',
        resolved: false,
        resolvedBy: null,
        asset: null
      },
      {
        source: 'prefab.hero',
        sourceType: 'prefab',
        reference: 'Character:Hero',
        resolved: true,
        resolvedBy: 'primaryId',
        asset: 'hero.sprite'
      },
      {
        source: 'prefab.hero',
        sourceType: 'prefab',
        reference: 'assets/audio/jump.wav',
        resolved: true,
        resolvedBy: 'path',
        asset: 'assets/audio/jump.wav'
      }
    ]);
    expect(report.bundleGraph.crossBundleDependencies).toEqual([
      {
        source: 'hero.sprite',
        sourceBundle: 'characters',
        dependency: 'shared.atlas',
        dependencyBundle: 'environment'
      }
    ]);
    expect(report.cookReadiness).toEqual({
      ready: false,
      startupBundles: ['characters'],
      preloadAssets: ['hero.sprite'],
      missingAddressableAssets: ['assets/audio/jump.wav'],
      missingPrimaryAssets: ['assets/audio/jump.wav'],
      missingReferences: ['Missing:Audio'],
      staleReferences: ['assets/old/menu-bg.png']
    });
    expect(report.repairPlan.actions).toEqual([
      {
        type: 'rewriteReference',
        source: 'scene.menu',
        from: 'assets/old/menu-bg.png',
        to: 'assets/ui/menu-bg.png',
        via: 'renamed-path'
      },
      {
        type: 'createPlaceholderAsset',
        source: 'scene.menu',
        reference: 'Missing:Audio'
      },
      {
        type: 'markAddressable',
        asset: 'assets/audio/jump.wav',
        suggestedAddress: 'jump'
      },
      {
        type: 'promotePrimaryAsset',
        asset: 'assets/audio/jump.wav',
        suggestedPrimaryId: 'Audio:Jump'
      },
      {
        type: 'moveToSharedBundle',
        asset: 'shared.atlas',
        fromBundle: 'environment',
        toBundle: 'shared',
        reason: 'referenced-by-characters'
      }
    ]);
    expect(report.crossEngineProfile).toEqual(AssetReferenceIntegrityAuditor.crossEngineProfile());
    expect(report.crossEngineProfile.sources).toEqual([
      'Unity Addressables',
      'Godot ResourceUID',
      'Cocos Creator Asset Bundle',
      'Unreal Asset Manager'
    ]);
    expect(report.crossEngineProfile.capabilities).toEqual([
      'stable-resource-uids',
      'addressable-resolution',
      'primary-asset-ids',
      'bundle-dependency-audit',
      'prefab-scene-reference-repair',
      'cook-readiness-report'
    ]);
  });
});
