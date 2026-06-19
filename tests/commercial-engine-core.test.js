import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import OmniCore, {
  Analytics,
  AssetPatchManager,
  Localization
} from '../src/index.js';

describe('commercial engine core puzzle pieces', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('applies network resource patch packages over local asset storage', async () => {
    const writes = new Map([
      ['assets/hero.png', 'old-hero'],
      ['assets/old.png', 'remove-me']
    ]);
    const fetches = [];
    const manager = new AssetPatchManager({
      fetcher: async (url) => {
        fetches.push(url);
        return {
          ok: true,
          json: async () => ({
            format: 'OmniCore.OTAPatch',
            version: 1,
            files: {
              'hero.png': { content: 'new-hero', encoding: 'utf8' },
              'ui/menu.json': '{"title":"patched"}'
            },
            removed: ['old.png']
          })
        };
      },
      storage: {
        getItem: (key) => writes.get(key) ?? null,
        setItem: (key, value) => writes.set(key, value),
        removeItem: (key) => writes.delete(key)
      }
    });

    const result = await manager.apply('/patches/v2.patch');

    expect(fetches).toEqual(['/patches/v2.patch']);
    expect(result.applied).toEqual(['hero.png', 'ui/menu.json']);
    expect(writes.get('assets/hero.png')).toBe('new-hero');
    expect(writes.get('assets/ui/menu.json')).toBe('{"title":"patched"}');
    expect(writes.has('assets/old.png')).toBe(false);
    expect(manager.resolve('hero.png')).toBe('new-hero');
  });

  it('tracks player behavior through OmniCore.Analytics.track as JSON lines', () => {
    const output = [];
    const json = OmniCore.Analytics.track('level_start', { level: 3 }, {
      output: (line) => output.push(line),
      clock: () => '2026-06-19T00:00:00.000Z',
      context: { sessionId: 's1' }
    });

    expect(Analytics.track).toBe(OmniCore.Analytics.track);
    expect(output).toEqual([json]);
    expect(JSON.parse(json)).toMatchObject({
      name: 'level_start',
      payload: { level: 3 },
      timestamp: '2026-06-19T00:00:00.000Z',
      context: { sessionId: 's1' }
    });
  });

  it('drags prefabs from the left library into the scene with grid snapping', async () => {
    const { createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href);
    const root = document.createElement('main');
    const sent = [];
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: {
        scene: { entities: [] },
        tilemap: { width: 8, height: 6, tileWidth: 16, tileHeight: 16 },
        prefabs: [{ id: 'slime', name: 'Slime', width: 16, height: 16 }]
      },
      transport: { send: (message) => sent.push(JSON.parse(message)) },
      localization: { 'panel.prefabs': '预制体库' }
    });

    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperties(drop, {
      clientX: { value: 31 },
      clientY: { value: 47 },
      dataTransfer: {
        value: {
          getData(type) {
            if (type === 'application/x-omnicore-prefab' || type === 'text/plain') return 'slime';
            return '';
          }
        }
      }
    });
    root.querySelector('[data-scene-drop-zone="true"]').dispatchEvent(drop);

    expect(root.querySelector('[data-panel="prefabs"] h2')?.textContent).toBe('预制体库');
    expect(app.getState().scene.entities[0]).toMatchObject({
      prefabId: 'slime',
      x: 32,
      y: 48
    });
    expect(sent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'editor:instantiate-prefab',
        payload: expect.objectContaining({
          entity: expect.objectContaining({ x: 32, y: 48 })
        })
      })
    ]));
  });

  it('loads OmniCore.Localization dictionaries from /assets/locale JSON files', async () => {
    const urls = [];
    const localization = await Localization.load('zh-CN', {
      fetcher: async (url) => {
        urls.push(url);
        return {
          ok: true,
          json: async () => ({
            'ui.start': '开始游戏',
            'panel.prefabs': '预制体库'
          })
        };
      }
    });

    expect(OmniCore.Localization).toBe(Localization);
    expect(urls).toEqual(['/assets/locale/zh-CN.json']);
    expect(localization.t('ui.start')).toBe('开始游戏');
    expect(localization.t('panel.prefabs')).toBe('预制体库');
  });

  it('adds a postbuild headless browser smoke gate for packaged output', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const verifier = readFileSync('scripts/verify-build-output.js', 'utf8');

    expect(packageJson.scripts.postbuild).toBe('node scripts/verify-build-output.js');
    expect(verifier).toContain('chromium.launch');
    expect(verifier).toContain('__OMNICORE_BUILD_READY__');
    expect(verifier).toContain('white screen');
  });
});
