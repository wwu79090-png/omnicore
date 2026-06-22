import { describe, expect, it } from 'vitest';
import {
  InputActionContextStack,
  RenderGraphPlanner,
  SaveGameArchive,
  ShaderVariantCollection,
  WorldPartitionGrid
} from '../src/index.js';

describe('engine pattern scalability optimization pack', () => {
  it('streams Unreal-style world partition cells with active runtime data layers', () => {
    const grid = new WorldPartitionGrid({
      cellSize: 100,
      actors: [
        { id: 'tree', x: 10, y: 10, layers: ['base'] },
        { id: 'ghost', x: 20, y: 20, layers: ['night'] },
        { id: 'cave', x: 240, y: 10, layers: ['base'] },
        { id: 'marker', x: 420, y: 0, spatial: false }
      ]
    });

    const day = grid.evaluate({
      sources: [{ x: 0, y: 0, radius: 160 }],
      activeLayers: ['base']
    });
    expect(day.loadedActors.map((actor) => actor.id)).toEqual(['marker', 'tree']);
    expect(day.unloadedActors.map((actor) => actor.id)).toEqual(['cave', 'ghost']);

    const night = grid.evaluate({
      sources: [{ x: 0, y: 0, radius: 160 }],
      activeLayers: ['base', 'night']
    });
    expect(night.loadedActors.map((actor) => actor.id)).toEqual(['ghost', 'marker', 'tree']);
    expect(night.loadedCells).toContain('0,0');
  });

  it('plans Unity-style render graph passes and culls unused work', () => {
    const graph = new RenderGraphPlanner()
      .addPass('gbuffer', { writes: ['albedo', 'depth'] })
      .addPass('lighting', { reads: ['albedo', 'depth'], writes: ['lit'] })
      .addPass('bloom', { reads: ['lit'], writes: ['bloomTexture'] })
      .addPass('present', { reads: ['lit'], writes: ['backbuffer'], sideEffect: true })
      .addPass('debugOverlay', { writes: ['debugTexture'] });

    const plan = graph.compile({ outputs: ['backbuffer'] });

    expect(plan.order.map((pass) => pass.name)).toEqual(['gbuffer', 'lighting', 'present']);
    expect(plan.culled).toEqual(['bloom', 'debugOverlay']);
    expect(plan.resources).toMatchObject({
      albedo: { producer: 'gbuffer', consumers: ['lighting'] },
      lit: { producer: 'lighting', consumers: ['present'] },
      backbuffer: { producer: 'present', consumers: [] }
    });
  });

  it('deduplicates, strips, and prepares Unity-style shader variants for warmup', () => {
    const variants = new ShaderVariantCollection()
      .add({ shader: 'SpriteLit', pass: 'Forward', keywords: ['FOG'], platforms: ['web'], features: ['fog'] })
      .add({ shader: 'SpriteLit', pass: 'Forward', keywords: ['FOG'], platforms: ['web'], features: ['fog'] })
      .add({ shader: 'SpriteLit', pass: 'Shadow', keywords: ['SHADOWS'], platforms: ['native'], features: ['shadows'] })
      .trackRuntimeUse('SpriteUnlit', { pass: 'Forward', keywords: [], platforms: ['web'] });

    const stripped = variants.strip({ platform: 'web', enabledFeatures: ['fog'] });

    expect(stripped.kept.map((entry) => entry.key)).toEqual([
      'SpriteLit|Forward|FOG',
      'SpriteUnlit|Forward|'
    ]);
    expect(stripped.stripped.map((entry) => entry.key)).toEqual(['SpriteLit|Shadow|SHADOWS']);
    expect(variants.warmupPlan({ platform: 'web', enabledFeatures: ['fog'] }).map((entry) => entry.shader)).toEqual([
      'SpriteLit',
      'SpriteUnlit'
    ]);
  });

  it('resolves prioritized input action contexts with thresholds and modifiers', () => {
    const input = new InputActionContextStack()
      .addContext('gameplay', {
        priority: 0,
        actions: {
          Interact: [{ control: 'Keyboard/E', value: true }],
          MoveX: [{ control: 'Gamepad/LeftX', threshold: 0.25, modifier: 'scale', scale: 2 }]
        }
      })
      .addContext('vehicle', {
        priority: 10,
        actions: {
          ExitVehicle: [{ control: 'Keyboard/E', value: true }]
        }
      })
      .enable('gameplay')
      .enable('vehicle');

    expect(input.resolve({ control: 'Keyboard/E', value: 1 })).toMatchObject({
      action: 'ExitVehicle',
      context: 'vehicle',
      value: true
    });
    expect(input.resolve({ control: 'Gamepad/LeftX', value: 0.1 })).toBeNull();
    expect(input.resolve({ control: 'Gamepad/LeftX', value: 0.75 })).toMatchObject({
      action: 'MoveX',
      context: 'gameplay',
      value: 1.5
    });
  });

  it('saves Unreal-style user slots and migrates SaveGame schema versions', () => {
    const archive = new SaveGameArchive();
    archive.registerSchema('player', {
      version: 2,
      migrate(record) {
        if (record.version !== 1) return record;
        return {
          ...record,
          version: 2,
          data: {
            coins: record.data.coins,
            scene: record.data.level
          }
        };
      }
    });

    archive.save('autosave', {
      userId: 'p1',
      schema: 'player',
      version: 1,
      data: { coins: 7, level: 'forest' }
    });

    expect(archive.load('autosave', { userId: 'p1' })).toMatchObject({
      slot: 'autosave',
      userId: 'p1',
      schema: 'player',
      version: 2,
      data: { coins: 7, scene: 'forest' }
    });
    expect(archive.listSlots('p1')).toEqual(['autosave']);
  });
});
