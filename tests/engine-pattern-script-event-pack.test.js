import { describe, expect, it } from 'vitest';
import {
  MessageRouteBus,
  ObjectTimelineRuntime,
  ResourceStateScheduler,
  RpgEventPageResolver,
  VisualNovelScript
} from '../src/index.js';

describe('engine pattern script event pack', () => {
  it('runs RenPy-style labels, menus, calls, returns, and interpolation', () => {
    const script = new VisualNovelScript({
      labels: {
        start: [
          { op: 'say', speaker: 'Narrator', text: 'Hi {hero}' },
          {
            op: 'menu',
            prompt: 'Route?',
            choices: [
              {
                text: 'Help',
                commands: [{ op: 'set', key: 'route', value: 'help' }],
                jump: 'help'
              },
              { text: 'Leave', jump: 'bad_end' }
            ]
          }
        ],
        help: [
          { op: 'call', label: 'reward' },
          { op: 'say', speaker: 'Narrator', text: 'Done {route}' },
          { op: 'end' }
        ],
        reward: [
          { op: 'set', key: 'coins', value: 3 },
          { op: 'return' }
        ],
        bad_end: [{ op: 'end' }]
      }
    });

    const result = script.run({
      start: 'start',
      variables: { hero: 'Mina' },
      choices: ['Help']
    });

    expect(result.variables).toMatchObject({ hero: 'Mina', route: 'help', coins: 3 });
    expect(result.log).toEqual([
      { type: 'say', speaker: 'Narrator', text: 'Hi Mina' },
      { type: 'choice', prompt: 'Route?', text: 'Help', index: 0 },
      { type: 'set', key: 'route', value: 'help' },
      { type: 'set', key: 'coins', value: 3 },
      { type: 'say', speaker: 'Narrator', text: 'Done help' },
      { type: 'end', label: 'help' }
    ]);
  });

  it('selects RPG Maker-style active event pages from switches, variables, and self switches', () => {
    const resolver = new RpgEventPageResolver({
      events: [
        {
          id: 'gate',
          pages: [
            {
              id: 'closed',
              trigger: 'action',
              commands: [{ op: 'dialogue', text: 'Locked.' }]
            },
            {
              id: 'open',
              trigger: 'autorun',
              conditions: {
                switches: { gateOpen: true },
                variables: { keys: { gte: 1 } },
                selfSwitches: { A: true }
              },
              commands: [{ op: 'transfer', map: 'courtyard', x: 4, y: 7 }]
            }
          ]
        }
      ]
    });

    expect(resolver.resolve('gate', { switches: {}, variables: {}, selfSwitches: {} })).toMatchObject({
      eventId: 'gate',
      pageId: 'closed',
      trigger: 'action',
      commands: [{ op: 'dialogue', text: 'Locked.' }]
    });

    const openState = {
      switches: { gateOpen: true },
      variables: { keys: 2 },
      selfSwitches: { 'gate:A': true }
    };

    expect(resolver.resolve('gate', openState)).toMatchObject({
      eventId: 'gate',
      pageId: 'open',
      trigger: 'autorun',
      commands: [{ op: 'transfer', map: 'courtyard', x: 4, y: 7 }]
    });
    expect(resolver.listActive(openState).map((page) => page.pageId)).toEqual(['open']);
  });

  it('routes Defold-style addressed messages and tracks collection proxy lifecycle', () => {
    const bus = new MessageRouteBus();
    const delivered = [];
    bus.register('main:/player#script', (message) => delivered.push({
      id: message.messageId,
      target: message.target,
      amount: message.payload.amount
    }));
    bus.register('main:/loader#script', (message) => delivered.push({
      id: message.messageId,
      proxy: message.payload.proxy,
      collection: message.payload.collection
    }));

    bus.post('main:/loader#script', 'main:/player#script', 'take_damage', { amount: 2 });
    expect(bus.flush()).toBe(1);
    expect(delivered[0]).toEqual({
      id: 'take_damage',
      target: 'main:/player#script',
      amount: 2
    });

    bus.defineProxy('level', { collection: 'level_01' });
    bus.sendProxy('level', 'load', { sender: 'main:/loader#script' });
    bus.sendProxy('level', 'init');
    bus.sendProxy('level', 'enable');
    bus.flush();

    expect(bus.proxyState('level')).toMatchObject({
      id: 'level',
      collection: 'level_01',
      loaded: true,
      initialized: true,
      enabled: true
    });
    expect(delivered.at(-1)).toEqual({
      id: 'proxy_loaded',
      proxy: 'level',
      collection: 'level_01'
    });
  });

  it('runs GameMaker-style create, alarm, step, draw, and timeline events', () => {
    const runtime = new ObjectTimelineRuntime({
      objects: {
        enemy: {
          events: {
            create(ctx) {
              ctx.log('created');
              ctx.setAlarm(0, 2);
            },
            alarm0(ctx) {
              ctx.state.ready = true;
              ctx.log('alarm0');
            },
            step(ctx) {
              ctx.state.steps = (ctx.state.steps || 0) + 1;
            },
            draw(ctx) {
              ctx.log('draw');
            }
          },
          timeline: {
            3(ctx) {
              ctx.state.timeline = 'impact';
              ctx.log('timeline3');
            }
          }
        }
      }
    });

    const enemy = runtime.spawn('enemy', { hp: 10 });
    runtime.step();
    expect(enemy.state.ready).toBeUndefined();
    expect(enemy.state.steps).toBe(1);

    runtime.step();
    expect(enemy.state.ready).toBe(true);
    expect(runtime.log.map((entry) => entry.event)).toContain('alarm0');

    runtime.step();
    runtime.draw();

    expect(enemy.state).toMatchObject({ hp: 10, ready: true, steps: 3, timeline: 'impact' });
    expect(runtime.snapshot()[0]).toMatchObject({
      id: enemy.id,
      type: 'enemy',
      frame: 3,
      alarms: {}
    });
    expect(runtime.log.map((entry) => entry.message)).toEqual([
      'created',
      'alarm0',
      'timeline3',
      'draw'
    ]);
  });

  it('runs Bevy-style resource systems only in matching app states', () => {
    const scheduler = new ResourceStateScheduler()
      .addState('App', 'Loading')
      .insertResource('score', { value: 0 });
    const hooks = [];

    scheduler.onExit('App', 'Loading', ({ transition }) => hooks.push(`exit:${transition.from}`));
    scheduler.onEnter('App', 'Playing', ({ resources, transition }) => {
      resources.session = 'live';
      hooks.push(`enter:${transition.to}`);
    });
    scheduler.addSystem('Update', ({ resources }) => {
      resources.score.value += 1;
    }, {
      label: 'scoreSystem',
      state: { App: 'Playing' }
    });

    expect(scheduler.update('Update').ran).toEqual([]);
    expect(scheduler.getResource('score').value).toBe(0);

    scheduler.setNextState('App', 'Playing');
    const report = scheduler.update('Update');

    expect(hooks).toEqual(['exit:Loading', 'enter:Playing']);
    expect(report).toMatchObject({
      schedule: 'Update',
      ran: ['scoreSystem'],
      transitions: [{ name: 'App', from: 'Loading', to: 'Playing' }]
    });
    expect(scheduler.getResource('score').value).toBe(1);
    expect(scheduler.snapshot()).toMatchObject({
      states: { App: 'Playing' },
      resources: ['score', 'session']
    });
  });
});
