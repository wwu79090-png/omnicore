import { describe, expect, it, vi } from 'vitest';
import EventSheet from '../src/data/EventSheet.js';
import PixiRenderer from '../src/renderer/PixiRenderer.js';
import WorkerManager from '../src/worker/WorkerManager.js';
import PhysicsAddon from '../src/lean/addons/Physics.js';
import Tilemap from '../src/tilemap/Tilemap.js';

describe('performance refactor coverage', () => {
  it('syncs Pixi scenes incrementally and reuses pooled display objects', () => {
    const stage = {
      children: [],
      addChild: vi.fn((child) => {
        stage.children.push(child);
      }),
      removeChild: vi.fn((child) => {
        stage.children = stage.children.filter((item) => item !== child);
      }),
      removeChildren: vi.fn()
    };
    const renderer = new PixiRenderer();
    renderer.stage = stage;
    renderer.app = { renderer: { render: vi.fn() }, stage };
    const createDisplay = (label) => ({ label, destroyed: false });
    const first = {
      id: 'first',
      type: 'marker',
      toPixiObject: vi.fn(() => createDisplay('first')),
      syncPixiObject: vi.fn()
    };
    const second = {
      id: 'second',
      type: 'marker',
      toPixiObject: vi.fn(() => createDisplay('second')),
      syncPixiObject: vi.fn()
    };

    renderer.renderScene({ children: [first, second] });
    const firstDisplay = first.displayObject;
    const secondDisplay = second.displayObject;
    renderer.renderScene({ children: [second] });
    const third = {
      id: 'third',
      type: 'marker',
      toPixiObject: vi.fn(() => createDisplay('third')),
      syncPixiObject: vi.fn()
    };
    renderer.renderScene({ children: [second, third] });

    expect(stage.removeChildren).not.toHaveBeenCalled();
    expect(stage.removeChild).toHaveBeenCalledWith(firstDisplay);
    expect(second.displayObject).toBe(secondDisplay);
    expect(third.displayObject).toBe(firstDisplay);
    expect(third.toPixiObject).not.toHaveBeenCalled();
    expect(renderer.lastSceneDiff).toMatchObject({
      added: 1,
      updated: 1,
      removed: 0,
      pooled: 1,
      total: 2
    });
  });

  it('rebuilds a display object when an entity changes pool type', () => {
    const stage = {
      children: [],
      addChild: vi.fn((child) => {
        if (!stage.children.includes(child)) stage.children.push(child);
      }),
      removeChild: vi.fn((child) => {
        stage.children = stage.children.filter((item) => item !== child);
      }),
      removeChildren: vi.fn()
    };
    const renderer = new PixiRenderer();
    renderer.stage = stage;
    renderer.app = { renderer: { render: vi.fn() }, stage };
    const entity = {
      id: 'morph',
      type: 'marker',
      poolKey: 'marker-a',
      toPixiObject: vi.fn(() => ({ label: 'a', destroyed: false })),
      syncPixiObject: vi.fn()
    };

    renderer.renderScene({ children: [entity] });
    const firstDisplay = entity.displayObject;
    entity.poolKey = 'marker-b';
    entity.toPixiObject = vi.fn(() => ({ label: 'b', destroyed: false }));
    renderer.renderScene({ children: [entity] });

    expect(stage.removeChildren).not.toHaveBeenCalled();
    expect(stage.removeChild).toHaveBeenCalledWith(firstDisplay);
    expect(entity.displayObject).not.toBe(firstDisplay);
    expect(renderer.displayPools.get('marker-a')).toContain(firstDisplay);
  });

  it('destroys Pixi applications even when the resize plugin hook is missing', () => {
    const renderer = new PixiRenderer();
    const parentNode = { removeChild: vi.fn() };
    const canvas = { parentNode };
    const app = {
      canvas,
      destroy: vi.fn(function destroy() {
        this._cancelResize();
      })
    };
    renderer.app = app;
    renderer.canvas = canvas;

    expect(() => renderer.destroy()).not.toThrow();
    expect(app.destroy).toHaveBeenCalledWith(
      { removeView: true },
      { children: true, texture: true, textureSource: true, context: true }
    );
    expect(parentNode.removeChild).toHaveBeenCalledWith(canvas);
  });

  it('runs registered pure functions through worker protocol and rejects stalled tasks', async () => {
    class FakeWorker {
      constructor() {
        this.postMessage = vi.fn((message) => {
          if (message.name === 'stall') return;
          const result = message.name === 'double' ? message.payload.value * 2 : null;
          Promise.resolve(result).then((resolved) => {
            this.onmessage?.({ data: { id: message.id, result: resolved } });
          });
        });
        this.terminate = vi.fn();
      }
    }

    const workers = new WorkerManager({
      workerFactory: () => new FakeWorker(),
      watchdogMs: 5
    });
    workers.register('double', ({ value }) => value * 2);
    workers.register('stall', () => 1);

    await expect(workers.run('double', { value: 21 })).resolves.toBe(42);
    await expect(workers.run('stall')).rejects.toThrow('[OmniCore] [Worker] 任务超时：stall，超过 5ms。');
    expect(workers.worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('evaluates nested AND/OR conditions with event-local scope and emits a debug tree', () => {
    const sheet = EventSheet.parse({
      debug: true,
      events: [
        {
          name: 'combo',
          scope: { combo: 2 },
          conditions: {
            op: 'and',
            conditions: [
              { op: 'equals', left: 'state.ready', right: true },
              {
                op: 'or',
                conditions: [
                  { op: 'gte', left: 'local.combo', right: 3 },
                  { op: 'equals', left: 'state.override', right: true }
                ]
              }
            ]
          },
          actions: [
            { op: 'set', target: 'local.combo', value: { $path: 'state.combo' } },
            { op: 'set', target: 'state.unlocked', value: { $path: 'local.combo' } }
          ]
        }
      ]
    });
    const runtime = { state: { ready: true, override: true, combo: 7 } };

    sheet.run(runtime);

    expect(runtime.state.unlocked).toBe(7);
    expect(runtime.local).toBeUndefined();
    expect(sheet.debugTree).toEqual([
      expect.objectContaining({
        name: 'combo',
        conditions: expect.objectContaining({
          op: 'and',
          children: [
            expect.objectContaining({ op: 'equals' }),
            expect.objectContaining({ op: 'or' })
          ]
        })
      })
    ]);
  });

  it('parses Tiled JSON layers and attaches Matter bodies to entities', () => {
    const map = Tilemap.parse({
      width: 2,
      height: 2,
      tilewidth: 16,
      tileheight: 16,
      layers: [
        { id: 1, name: 'Ground', type: 'tilelayer', width: 2, height: 2, data: [1, 0, 2, 0] },
        { id: 2, name: 'Objects', type: 'objectgroup', objects: [{ id: 9, name: 'Spawn', x: 16, y: 32 }] }
      ]
    });
    const added = [];
    const Matter = {
      Engine: { create: () => ({ world: { bodies: added } }), update: vi.fn() },
      Bodies: { rectangle: vi.fn((x, y, width, height, options) => ({ position: { x, y }, width, height, options })) },
      Composite: { add: vi.fn((world, body) => world.bodies.push(body)) }
    };
    const physics = new PhysicsAddon({ matter: Matter });
    const entity = { x: 16, y: 24, width: 8, height: 10 };

    physics.mount();
    const body = physics.attachBody(entity, { isStatic: true });
    physics.step(16);

    expect(map.getTileLayer('Ground').tileAt(0, 1)).toBe(2);
    expect(map.getObjectLayer('Objects').objects[0].name).toBe('Spawn');
    expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(20, 29, 8, 10, { isStatic: true });
    expect(entity.body).toBe(body);
    expect(added).toContain(body);
    expect(Matter.Engine.update).toHaveBeenCalledWith(physics.engine, 16);
  });

  it('compiles EventSheet conditions without dynamic Function construction', () => {
    const originalFunction = globalThis.Function;
    const functionCalls = [];
    globalThis.Function = function UnsafeDynamicFunction(...args) {
      functionCalls.push(args);
      throw new Error('dynamic Function disabled by CSP');
    };

    try {
      const sheet = EventSheet.parse({
        events: [
          {
            conditions: [{ op: 'gte', left: 'state.score', right: 10 }],
            actions: [{ op: 'set', target: 'state.win', value: true }]
          }
        ]
      }, { compile: true });
      const runtime = { state: { score: 12 } };

      expect(() => sheet.run(runtime)).not.toThrow();
      expect(runtime.state.win).toBe(true);
      expect(sheet.compiledNativeFunctions).toBe(1);
      expect(functionCalls).toEqual([]);
    } finally {
      globalThis.Function = originalFunction;
    }
  });

  it('keeps compiled condition cache keys distinct for different right-hand values', () => {
    const sheet = EventSheet.parse({
      events: [
        {
          conditions: {
            op: 'and',
            conditions: [
              { op: 'gt', left: 'state.score', right: 5 },
              { op: 'gt', left: 'state.score', right: 10 }
            ]
          },
          actions: [{ op: 'set', target: 'state.overpowered', value: true }]
        }
      ]
    }, { compile: true });
    const runtime = { state: { score: 7 } };

    sheet.run(runtime);

    expect(runtime.state.overpowered).toBeUndefined();
  });

  it('short-circuits nested AND conditions without evaluating skipped branches', () => {
    let skippedSideEffect = 0;
    const state = {};
    Object.defineProperty(state, 'ready', {
      get() {
        return false;
      }
    });
    Object.defineProperty(state, 'danger', {
      get() {
        skippedSideEffect += 1;
        return true;
      }
    });
    const sheet = EventSheet.parse({
      events: [
        {
          conditions: {
            op: 'and',
            conditions: [
              { op: 'gt', left: 'state.ready', right: 1 },
              { op: 'truthy', left: 'state.danger' }
            ]
          },
          actions: [{ op: 'set', target: 'state.blocked', value: true }]
        }
      ]
    });

    sheet.run({ state });

    expect(skippedSideEffect).toBe(0);
    expect(sheet._errors).toEqual([]);
    expect(state.blocked).toBeUndefined();
  });

  it('isolates action execution failures and still executes subsequent actions', () => {
    const sheet = EventSheet.parse({
      events: [
        {
          conditions: { op: 'truthy', left: 'state.ready' },
          actions: [
            { op: 'undefinedAction', target: 'state.invalid', value: true },
            { op: 'set', target: 'state.cleaned', value: true }
          ]
        },
        {
          conditions: { op: 'truthy', left: 'state.ready' },
          actions: [{ op: 'set', target: 'state.next', value: { $path: 'state.cleaned' } }]
        }
      ]
    });
    const runtime = { state: { ready: true } };

    sheet.run(runtime);

    expect(runtime.state.cleaned).toBe(true);
    expect(runtime.state.next).toBe(true);
    expect(sheet._errors).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'action' })]));
  });
});
