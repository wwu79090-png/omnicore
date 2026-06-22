import { describe, expect, it } from 'vitest';
import {
  ApplicationStateStack,
  EventCommandQueue,
  RoomExitGraph,
  RoomHotspotMap,
  TaskChainManager
} from '../src/index.js';

describe('engine pattern interaction pack', () => {
  it('handles AGS-style hotspot hit tests and verb interactions', () => {
    const emitted = [];
    const map = new RoomHotspotMap({
      hotspots: [
        {
          id: 'door',
          name: 'Old Door',
          bounds: { x: 10, y: 5, width: 20, height: 30 },
          walkTo: { x: 12, y: 35 },
          interactions: {
            look: { text: 'A locked wooden door.' },
            use: {
              requires: ['brassKey'],
              set: { doorOpen: true },
              emit: 'room:door-open'
            }
          }
        }
      ]
    });

    expect(map.hitTest(15, 10)).toMatchObject({ id: 'door', name: 'Old Door' });
    expect(map.locationName(15, 10)).toBe('Old Door');
    expect(map.interactAt({ x: 15, y: 10 }, 'look').text).toBe('A locked wooden door.');

    const locked = map.interactAt({ x: 15, y: 10 }, 'use', { inventory: [] });
    expect(locked).toMatchObject({ ok: false, reason: 'missing-requirement', missing: ['brassKey'] });

    const opened = map.interactAt({ x: 15, y: 10 }, 'use', {
      inventory: ['brassKey'],
      variables: {},
      emit: (event, payload) => emitted.push({ event, payload })
    });
    expect(opened).toMatchObject({ ok: true, hotspot: 'door', walkTo: { x: 12, y: 35 } });
    expect(opened.variables.doorOpen).toBe(true);
    expect(emitted).toEqual([{ event: 'room:door-open', payload: { hotspot: 'door', verb: 'use' } }]);
  });

  it('resolves Bitsy-style room exits, locked doors, and endings', () => {
    const graph = new RoomExitGraph({
      rooms: {
        start: {
          exits: [
            {
              at: { x: 2, y: 1 },
              to: { room: 'hall', x: 0, y: 3 },
              effect: 'fade',
              dialog: 'The door opens.',
              when: { doorOpen: true }
            }
          ],
          endings: [
            { at: { x: 5, y: 5 }, id: 'sleep', dialog: 'You rest.' }
          ]
        }
      }
    });

    expect(graph.resolve({ room: 'start', x: 2, y: 1 }, { doorOpen: false })).toEqual({
      type: 'locked',
      room: 'start',
      at: { x: 2, y: 1 },
      reason: 'condition-not-met'
    });
    expect(graph.resolve({ room: 'start', x: 2, y: 1 }, { doorOpen: true })).toEqual({
      type: 'exit',
      from: { room: 'start', x: 2, y: 1 },
      to: { room: 'hall', x: 0, y: 3 },
      effect: 'fade',
      dialog: 'The door opens.'
    });
    expect(graph.resolve({ room: 'start', x: 5, y: 5 }, {})).toEqual({
      type: 'ending',
      id: 'sleep',
      room: 'start',
      dialog: 'You rest.'
    });
  });

  it('runs GB Studio-style event commands and custom event scripts', () => {
    const emitted = [];
    const queue = new EventCommandQueue({
      customEvents: {
        unlockDoor: [
          { op: 'set', key: 'doorOpen', value: true },
          { op: 'emit', event: 'door:unlocked', payload: { key: 'doorOpen' } }
        ]
      }
    });

    const result = queue
      .enqueue([
        { op: 'dialogue', text: 'Hello {hero}' },
        { op: 'call', event: 'unlockDoor' },
        { op: 'changeScene', scene: 'hall', x: 3, y: 4 }
      ])
      .run({
        variables: { hero: 'Mira' },
        emit: (event, payload) => emitted.push({ event, payload })
      });

    expect(result.log).toEqual([
      { type: 'dialogue', text: 'Hello Mira' },
      { type: 'set', key: 'doorOpen', value: true },
      { type: 'scene', scene: 'hall', x: 3, y: 4 }
    ]);
    expect(result.variables).toMatchObject({ hero: 'Mira', doorOpen: true });
    expect(result.scene).toEqual({ name: 'hall', x: 3, y: 4 });
    expect(emitted).toEqual([{ event: 'door:unlocked', payload: { key: 'doorOpen' } }]);
  });

  it('steps Panda3D-style task chains with delayed tasks', () => {
    const manager = new TaskChainManager();
    let ticks = 0;
    let delayed = 0;
    manager.add((task) => {
      ticks += 1;
      return task.elapsed >= 0.3 ? TaskChainManager.DONE : TaskChainManager.CONTINUE;
    }, 'spin');
    manager.doLater(0.5, () => {
      delayed += 1;
      return TaskChainManager.DONE;
    }, 'wake');

    expect(manager.step(0.2).active).toEqual(['spin', 'wake']);
    expect(delayed).toBe(0);
    expect(manager.step(0.2).active).toEqual(['wake']);
    expect(ticks).toBe(2);
    expect(manager.step(0.2).active).toEqual([]);
    expect(delayed).toBe(1);
  });

  it('manages jMonkeyEngine-style application state lifecycle', () => {
    const calls = [];
    const states = new ApplicationStateStack();
    states.attach('hud', {
      initialize: ({ id }) => calls.push(`init:${id}`),
      onEnable: ({ id }) => calls.push(`enable:${id}`),
      update: ({ id, dt }) => calls.push(`update:${id}:${dt}`),
      render: ({ id }) => calls.push(`render:${id}`),
      onDisable: ({ id }) => calls.push(`disable:${id}`),
      cleanup: ({ id }) => calls.push(`cleanup:${id}`)
    });

    states.update(0.16);
    states.render();
    states.setEnabled('hud', false);
    states.update(0.16);
    states.detach('hud');

    expect(calls).toEqual([
      'init:hud',
      'enable:hud',
      'update:hud:0.16',
      'render:hud',
      'disable:hud',
      'cleanup:hud'
    ]);
    expect(states.snapshot()).toEqual([]);
  });
});
