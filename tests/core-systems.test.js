import { afterEach, describe, expect, it, vi } from 'vitest';
import EventBus from '../src/core/EventBus.js';
import { EntitySpatialIndex } from '../src/core/EntitySpatialIndex.js';
import { TaskManager } from '../src/core/TaskManager.js';
import InputManager from '../src/input/InputManager.js';
import Store from '../src/store/Store.js';
import OmniCore from '../src/index.js';

describe('generator coroutine task manager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resumes generator tasks from an independent 1ms timer loop', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const raf = vi.fn(() => {
      throw new Error('TaskManager must not use requestAnimationFrame');
    });
    const previousRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;
    const task = new TaskManager({ now: () => Date.now() });
    const calls = [];

    task.start(function* run() {
      calls.push(`start:${Date.now()}`);
      yield task.wait(50);
      calls.push(`first:${Date.now()}`);
      yield task.wait(25);
      calls.push(`second:${Date.now()}`);
    });

    await vi.advanceTimersByTimeAsync(49);
    expect(calls).toEqual(['start:0']);

    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual(['start:0', 'first:50']);

    await vi.advanceTimersByTimeAsync(24);
    expect(calls).toEqual(['start:0', 'first:50']);

    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual(['start:0', 'first:50', 'second:75']);
    expect(raf).not.toHaveBeenCalled();

    task.clear();
    globalThis.requestAnimationFrame = previousRaf;
  });

  it('can cancel a suspended task before its wait expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const task = new TaskManager({ now: () => Date.now() });
    const calls = [];

    const handle = task.start(function* run() {
      calls.push('start');
      yield task.wait(10);
      calls.push('after-wait');
    });

    handle.cancel();
    await vi.advanceTimersByTimeAsync(10);

    expect(calls).toEqual(['start']);
    expect(handle.cancelled).toBe(true);
    task.clear();
  });
});

describe('grid spatial entity index', () => {
  it('updates entity cell membership automatically when x or y changes', () => {
    const index = new EntitySpatialIndex({ cellSize: 32 });
    const enemy = { id: 'enemy-1', kind: 'enemy', x: 10, y: 10 };

    index.add(enemy);
    expect(index.inRadius(10, 10, 4)).toEqual([enemy]);

    enemy.x = 96;
    enemy.y = 96;

    expect(index.inRadius(10, 10, 8)).toEqual([]);
    expect(index.inRadius(96, 96, 1)).toEqual([enemy]);
  });

  it('limits inRadius work to touched grid cells for 1000 static entities', () => {
    const index = new EntitySpatialIndex({ cellSize: 32 });
    for (let id = 0; id < 1000; id += 1) {
      index.add({
        id,
        x: (id % 100) * 32 + 16,
        y: Math.floor(id / 100) * 32 + 16
      });
    }

    const hits = index.inRadius(16, 16, 16);
    const stats = index.lastQueryStats;

    expect(hits).toHaveLength(1);
    expect(stats.entities).toBe(1000);
    expect(stats.candidates).toBeLessThanOrEqual(20);
    expect(stats.estimatedSpeedup).toBeGreaterThanOrEqual(50);
  });
});

describe('Store derived dependency graph', () => {
  it('derives values from dependencies and recomputes them in one microtask batch', async () => {
    const store = new Store({ hp: 50, max_hp: 100 });
    let computes = 0;

    store.derive('hp_percent', ['hp', 'max_hp'], ({ hp, max_hp: maxHp }) => {
      computes += 1;
      return maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
    });

    expect(store.get('hp_percent')).toBe(50);

    store.set('hp', 25);
    store.set('max_hp', 50);
    await Promise.resolve();

    expect(store.get('hp_percent')).toBe(50);
    expect(computes).toBe(2);
  });

  it('stores dependency edges as weak references and prunes removed derived values', () => {
    const store = new Store({ hp: 1, max_hp: 2 });
    const dispose = store.derive('hp_percent', ['hp', 'max_hp'], ({ hp, max_hp: maxHp }) => hp / maxHp);
    const hpEdges = [...store.dependencyGraph.get('hp')];

    expect(hpEdges[0].deref().name).toBe('hp_percent');

    dispose();

    expect(store.dependencyGraph.get('hp')).toBeUndefined();
    expect(store.get('hp_percent')).toBeUndefined();
  });
});

describe('input action remapping', () => {
  it('maps Ctrl+K to an action event without exposing raw keydown on the EventBus', () => {
    const canvas = document.createElement('canvas');
    const events = new EventBus();
    const input = new InputManager({ target: canvas, events });
    const action = vi.fn();
    const rawKeydown = vi.fn();

    events.on('action:command', action);
    events.on('keydown', rawKeydown);
    input.bind('command', 'Ctrl+K');

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Control',
      code: 'ControlLeft',
      ctrlKey: true
    }));
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true
    }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith(expect.objectContaining({
      action: 'command',
      combo: 'Ctrl+K',
      down: true
    }));
    expect(rawKeydown).not.toHaveBeenCalled();

    input.destroy();
  });
});

describe('OmniCore namespace integration', () => {
  it('exposes Task and Query namespaces alongside Store.derive and Input.bind', () => {
    expect(typeof OmniCore.Task.start).toBe('function');
    expect(typeof OmniCore.Task.wait).toBe('function');
    expect(typeof OmniCore.Query.inRadius).toBe('function');
    expect(typeof OmniCore.Store.prototype.derive).toBe('function');
    expect(typeof OmniCore.InputManager.prototype.bind).toBe('function');
  });
});
