import { describe, expect, it, vi } from 'vitest';
import OmniCore, {
  BehaviorTree,
  PixiRenderer,
  Scene,
  SleepWakeSystem,
  Sprite,
  ViewportCulling,
  WorkerManager
} from '../src/index.js';

describe('viewport culling and sleep wake systems', () => {
  it('skips offscreen sprite updates while preserving visible updates', () => {
    const scene = new Scene('rpg');
    const visible = scene.add(new Sprite('visible', { x: 20, y: 20, width: 16, height: 16 }));
    const offscreen = scene.add(new Sprite('offscreen', { x: 5000, y: 5000, width: 16, height: 16 }));
    visible.update = vi.fn();
    offscreen.update = vi.fn();
    scene.game = {
      culling: new ViewportCulling({ viewport: { x: 0, y: 0, width: 320, height: 180 } })
    };

    scene.update(16, 16);

    expect(visible.update).toHaveBeenCalledTimes(1);
    expect(offscreen.update).not.toHaveBeenCalled();
    expect(offscreen.__omnicoreCulled).toBe(true);
  });

  it('skips entities suspended by target FPS hard-maintain mode', () => {
    const scene = new Scene('hard-maintain');
    const suspended = scene.add(new Sprite('dust', { x: 20, y: 20, width: 16, height: 16 }));
    const hero = scene.add(new Sprite('hero', { x: 24, y: 24, width: 16, height: 16 }));
    suspended.__omnicoreSkipUpdate = true;
    suspended.update = vi.fn();
    hero.update = vi.fn();
    scene.game = {
      culling: new ViewportCulling({ enabled: false })
    };

    scene.update(16, 16);

    expect(suspended.update).not.toHaveBeenCalled();
    expect(hero.update).toHaveBeenCalledTimes(1);
  });

  it('warns when an offscreen entity keeps running logic for multiple frames', () => {
    const warning = vi.fn();
    const scene = new Scene('logic-warning');
    const offscreen = scene.add(new Sprite('crate', {
      x: 5000,
      y: 5000,
      width: 16,
      height: 16
    }));
    offscreen.id = 'crate-edge';
    offscreen.alwaysUpdate = true;
    offscreen.update = vi.fn();
    scene.game = {
      culling: new ViewportCulling({
        viewport: { x: 0, y: 0, width: 320, height: 180 },
        offscreenUpdateWarningFrames: 2,
        onLogicWarning: warning
      })
    };

    scene.update(16, 16);
    scene.update(16, 32);
    scene.update(16, 48);

    expect(offscreen.update).toHaveBeenCalledTimes(3);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(expect.objectContaining({
      type: 'offscreen-logic-active',
      entityId: 'crate-edge',
      framesOffscreen: 2,
      recommendation: expect.stringContaining('sleep')
    }));
  });

  it('skips offscreen canvas render calls', () => {
    const scene = new Scene('render');
    const visible = scene.add(new Sprite('visible', { x: 10, y: 10, width: 16, height: 16 }));
    const offscreen = scene.add(new Sprite('offscreen', { x: 1000, y: 1000, width: 16, height: 16 }));
    visible.render = vi.fn();
    offscreen.render = vi.fn();
    scene.game = {
      culling: new ViewportCulling({ viewport: { x: 0, y: 0, width: 200, height: 120 } })
    };
    const renderer = new PixiRenderer({
      backend: 'canvas',
      canvas: document.createElement('canvas'),
      width: 200,
      height: 120
    });
    renderer.ctx = renderer.canvas.getContext('2d');

    renderer.renderScene(scene);

    expect(visible.render).toHaveBeenCalledTimes(1);
    expect(offscreen.render).not.toHaveBeenCalled();
  });

  it('sleeps distant NPCs and wakes them when the player approaches', () => {
    const player = { x: 0, y: 0 };
    const npc = new Sprite('npc', { x: 800, y: 0, width: 16, height: 16 });
    npc.kind = 'npc';
    npc.update = vi.fn();
    const scene = new Scene('sleep');
    scene.add(npc);
    scene.game = {
      player,
      sleepWake: new SleepWakeSystem({ player, distance: 128 })
    };

    scene.update(16, 16);

    expect(npc.update).not.toHaveBeenCalled();
    expect(npc.sleeping).toBe(true);

    player.x = 760;
    scene.update(16, 32);

    expect(npc.update).toHaveBeenCalledTimes(1);
    expect(npc.sleeping).toBe(false);
  });

  it('wires culling and sleep systems onto OmniCore.Game without headless rendering', async () => {
    const game = await new OmniCore.Game({
      autoStart: false,
      headless: true,
      culling: { viewport: { x: 0, y: 0, width: 64, height: 64 } },
      sleepWake: { distance: 32 }
    }).init();

    expect(game.culling).toBeInstanceOf(ViewportCulling);
    expect(game.sleepWake).toBeInstanceOf(SleepWakeSystem);

    game.destroy();
  });
});

describe('behavior tree and worker runtime tasks', () => {
  it('runs JSON behavior tree branches with sequence and selector semantics', () => {
    const calls = [];
    const tree = BehaviorTree.fromJSON({
      type: 'selector',
      children: [
        {
          type: 'sequence',
          children: [
            { type: 'condition', op: 'exists', target: 'entities.player' },
            {
              type: 'condition',
              op: 'distanceLessThan',
              left: 'entities.player',
              right: 'entities.enemy',
              distance: 5
            },
            { type: 'action', op: 'call', name: 'attack' }
          ]
        },
        { type: 'action', op: 'call', name: 'patrol' }
      ]
    });
    const runtime = {
      entities: {
        player: { x: 0, y: 0 },
        enemy: { x: 2, y: 3 }
      },
      actions: {
        attack: () => calls.push('attack'),
        patrol: () => calls.push('patrol')
      }
    };

    expect(tree.tick(runtime)).toBe('success');
    runtime.entities.enemy.x = 20;
    expect(tree.tick(runtime)).toBe('success');

    expect(calls).toEqual(['attack', 'patrol']);
  });

  it('executes built-in worker tasks for pathfinding and collision batches', async () => {
    const worker = new WorkerManager({ workerFactory: null }).registerBuiltins();
    const path = await worker.run('astar', {
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      grid: [[0, 0, 0]]
    });
    const collisions = await worker.run('batchCollisions', {
      rects: [
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 5, y: 5, width: 10, height: 10 },
        { id: 'c', x: 40, y: 40, width: 10, height: 10 }
      ]
    });

    expect(path).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(collisions).toEqual([{ a: 'a', b: 'b' }]);
  });
});
