import { describe, expect, it } from 'vitest';
import { AssetImportPreview, AssetImportProfile, AssetImportTransaction } from '../src/index.js';

describe('engine asset import transaction pack', () => {
  it('applies preview import steps with writes, metadata sidecars, and editor events', async () => {
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
          reimport: { cacheKey: 'import:old' }
        },
        {
          source: unchanged.source,
          output: unchanged.output,
          reimport: unchanged.reimport
        }
      ]
    });
    const previewReport = preview.preview([
      { source: 'source-assets/ui/hero.png', labels: ['ui'], mtimeMs: 12 },
      { source: 'source-assets/icons/play.png', labels: ['ui'], mtimeMs: 1 },
      { source: 'source-assets/audio/hit.wav', mtimeMs: 10 }
    ], { platform: 'web' });
    const imports = [];
    const writes = [];
    const metadata = [];
    const events = [];
    const transaction = new AssetImportTransaction({
      importer: async (payload) => {
        imports.push(payload);
        return {
          bytes: `bytes:${payload.source}`,
          metadata: {
            source: payload.source,
            output: payload.output,
            cacheKey: payload.entry.reimport.cacheKey
          }
        };
      },
      writer: {
        write: async (payload) => {
          writes.push(payload);
          return { written: payload.path };
        }
      },
      metadataStore: {
        save: async (payload) => {
          metadata.push(payload);
          return { saved: payload.source };
        }
      },
      editorBus: {
        emit: async (type, event) => {
          events.push({ type, event });
        }
      }
    });

    const report = await transaction.apply(previewReport);

    expect(report.schema).toBe('omnicore.asset-import-transaction-report.v1');
    expect(report.ok).toBe(true);
    expect(report.summary).toMatchObject({
      ok: true,
      stepCount: 3,
      importedCount: 2,
      skippedCount: 1,
      blockedCount: 0,
      failedCount: 0,
      rolledBack: false
    });
    expect(report.results.map((result) => ({
      status: result.status,
      source: result.source,
      action: result.action
    }))).toEqual([
      {
        status: 'skipped',
        source: 'source-assets/audio/hit.wav',
        action: 'unchanged'
      },
      {
        status: 'imported',
        source: 'source-assets/icons/play.png',
        action: 'create'
      },
      {
        status: 'imported',
        source: 'source-assets/ui/hero.png',
        action: 'update'
      }
    ]);
    expect(imports.map((payload) => ({
      source: payload.source,
      action: payload.action,
      output: payload.output
    }))).toEqual([
      {
        source: 'source-assets/icons/play.png',
        action: 'create',
        output: 'dist/imported-assets/textures/play.webp'
      },
      {
        source: 'source-assets/ui/hero.png',
        action: 'update',
        output: 'dist/imported-assets/textures/hero.webp'
      }
    ]);
    expect(writes.map((payload) => ({
      path: payload.path,
      value: payload.value
    }))).toEqual([
      {
        path: 'dist/imported-assets/textures/play.webp',
        value: 'bytes:source-assets/icons/play.png'
      },
      {
        path: 'dist/imported-assets/textures/hero.webp',
        value: 'bytes:source-assets/ui/hero.png'
      }
    ]);
    expect(metadata.map((item) => ({
      source: item.source,
      output: item.output
    }))).toEqual([
      {
        source: 'source-assets/icons/play.png',
        output: 'dist/imported-assets/textures/play.webp'
      },
      {
        source: 'source-assets/ui/hero.png',
        output: 'dist/imported-assets/textures/hero.webp'
      }
    ]);
    expect(events.map((event) => event.type)).toEqual(['asset:imported', 'asset:updated']);
    expect(report.crossEngineProfile.capabilities).toEqual([
      'transactional-import-apply',
      'dry-run-step-execution',
      'rollback-on-import-failure',
      'editor-import-events',
      'metadata-sidecar-write',
      'blocked-conflict-enforcement'
    ]);
  });

  it('refuses blocked preview steps unless explicitly allowed', async () => {
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
    const previewReport = new AssetImportPreview({ profile }).preview([
      { source: 'source-assets/hero.png' }
    ]);
    let importCount = 0;
    const transaction = new AssetImportTransaction({
      importer: async () => {
        importCount += 1;
        return { bytes: 'not-written' };
      }
    });

    const report = await transaction.apply(previewReport);

    expect(importCount).toBe(0);
    expect(report.ok).toBe(false);
    expect(report.summary).toMatchObject({
      ok: false,
      stepCount: 1,
      importedCount: 0,
      skippedCount: 0,
      blockedCount: 1,
      failedCount: 1,
      rolledBack: false
    });
    expect(report.failures).toEqual([
      {
        phase: 'blocked',
        source: 'source-assets/hero.png',
        reason: 'reimport-loop-risk',
        message: 'Blocked import step: reimport-loop-risk',
        step: {
          type: 'blocked',
          source: 'source-assets/hero.png',
          reason: 'reimport-loop-risk'
        }
      }
    ]);
  });

  it('rolls back already applied imports when a later import fails', async () => {
    const profile = createProfile();
    const previewReport = new AssetImportPreview({ profile }).preview([
      { source: 'source-assets/textures/a.png', labels: ['ui'], mtimeMs: 1 },
      { source: 'source-assets/textures/b.png', labels: ['ui'], mtimeMs: 1 }
    ], { platform: 'web' });
    const writes = [];
    const rollbacks = [];
    const transaction = new AssetImportTransaction({
      importer: async (payload) => {
        if (payload.source.endsWith('/b.png')) throw new Error('decode failed');
        return { bytes: `bytes:${payload.source}` };
      },
      writer: {
        write: async (payload) => {
          writes.push(payload);
          return { written: payload.path };
        }
      },
      rollback: async (payload) => {
        rollbacks.push(payload);
      }
    });

    const report = await transaction.apply(previewReport);

    expect(report.ok).toBe(false);
    expect(report.summary).toMatchObject({
      ok: false,
      stepCount: 2,
      importedCount: 1,
      skippedCount: 0,
      blockedCount: 0,
      failedCount: 1,
      rolledBack: true,
      rollbackCount: 1
    });
    expect(writes.map((payload) => payload.path)).toEqual([
      'dist/imported-assets/textures/a.webp'
    ]);
    expect(rollbacks.map((payload) => ({
      source: payload.source,
      output: payload.output
    }))).toEqual([
      {
        source: 'source-assets/textures/a.png',
        output: 'dist/imported-assets/textures/a.webp'
      }
    ]);
    expect(report.failures).toEqual([
      {
        phase: 'import',
        source: 'source-assets/textures/b.png',
        output: 'dist/imported-assets/textures/b.webp',
        action: 'create',
        message: 'decode failed',
        step: {
          type: 'import',
          action: 'create',
          source: 'source-assets/textures/b.png',
          output: 'dist/imported-assets/textures/b.webp'
        }
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
