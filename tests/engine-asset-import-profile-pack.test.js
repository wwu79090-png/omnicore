import { describe, expect, it } from 'vitest';
import { AssetImportProfile } from '../src/index.js';

describe('engine asset import profile pack', () => {
  it('resolves importer presets, platform overrides, output paths, and deterministic reimport keys', () => {
    const profile = new AssetImportProfile({
      sourceRoot: 'source-assets',
      outputRoot: 'dist/imported-assets',
      importerVersion: '7',
      defaults: {
        texture: {
          settings: {
            colorSpace: 'srgb',
            mipmaps: true,
            compression: 'basisu'
          }
        }
      },
      presets: [
        {
          name: 'ui-texture',
          importer: 'texture',
          priority: 10,
          extensions: ['.png', '.jpg'],
          pathIncludes: ['ui/'],
          labels: ['ui'],
          output: {
            folder: 'textures/ui',
            extension: '.webp',
            bundle: 'ui'
          },
          settings: {
            textureType: 'sprite',
            mipmaps: false,
            maxSize: 2048
          },
          platforms: {
            default: { format: 'webp', quality: 0.82 },
            wechat: {
              format: 'png',
              outputExtension: '.png',
              maxSize: 1024,
              compression: 'none'
            }
          },
          dependencies: ['source-assets/ui/atlas.json']
        }
      ]
    });

    const resolved = profile.resolve({
      source: 'source-assets/UI/Hero.PNG',
      labels: ['ui', 'hero'],
      mtimeMs: 120
    }, { platform: 'wechat' });
    const secondPass = profile.resolve({
      source: 'source-assets/UI/Hero.PNG',
      labels: ['ui', 'hero'],
      mtimeMs: 120
    }, { platform: 'wechat' });

    expect(resolved).toMatchObject({
      schema: 'omnicore.asset-import-profile-resolution.v1',
      source: 'source-assets/ui/hero.png',
      importer: 'texture',
      preset: 'ui-texture',
      platform: 'wechat',
      output: {
        path: 'dist/imported-assets/textures/ui/hero.png',
        extension: '.png',
        bundle: 'ui'
      },
      settings: {
        colorSpace: 'srgb',
        mipmaps: false,
        compression: 'none',
        textureType: 'sprite',
        maxSize: 1024,
        format: 'png',
        quality: 0.82
      },
      metadata: {
        source: 'source-assets/ui/hero.png',
        importer: 'texture',
        importerVersion: '7',
        dependencies: ['source-assets/ui/atlas.json'],
        platformVariants: {
          default: { format: 'webp', quality: 0.82 },
          wechat: {
            format: 'png',
            outputExtension: '.png',
            maxSize: 1024,
            compression: 'none'
          }
        }
      },
      diagnostics: []
    });
    expect(resolved.reimport.cacheKey).toBe(secondPass.reimport.cacheKey);
    expect(resolved.reimport.cacheKey).toContain('ui-texture');
    expect(resolved.crossEngineProfile.capabilities).toEqual([
      'import-preset-resolution',
      'platform-import-overrides',
      'deterministic-reimport-cache-key',
      'import-output-routing',
      'bulk-import-diagnostics',
      'pipeline-stack-metadata'
    ]);
  });

  it('audits bulk imports for ambiguous presets and missing configured import rules', () => {
    const profile = new AssetImportProfile({
      strictPresets: true,
      presets: [
        {
          name: 'texture-default',
          importer: 'texture',
          priority: 1,
          extensions: ['.png'],
          output: { folder: 'textures' }
        },
        {
          name: 'texture-ui',
          importer: 'texture',
          priority: 1,
          extensions: ['.png'],
          labels: ['ui'],
          output: { folder: 'textures/ui' }
        }
      ]
    });

    const report = profile.audit([
      { source: 'source-assets/ui/button.png', labels: ['ui'] },
      { source: 'source-assets/levels/world.tmx' }
    ], { platform: 'web' });

    expect(report.schema).toBe('omnicore.asset-import-profile-audit.v1');
    expect(report.summary).toEqual({
      ok: false,
      assetCount: 2,
      errorCount: 1,
      warningCount: 1
    });
    expect(report.diagnostics).toEqual([
      {
        code: 'multiple-presets-match',
        severity: 'warning',
        source: 'source-assets/ui/button.png',
        importer: 'texture',
        presets: ['texture-default', 'texture-ui']
      },
      {
        code: 'missing-preset',
        severity: 'error',
        source: 'source-assets/levels/world.tmx',
        importer: 'data'
      }
    ]);
  });
});
