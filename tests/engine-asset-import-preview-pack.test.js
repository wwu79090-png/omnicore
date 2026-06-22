import { describe, expect, it } from 'vitest';
import { AssetImportPreview, AssetImportProfile } from '../src/index.js';

describe('engine asset import preview pack', () => {
  it('previews create, update, unchanged, and import conflicts before touching generated assets', () => {
    const profile = createProfile();
    const unchanged = profile.resolve({
      source: 'source-assets/audio/hit.wav',
      mtimeMs: 10
    }, { platform: 'web' });
    const preview = new AssetImportPreview({
      profile,
      current: [
        {
          source: 'source-assets/ui/hero.png',
          output: { path: 'dist/imported-assets/textures/hero.webp' },
          reimport: { cacheKey: 'import:old' },
          protectedEdits: ['materialAssignments']
        },
        {
          source: unchanged.source,
          output: unchanged.output,
          reimport: unchanged.reimport
        }
      ]
    });

    const report = preview.preview([
      { source: 'source-assets/ui/hero.png', labels: ['ui'], mtimeMs: 12 },
      { source: 'source-assets/icons/hero.png', labels: ['ui'], mtimeMs: 1 },
      { source: 'source-assets/audio/hit.wav', mtimeMs: 10 }
    ], { platform: 'web' });

    expect(report.schema).toBe('omnicore.asset-import-preview.v1');
    expect(report.summary).toEqual({
      ok: false,
      assetCount: 3,
      createCount: 1,
      updateCount: 1,
      unchangedCount: 1,
      conflictCount: 2,
      errorCount: 1,
      warningCount: 1
    });
    expect(report.entries.map((entry) => ({
      source: entry.source,
      action: entry.action,
      reasons: entry.reasons
    }))).toEqual([
      {
        source: 'source-assets/audio/hit.wav',
        action: 'unchanged',
        reasons: []
      },
      {
        source: 'source-assets/icons/hero.png',
        action: 'create',
        reasons: ['new-source']
      },
      {
        source: 'source-assets/ui/hero.png',
        action: 'update',
        reasons: ['cache-key-changed']
      }
    ]);
    expect(report.diagnostics).toEqual([
      {
        code: 'output-path-collision',
        severity: 'error',
        path: 'dist/imported-assets/textures/hero.webp',
        sources: ['source-assets/icons/hero.png', 'source-assets/ui/hero.png']
      },
      {
        code: 'protected-reimport-overwrite',
        severity: 'warning',
        source: 'source-assets/ui/hero.png',
        protectedEdits: ['materialAssignments']
      }
    ]);
    expect(report.steps).toEqual([
      {
        type: 'skip',
        source: 'source-assets/audio/hit.wav',
        reason: 'unchanged'
      },
      {
        type: 'import',
        action: 'create',
        source: 'source-assets/icons/hero.png',
        output: 'dist/imported-assets/textures/hero.webp'
      },
      {
        type: 'blocked',
        source: 'source-assets/ui/hero.png',
        reason: 'protected-reimport-overwrite'
      }
    ]);
    expect(report.crossEngineProfile.capabilities).toEqual([
      'import-preview',
      'dry-run-reimport-plan',
      'output-collision-detection',
      'protected-edit-conflict-warning',
      'unchanged-import-skip',
      'reimport-loop-guard'
    ]);
  });

  it('flags import output paths that would write back inside the watched source tree', () => {
    const profile = new AssetImportProfile({
      sourceRoot: 'source-assets',
      outputRoot: 'source-assets/generated',
      presets: [
        {
          name: 'texture-loop-risk',
          importer: 'texture',
          extensions: ['.png'],
          output: { folder: 'textures', extension: '.webp' }
        }
      ]
    });
    const report = new AssetImportPreview({ profile }).preview([
      { source: 'source-assets/hero.png' }
    ]);

    expect(report.summary.ok).toBe(false);
    expect(report.diagnostics).toEqual([
      {
        code: 'reimport-loop-risk',
        severity: 'error',
        source: 'source-assets/hero.png',
        output: 'source-assets/generated/textures/hero.webp',
        sourceRoot: 'source-assets'
      }
    ]);
    expect(report.steps).toEqual([
      {
        type: 'blocked',
        source: 'source-assets/hero.png',
        reason: 'reimport-loop-risk'
      }
    ]);
  });
});

function createProfile() {
  return new AssetImportProfile({
    sourceRoot: 'source-assets',
    outputRoot: 'dist/imported-assets',
    importerVersion: '3',
    presets: [
      {
        name: 'texture-default',
        importer: 'texture',
        extensions: ['.png'],
        output: {
          folder: 'textures',
          extension: '.webp',
          bundle: 'textures'
        }
      },
      {
        name: 'audio-default',
        importer: 'audio',
        extensions: ['.wav'],
        output: {
          folder: 'audio',
          extension: '.ogg',
          bundle: 'audio'
        }
      }
    ]
  });
}
