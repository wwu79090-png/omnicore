import { describe, expect, it } from 'vitest';
import {
  AssetImportMetadata,
  EditorInspectorModel,
  ExportPreset,
  PluginManifest,
  SceneDocument,
  SignalBus,
  Tilemap,
  instantiateSceneDocument
} from '../src/index.js';

describe('Godot-style production foundations', () => {
  it('instantiates scene documents with stable resource ids, inheritance, and overrides', () => {
    const base = new SceneDocument({
      name: 'BaseRoom',
      resourcePath: 'scenes/base-room.scene.json',
      children: [
        { id: 'player', type: 'sprite', texture: 'hero.png', x: 8, y: 16, props: { hp: 3 } }
      ]
    });
    const child = new SceneDocument({
      name: 'DungeonRoom',
      inherits: base.toJSON(),
      resourcePath: 'scenes/dungeon-room.scene.json',
      instanceOverrides: {
        player: {
          transform: { x: 32 },
          props: { hp: 5 }
        }
      },
      children: [
        { id: 'door', type: 'sprite', texture: 'door.png', x: 96, y: 16 }
      ]
    });

    const instance = instantiateSceneDocument(child.toJSON());

    expect(instance.uid).toBe('scene:scenes/dungeon-room.scene.json');
    expect(instance.children.map((node) => node.id)).toEqual(['player', 'door']);
    expect(instance.children[0]).toMatchObject({
      uid: 'scene:scenes/dungeon-room.scene.json#player',
      inheritedFrom: 'scene:scenes/base-room.scene.json#player',
      transform: expect.objectContaining({ x: 32, y: 16 }),
      props: { hp: 5 }
    });
  });

  it('connects named signals between runtime objects and supports once listeners', () => {
    const source = new SignalBus();
    const target = new SignalBus();
    const events = [];
    target.signal('opened').connect((payload) => events.push(`target:${payload.id}`));
    source.connect('door_opened', target, 'opened');
    source.signal('door_opened').connect((payload) => events.push(`once:${payload.id}`), { once: true });

    source.emit('door_opened', { id: 'a' });
    source.emit('door_opened', { id: 'b' });

    expect(events).toEqual(['target:a', 'once:a', 'target:b']);
  });

  it('validates export presets with platform defaults and budget warnings', () => {
    const preset = ExportPreset.create({
      name: 'wechat-demo',
      platform: 'wechat',
      bundle: { maxSizeKb: 4096, estimatedSizeKb: 5120 },
      icons: { app: 'assets/icons/wechat/icon.png' },
      permissions: ['network']
    });

    expect(preset.outputDir).toBe('dist/wechat');
    expect(preset.validate().warnings.map((warning) => warning.code)).toContain('bundle-budget-exceeded');
    expect(preset.toBuildConfig()).toMatchObject({
      platform: 'wechat',
      command: 'npm run build:wechat',
      env: { OMNICORE_EXPORT_PRESET: 'wechat-demo' }
    });
  });

  it('creates asset import metadata with stable cache keys and reimport checks', () => {
    const metadata = AssetImportMetadata.create({
      source: 'source-assets/Hero.PNG',
      importer: 'texture',
      platformVariants: {
        web: { format: 'webp', quality: 0.82 },
        wechat: { format: 'png', maxSize: 2048 }
      },
      dependencies: ['source-assets/Hero.meta.json'],
      mtimeMs: 100
    });

    expect(metadata.uid).toBe('asset:source-assets/hero.png');
    expect(metadata.cacheKey).toContain('texture:source-assets/hero.png');
    expect(metadata.needsReimport({ mtimeMs: 101, importerVersion: metadata.importerVersion })).toBe(true);
    expect(metadata.resolveVariant('wechat')).toMatchObject({ format: 'png', maxSize: 2048 });
  });

  it('builds an inspector schema for transform, render, props, and components', () => {
    const schema = EditorInspectorModel.fromEntity({
      id: 'player',
      name: 'Player',
      type: 'sprite',
      x: 12,
      y: 20,
      zIndex: 3,
      texture: 'hero.png',
      props: { hp: 10 },
      components: [{ type: 'Health', options: { max: 10 } }]
    });

    expect(schema.groups.map((group) => group.id)).toEqual(['identity', 'transform', 'render', 'props', 'components']);
    expect(schema.getField('transform.x')).toMatchObject({ path: 'x', value: 12, editor: 'number' });
    expect(schema.applyPatch({ 'props.hp': 8, 'transform.y': 24 })).toMatchObject({
      props: { hp: 8 },
      y: 24
    });
  });

  it('generates tilemap brush previews and collision overlays for 2D authoring', () => {
    const map = Tilemap.parse({
      width: 3,
      height: 2,
      tilewidth: 16,
      tileheight: 16,
      layers: [
        { name: 'Ground', type: 'tilelayer', width: 3, height: 2, data: [0, 1, 0, 2, 2, 0] }
      ]
    });

    const tools = map.authoringTools();
    const preview = tools.previewBrush('Ground', { x: 1, y: 0 }, [[7, 8]]);
    const overlay = tools.collisionOverlay('Ground', { collisionTileIds: [2] });

    expect(preview.edits).toEqual([
      { layer: 'Ground', x: 1, y: 0, from: 1, to: 7 },
      { layer: 'Ground', x: 2, y: 0, from: 0, to: 8 }
    ]);
    expect(preview.worldBounds).toEqual({ x: 16, y: 0, width: 32, height: 16 });
    expect(overlay.polygons).toHaveLength(1);
    expect(map.getTileLayer('Ground').tileAt(1, 0)).toBe(1);
  });

  it('normalizes plugin manifests for editor/runtime separation and permissions', () => {
    const manifest = PluginManifest.create({
      name: 'dialogue-tools',
      version: '1.2.0',
      engines: { omnicore: '^1.0.0' },
      entry: './runtime.js',
      editor: './editor.js',
      permissions: ['assets:read', 'scene:write']
    });

    expect(manifest.runtimeEntry).toBe('./runtime.js');
    expect(manifest.editorEntry).toBe('./editor.js');
    expect(manifest.kind).toBe('hybrid');
    expect(manifest.validate().ok).toBe(true);
  });
});
