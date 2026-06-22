import { describe, expect, it } from 'vitest';
import {
  CallbackGameLoop,
  ComponentTreeRuntime,
  GameComponentPipeline,
  SceneObservableHub,
  ScreenFlowController
} from '../src/index.js';

describe('engine pattern lifecycle component pack', () => {
  it('runs LOVE-style load, input, update, and draw callbacks in frame order', () => {
    const events = [];
    const loop = new CallbackGameLoop({
      load(ctx, args) {
        const [assetRoot] = args;
        ctx.state.assetRoot = assetRoot;
        ctx.state.time = 0;
        events.push(`load:${assetRoot}`);
      },
      keypressed(ctx, key) {
        ctx.state.lastKey = key;
        events.push(`key:${key}`);
      },
      update(ctx, dt) {
        ctx.state.time += dt;
        events.push(`update:${dt}`);
      },
      draw(ctx) {
        events.push(`draw:${ctx.frame}`);
      }
    });

    loop.boot(['assets']).dispatch('keypressed', 'space').frame(0.16).frame(0.24);

    expect(loop.state).toMatchObject({ assetRoot: 'assets', lastKey: 'space', time: 0.4 });
    expect(events).toEqual([
      'load:assets',
      'key:space',
      'update:0.16',
      'draw:0',
      'update:0.24',
      'draw:1'
    ]);
    expect(loop.snapshot()).toMatchObject({
      booted: true,
      frame: 2,
      callbacks: ['draw', 'keypressed', 'load', 'update']
    });
  });

  it('switches libGDX-style screens through show, resize, render, pause, resume, hide, and dispose', () => {
    const events = [];
    const makeScreen = (id) => ({
      show: () => events.push(`${id}:show`),
      resize: (width, height) => events.push(`${id}:resize:${width}x${height}`),
      render: (dt) => events.push(`${id}:render:${dt}`),
      pause: () => events.push(`${id}:pause`),
      resume: () => events.push(`${id}:resume`),
      hide: () => events.push(`${id}:hide`),
      dispose: () => events.push(`${id}:dispose`)
    });

    const flow = new ScreenFlowController();
    flow
      .setScreen('menu', makeScreen('menu'))
      .resize(800, 600)
      .render(0.1)
      .pause()
      .resume()
      .setScreen('game', makeScreen('game'))
      .render(0.2)
      .dispose('menu');

    expect(events).toEqual([
      'menu:show',
      'menu:resize:800x600',
      'menu:render:0.1',
      'menu:pause',
      'menu:resume',
      'menu:hide',
      'game:show',
      'game:resize:800x600',
      'game:render:0.2',
      'menu:dispose'
    ]);
    expect(flow.snapshot()).toMatchObject({
      current: 'game',
      viewport: { width: 800, height: 600 },
      screens: ['game']
    });
  });

  it('updates and draws MonoGame-style components by order and enabled visibility flags', () => {
    const events = [];
    const pipeline = new GameComponentPipeline()
      .add({ id: 'late', updateOrder: 20, update: () => events.push('update:late') })
      .add({ id: 'early', updateOrder: -5, update: () => events.push('update:early') })
      .add({ id: 'world', drawOrder: 10, draw: () => events.push('draw:world') })
      .add({ id: 'hud', drawOrder: -1, draw: () => events.push('draw:hud') })
      .add({ id: 'hidden', visible: false, draw: () => events.push('draw:hidden') });

    pipeline.initialize();
    pipeline.update({ elapsed: 16 });
    pipeline.setEnabled('late', false);
    pipeline.update({ elapsed: 16 });
    pipeline.draw({ elapsed: 16 });

    expect(events).toEqual([
      'update:early',
      'update:late',
      'update:early',
      'draw:hud',
      'draw:world'
    ]);
    expect(pipeline.snapshot().map((component) => component.id)).toEqual([
      'early',
      'hidden',
      'hud',
      'late',
      'world'
    ]);
  });

  it('mounts Flame-style component trees and calls lifecycle, update, render, and removal hooks', () => {
    const events = [];
    const makeComponent = (id, priority) => ({
      id,
      priority,
      onLoad: () => events.push(`${id}:onLoad`),
      onMount: () => events.push(`${id}:onMount`),
      update: (_ctx, dt) => events.push(`${id}:update:${dt}`),
      render: () => events.push(`${id}:render`),
      onRemove: () => events.push(`${id}:onRemove`)
    });

    const tree = new ComponentTreeRuntime();
    tree.add(makeComponent('player', 5));
    tree.add(makeComponent('shadow', -1), 'player');
    tree.update(0.5).render({});
    tree.remove('player');

    expect(events).toEqual([
      'player:onLoad',
      'player:onMount',
      'shadow:onLoad',
      'shadow:onMount',
      'player:update:0.5',
      'shadow:update:0.5',
      'player:render',
      'shadow:render',
      'shadow:onRemove',
      'player:onRemove'
    ]);
    expect(tree.snapshot()).toEqual([{ id: 'root', parentId: null, priority: 0, mounted: true }]);
  });

  it('notifies Babylon-style observables with masks, priorities, once observers, and render phases', () => {
    const events = [];
    const hub = new SceneObservableHub(['beforeRender', 'afterRender']);
    hub.add('beforeRender', ({ frame }) => events.push(`before:main:${frame}`), {
      mask: 'main',
      priority: 10
    });
    hub.add('beforeRender', ({ frame }) => events.push(`before:ui:${frame}`), {
      mask: 'ui',
      priority: 0
    });
    hub.add('afterRender', ({ frame }) => events.push(`after:${frame}`), { once: true });

    hub.renderFrame({ frame: 1, mask: 'main' });
    hub.renderFrame({ frame: 2, mask: 'main' });

    expect(events).toEqual(['before:main:1', 'after:1', 'before:main:2']);
    expect(hub.snapshot()).toEqual({
      afterRender: [],
      beforeRender: [
        { id: 1, mask: 'main', priority: 10, once: false },
        { id: 2, mask: 'ui', priority: 0, once: false }
      ]
    });
  });
});
