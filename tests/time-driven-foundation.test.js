import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import Loop from '../src/loop/Loop.js';
import Scene from '../src/scene/Scene.js';
import SceneManager from '../src/scene/SceneManager.js';
import Store from '../src/store/Store.js';
import InputManager from '../src/input/InputManager.js';
import Dimension3D from '../src/dimension3d/Dimension3D.js';

describe('time-driven runtime foundation', () => {
  it('does not cap Loop updates by default on high refresh frames', () => {
    const loop = new Loop({ vsync: false, warnTimeJumps: false });
    const updates = [];
    const renders = [];
    loop.running = true;
    loop.lastTime = 0;
    loop._schedule = vi.fn();
    loop.subscribe((delta, time, alpha) => updates.push({ delta, time, alpha }));
    loop.subscribeRender((alpha, time, frame) => renders.push({ alpha, time, frame }));

    loop._tick(8);
    loop._tick(16);

    expect(loop.uncapped).toBe(true);
    expect(loop.framerateCap).toBeNull();
    expect(updates.map((item) => item.delta)).toEqual([0.008, 0.008]);
    expect(renders).toHaveLength(2);
  });

  it('runs deterministic fixed updates and one interpolated render per display frame', () => {
    const loop60 = createManualLoop();
    const loop30 = createManualLoop();
    const fixed60 = [];
    const fixed30 = [];
    const renders60 = [];
    const renders30 = [];

    loop60.subscribe((delta, time, alpha) => fixed60.push({ delta, time, alpha }));
    loop60.subscribeRender((alpha, time, frame) => renders60.push({ alpha, time, frame }));
    loop30.subscribe((delta, time, alpha) => fixed30.push({ delta, time, alpha }));
    loop30.subscribeRender((alpha, time, frame) => renders30.push({ alpha, time, frame }));

    loop60._tick(1000 / 60);
    loop30._tick(1000 / 30);

    expect(fixed60.map((item) => item.delta)).toEqual([1 / 60]);
    expect(fixed30.map((item) => item.delta)).toEqual([1 / 60, 1 / 60]);
    expect(renders60).toHaveLength(1);
    expect(renders30).toHaveLength(1);
    expect(renders60[0].alpha).toBeGreaterThanOrEqual(0);
    expect(renders60[0].alpha).toBeLessThan(1);
    expect(renders30[0].alpha).toBeGreaterThanOrEqual(0);
    expect(renders30[0].alpha).toBeLessThan(1);
  });

  it('runs input refresh, scene update, Store commit, scene render, and renderer in order', async () => {
    const loop = createCapturedLoop();
    const order = [];
    const store = new Store({ score: 0 });
    const scene = new Scene('play');
    scene.onEnter = vi.fn(() => order.push('enter'));
    scene.onUpdate = vi.fn(() => {
      order.push(`update:${store.get('score')}`);
      store.set('score', 1);
      order.push(`dirty-read:${store.get('score')}`);
    });
    scene.onRender = vi.fn((alpha) => order.push(`render:${alpha}:${store.get('score')}`));
    scene.onExit = vi.fn(() => order.push('exit'));
    const game = {
      store,
      input: { refresh: vi.fn(() => order.push('input')) },
      camera: { update: vi.fn(() => order.push('camera')) },
      renderer: { renderScene: vi.fn(() => order.push('renderer')), fade: vi.fn(() => Promise.resolve()) },
      loop,
      events: { emit: vi.fn() }
    };
    const manager = new SceneManager(game);
    manager.register(scene);

    await manager.push('play');
    loop.update(1 / 60, 16, 0);
    loop.render(0.5, 16, { frame: 1 });
    await manager.pop();

    expect(scene.onEnter).toHaveBeenCalledTimes(1);
    expect(scene.onUpdate).toHaveBeenCalledWith(1 / 60, 16, scene);
    expect(scene.onRender).toHaveBeenCalledWith(0.5, 16, scene);
    expect(scene.onExit).toHaveBeenCalledTimes(1);
    expect(order).toEqual([
      'enter',
      'renderer',
      'input',
      'camera',
      'update:0',
      'dirty-read:0',
      'render:0.5:1',
      'renderer',
      'exit',
      'renderer'
    ]);
  });

  it('stages Store writes until commit during a frame', () => {
    const store = new Store({ hp: 10 });
    const changes = [];
    store.subscribe('hp', (value) => changes.push(value));

    store.beginFrame();
    store.set('hp', 3);

    expect(store.get('hp')).toBe(10);
    expect(store.hasPendingCommits()).toBe(true);

    store.commit();

    expect(store.get('hp')).toBe(3);
    expect(changes.at(-1)).toBe(3);
  });

  it('provides independent Scene timer delay and interval tasks', () => {
    const scene = new Scene('timed');
    const calls = [];
    const interval = scene.timer.interval(16, () => calls.push('interval'));
    scene.timer.delay(32, () => calls.push('delay'));

    scene.update(1 / 60, 16);
    scene.update(1 / 60, 32);
    interval.clear();
    scene.update(1 / 60, 48);

    expect(calls).toEqual(['interval', 'interval', 'delay']);
  });

  it('lets InputManager refresh expose frame snapshots before game logic reads them', () => {
    const input = new InputManager({ target: null });
    input.keyboard.press('KeyA');
    const snapshot = input.refresh(1 / 60, 16);

    expect(snapshot.keyboard.isDown('A')).toBe(true);
    expect(input.lastFrame).toMatchObject({ delta: 1 / 60, time: 16 });
  });

  it('binds Dimension3D model rotation to game.time.delta when render delta is omitted', () => {
    const dimension = new Dimension3D();
    dimension.bindGameTime({ delta: 0.25 });
    dimension.renderer = { render: vi.fn() };
    dimension.scene = {};
    dimension.camera = {};
    dimension.models = [{
      root: { rotation: { x: 0, y: 0, z: 0 } },
      rotationSpeed: { x: 0, y: 2, z: 0 },
      mixer: { update: vi.fn() }
    }];

    dimension.render();

    expect(dimension.models[0].root.rotation.y).toBe(0.5);
    expect(dimension.models[0].mixer.update).toHaveBeenCalledWith(0.25);
  });

  it('ships a migration demo that exercises the time-driven loop', () => {
    expect(existsSync('examples/migration-demo.html')).toBe(true);
  });
});

function createManualLoop() {
  const loop = new Loop({ fps: 60, framerateCap: 60, vsync: false, warnTimeJumps: false });
  loop.running = true;
  loop.lastTime = 0;
  loop._schedule = vi.fn();
  return loop;
}

function createCapturedLoop() {
  const listeners = { update: null, render: null };
  return {
    frame: 0,
    subscribe(handler) {
      listeners.update = handler;
      return () => {
        listeners.update = null;
      };
    },
    subscribeRender(handler) {
      listeners.render = handler;
      return () => {
        listeners.render = null;
      };
    },
    update(delta, time, alpha) {
      listeners.update?.(delta, time, alpha);
    },
    render(alpha, time, frame) {
      listeners.render?.(alpha, time, frame);
    }
  };
}
