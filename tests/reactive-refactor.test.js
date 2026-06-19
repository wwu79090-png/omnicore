import { describe, expect, it, vi } from 'vitest';
import EventBus from '../src/core/EventBus.js';
import Store from '../src/store/Store.js';
import EventSheet from '../src/data/EventSheet.js';
import PixiRenderer from '../src/renderer/PixiRenderer.js';
import Scene from '../src/scene/Scene.js';
import SceneManager from '../src/scene/SceneManager.js';
import WorkerManager from '../src/worker/WorkerManager.js';

describe('reactive core refactor', () => {
  it('mounts and unmounts scenes from Store.currentScene changes', async () => {
    const store = new Store({ currentScene: null });
    const events = new EventBus();
    const emitted = [];
    events.on('scene:mount', (payload) => emitted.push(`mount:${payload.name}`));
    events.on('scene:unmount', (payload) => emitted.push(`unmount:${payload.name}`));
    const game = {
      store,
      events,
      renderer: { renderScene: vi.fn(), fade: vi.fn(() => Promise.resolve()) },
      loop: { subscribe: vi.fn(() => () => {}) }
    };
    const manager = new SceneManager(game);
    const level1 = new Scene('Level1');
    const level2 = new Scene('Level2');
    level1.create = vi.fn();
    level1.destroy = vi.fn();
    level2.create = vi.fn();

    manager.register(level1);
    manager.register(level2);

    store.set('currentScene', 'Level1');
    await manager.ready;
    store.set('currentScene', 'Level2');
    await manager.ready;

    expect(level1.create).toHaveBeenCalledTimes(1);
    expect(level1.destroy).toHaveBeenCalledTimes(1);
    expect(level2.create).toHaveBeenCalledTimes(1);
    expect(manager.current).toBe(level2);
    expect(emitted).toEqual(['mount:Level1', 'unmount:Level1', 'mount:Level2']);
  });

  it('applies renderer updates from Store.entities diffs without rebuilding unchanged sprites', () => {
    const store = new Store({ entities: [] });
    const events = new EventBus();
    const emitted = [];
    events.on('renderer:entity-add', (payload) => emitted.push(`add:${payload.id}`));
    events.on('renderer:entity-update', (payload) => emitted.push(`update:${payload.id}`));
    events.on('renderer:entity-remove', (payload) => emitted.push(`remove:${payload.id}`));
    const stage = {
      children: [],
      addChild: vi.fn((child) => stage.children.push(child)),
      removeChild: vi.fn((child) => {
        stage.children = stage.children.filter((item) => item !== child);
      }),
      removeChildren: vi.fn()
    };
    const renderer = new PixiRenderer({ store });
    renderer.stage = stage;
    renderer.app = { renderer: { render: vi.fn() }, stage };
    renderer.bindStore(store, events);

    store.set('entities', [{ id: 'hero', type: 'sprite', texture: 'hero', x: 10, y: 20 }]);
    const display = renderer.sceneDisplayObjects.get('sprite:hero').displayObject;
    store.set('entities', [{ id: 'hero', type: 'sprite', texture: 'hero', x: 30, y: 40 }]);
    store.set('entities', []);

    expect(stage.addChild).toHaveBeenCalledTimes(1);
    expect(stage.removeChild).toHaveBeenCalledWith(display);
    expect(stage.removeChildren).not.toHaveBeenCalled();
    expect(display.x).toBe(30);
    expect(display.y).toBe(40);
    expect(emitted).toEqual(['add:hero', 'update:hero', 'remove:hero']);
  });

  it('runs EventSheet as a scoped Store-reactive entity component', () => {
    const store = new Store({ hp: 10, aiState: 'idle' });
    const sheet = EventSheet.parse({
      scope: { alert: false },
      watch: ['hp'],
      events: [
        {
          conditions: [{ op: 'lt', left: 'store.hp', right: 5 }],
          actions: [
            { op: 'set', target: 'local.alert', value: true },
            { op: 'set', target: 'store.aiState', value: 'flee' }
          ]
        }
      ]
    });

    sheet.attach({ store });
    store.set('hp', 3);

    expect(sheet.scope.alert).toBe(true);
    expect(store.get('aiState')).toBe('flee');

    sheet.detach();
  });

  it('posts Store slices to worker tasks and writes results back into Store', async () => {
    const store = new Store({ values: [2, 4, 6], total: 0 });
    const events = new EventBus();
    const emitted = [];
    events.on('worker:sync', (payload) => emitted.push(payload.key));
    class FakeWorker {
      constructor() {
        this.postMessage = vi.fn((message) => {
          this.onmessage?.({
            data: {
              id: message.id,
              result: message.payload.values.reduce((total, value) => total + value, 0)
            }
          });
        });
      }

      terminate() {}
    }
    const worker = new WorkerManager({ workerFactory: () => new FakeWorker() });
    worker.events = events;
    worker.register('sum', ({ values }) => values.reduce((total, value) => total + value, 0));

    await expect(worker.runSynced('sum', {}, { store, input: ['values'], key: 'total' })).resolves.toBe(12);

    expect(worker.worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      name: 'sum',
      payload: { values: [2, 4, 6] }
    }));
    expect(store.get('total')).toBe(12);
    expect(emitted).toEqual(['total']);
  });
});
