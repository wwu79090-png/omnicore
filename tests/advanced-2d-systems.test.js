import { describe, expect, it, vi } from 'vitest';
import OmniCore, {
  AudioManager,
  Camera,
  Light2D,
  MarketplaceServer,
  PhysicsWorld,
  Tilemap
} from '../src/index.js';
import PhysicsAddon from '../src/lean/addons/Physics.js';

describe('advanced 2D lighting and visual shader graph', () => {
  it('builds a WebGPU-ready normal-map lighting pass from visual nodes', () => {
    const pipeline = Light2D.createNormalPipeline({
      surface: {
        texture: 'world-color',
        normalMap: 'world-normal',
        size: { width: 320, height: 180 }
      },
      nodes: [
        { id: 'albedo', type: 'texture', texture: 'world-color' },
        { id: 'normal', type: 'normalMap', texture: 'world-normal', strength: 0.75 },
        { id: 'torch', type: 'pointLight', x: 64, y: 96, radius: 128, color: '#ffaa66', intensity: 0.8 },
        { id: 'tree', type: 'occluder', x: 80, y: 80, width: 16, height: 48 }
      ],
      edges: [
        { from: 'albedo', to: 'lighting' },
        { from: 'normal', to: 'lighting' },
        { from: 'torch', to: 'lighting' }
      ]
    });

    expect(pipeline.backend).toBe('webgpu');
    expect(pipeline.shader.wgsl).toContain('normalSample');
    expect(pipeline.lights).toEqual([
      expect.objectContaining({ type: 'point', x: 64, y: 96, normalStrength: 0.75 })
    ]);
    expect(pipeline.shadowCasters).toEqual([expect.objectContaining({ id: 'tree', width: 16 })]);
    expect(pipeline.commands).toContainEqual(expect.objectContaining({
      op: 'light2d:normal-pass',
      colorTexture: 'world-color',
      normalMap: 'world-normal'
    }));
  });
});

describe('2D navigation mesh and navigation agents', () => {
  it('bakes walkable cells from Tilemap collision tiles and moves an agent along the path', () => {
    const map = Tilemap.parse({
      width: 5,
      height: 3,
      tilewidth: 16,
      tileheight: 16,
      layers: [
        {
          id: 1,
          name: 'Ground',
          type: 'tilelayer',
          width: 5,
          height: 3,
          data: [
            0, 0, 1, 0, 0,
            0, 0, 1, 0, 0,
            0, 0, 0, 0, 0
          ]
        }
      ]
    });

    const navmesh = map.bakeNavigationMesh('Ground', { blockedTileIds: [1] });
    const path = navmesh.findPath({ x: 0, y: 0 }, { x: 4, y: 0 });
    const agent = new OmniCore.NavigationAgent2D({
      navmesh,
      position: { x: 8, y: 8 },
      speed: 16
    });

    agent.setTarget({ x: 72, y: 8 });
    agent.update(1);

    expect(navmesh.grid).toEqual([
      [0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0]
    ]);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path.at(-1)).toEqual({ x: 4, y: 0 });
    expect(path).not.toContainEqual({ x: 2, y: 0 });
    expect(path).not.toContainEqual({ x: 2, y: 1 });
    expect(agent.path.at(-1)).toEqual({ x: 4, y: 0 });
    expect(agent.position.x).toBeGreaterThan(8);
  });
});

describe('audio bus mixing and ducking', () => {
  it('routes playback through named buses and applies ducking without losing the base volume', () => {
    const context = createAudioContextSpy();
    const audio = new AudioManager({ context });
    audio.buffers.set('theme', { duration: 1 });

    audio.createBus('bgm', { volume: 0.8 });
    audio.createBus('dialogue', { volume: 1 });
    const source = audio.play('theme', { bus: 'bgm', volume: 0.5, loop: true });
    const duck = audio.duck('bgm', { amount: 0.25, trigger: 'dialogue' });

    expect(source.loop).toBe(true);
    expect(source.omniBus).toBe('bgm');
    expect(audio.getBus('bgm')).toMatchObject({ name: 'bgm', volume: 0.8, effectiveVolume: 0.2 });
    expect(duck).toMatchObject({ bus: 'bgm', trigger: 'dialogue', amount: 0.25 });

    audio.releaseDucking('bgm');

    expect(audio.getBus('bgm')).toMatchObject({ name: 'bgm', volume: 0.8, effectiveVolume: 0.8 });
  });
});

describe('2D camera constraints, parallax, rotation follow, and shake', () => {
  it('clamps camera movement to map bounds and computes parallax transforms', () => {
    const camera = new Camera({ x: 0, y: 0 });
    const target = { x: 400, y: 200, rotation: Math.PI / 4 };

    camera
      .setViewport({ width: 100, height: 80 })
      .setBounds({ x: 0, y: 0, width: 320, height: 180 })
      .follow(target, { lerp: 1 })
      .followRotation(target, { lerp: 1 })
      .addParallaxLayer({ id: 'forest-bg' }, { factorX: 0.5, factorY: 0.25 })
      .shake({ duration: 300, intensity: 6 });

    camera.update(16);

    expect(camera.x).toBe(220);
    expect(camera.y).toBe(100);
    expect(camera.rotation).toBeCloseTo(Math.PI / 4);
    expect(camera.getParallaxTransforms()).toEqual([
      expect.objectContaining({ id: 'forest-bg', x: -110, y: -25 })
    ]);
    expect(camera.getViewTransform()).toMatchObject({
      x: 220,
      y: 100,
      zoom: 1,
      rotation: Math.PI / 4
    });
    expect(Math.abs(camera.offsetX)).toBeLessThanOrEqual(6);
    expect(Math.abs(camera.offsetY)).toBeLessThanOrEqual(6);
  });
});

describe('2D physics materials for tilemaps and Matter bodies', () => {
  it('resolves per-tile physics materials and applies them to world and Matter bodies', () => {
    const map = Tilemap.parse({
      width: 2,
      height: 1,
      tilewidth: 16,
      tileheight: 16,
      tilesets: [
        {
          firstgid: 1,
          tiles: [
            {
              id: 0,
              properties: [
                { name: 'physicsMaterial', value: 'ice' },
                { name: 'friction', value: 0.1 },
                { name: 'restitution', value: 0.02 },
                { name: 'speedMultiplier', value: 1.15 }
              ]
            },
            {
              id: 1,
              properties: {
                physicsMaterial: 'sand',
                friction: 0.8,
                restitution: 0,
                speedMultiplier: 0.6
              }
            }
          ]
        }
      ],
      layers: [
        { id: 1, name: 'Ground', type: 'tilelayer', width: 2, height: 1, data: [1, 2] }
      ]
    });
    const world = new PhysicsWorld();
    const body = {};
    const Matter = createMatterSpy();
    const physics = new PhysicsAddon({ matter: Matter }).mount();

    world.registerMaterial('ice', { friction: 0.1, restitution: 0.02, speedMultiplier: 1.15 });
    world.applyMaterial(body, 'ice');
    physics.registerMaterial('rubber', { friction: 0.8, restitution: 0.9 });
    physics.attachBody({ x: 0, y: 0, width: 16, height: 16 }, { material: 'rubber' });

    expect(map.getTilePhysicsMaterial('Ground', 0, 0)).toMatchObject({ name: 'ice', friction: 0.1 });
    expect(map.createPhysicsMaterialMap('Ground').cells[0][1]).toMatchObject({ name: 'sand', speedMultiplier: 0.6 });
    expect(world.materialAt(map, 'Ground', { x: 8, y: 8 })).toMatchObject({ name: 'ice', friction: 0.1 });
    expect(body).toMatchObject({ friction: 0.1, restitution: 0.02, speedMultiplier: 1.15 });
    expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(8, 8, 16, 16, expect.objectContaining({
      friction: 0.8,
      restitution: 0.9,
      plugin: expect.objectContaining({ physicsMaterial: 'rubber' })
    }));
  });
});

describe('marketplace asset review, moderation, and sponsorship', () => {
  it('keeps uploaded assets pending until review and records sponsor funding', () => {
    const marketplace = new MarketplaceServer({ encryptionKey: 'secret' });

    marketplace.submitPlugin({
      name: 'lighting-pack',
      version: '1.0.0',
      developerId: 'dev-a',
      priceCents: 1000,
      packageData: 'bundle'
    });
    marketplace.addComment('lighting-pack', { userId: 'player-1', body: 'looks useful' });
    marketplace.reviewPlugin('lighting-pack', { reviewerId: 'mod-1', approved: true, notes: 'safe' });
    marketplace.moderateComment('lighting-pack', 0, { moderatorId: 'mod-1', approved: true });
    marketplace.sponsor('dev-a', { sponsorId: 'player-1', amountCents: 500, tier: 'supporter' });

    expect(marketplace.listPlugins()).toEqual([
      expect.objectContaining({ name: 'lighting-pack', status: 'approved' })
    ]);
    expect(marketplace.getComments('lighting-pack')).toEqual([
      expect.objectContaining({ userId: 'player-1', status: 'approved' })
    ]);
    expect(marketplace.getSponsorSummary('dev-a')).toMatchObject({
      developerId: 'dev-a',
      sponsors: 1,
      totalCents: 500
    });
    expect(marketplace.downloadPaid('lighting-pack', { buyerId: 'player-1', paid: true })?.split)
      .toMatchObject({ developerId: 'dev-a', developerCents: 700, platformCents: 300 });
  });
});

function createAudioContextSpy() {
  const destination = { name: 'destination' };
  return {
    currentTime: 1,
    destination,
    createBufferSource: vi.fn(() => ({
      connect(target) {
        this.connectedTo = target;
        return target;
      },
      start: vi.fn(),
      stop: vi.fn(),
      loop: false
    })),
    createGain: vi.fn(() => ({
      gain: {
        value: 1,
        setValueAtTime(value) {
          this.value = value;
        },
        linearRampToValueAtTime(value) {
          this.value = value;
        },
        exponentialRampToValueAtTime(value) {
          this.value = value;
        }
      },
      connect(target) {
        this.connectedTo = target;
        return target;
      }
    }))
  };
}

function createMatterSpy() {
  const added = [];
  return {
    Engine: { create: () => ({ world: { bodies: added } }) },
    Bodies: {
      rectangle: vi.fn((x, y, width, height, options = {}) => ({
        position: { x, y },
        width,
        height,
        ...options
      }))
    },
    Composite: { add: vi.fn((world, body) => world.bodies.push(body)) },
    Events: { on: vi.fn() }
  };
}
