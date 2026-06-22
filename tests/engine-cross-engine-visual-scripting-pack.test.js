import { describe, expect, it } from 'vitest';
import { VisualScriptGraphRuntime } from '../src/index.js';

describe('cross-engine visual scripting pack', () => {
  it('executes Blueprint-style graphs with branches, variables, actions, signals, and traces', () => {
    const runtime = new VisualScriptGraphRuntime({
      graph: {
        variables: { score: 0, doorLocked: true },
        nodes: [
          { id: 'enter', type: 'event', event: 'player.enter' },
          { id: 'has-key', type: 'branch', condition: { op: '>=', left: '$payload.keys', right: 1 } },
          { id: 'unlock', type: 'set', target: 'variables.doorLocked', value: false },
          { id: 'score', type: 'call', action: 'awardScore', args: { amount: 25 } },
          {
            id: 'notify',
            type: 'emit',
            event: 'door.unlocked',
            payload: { score: '$variables.score', locked: '$variables.doorLocked' }
          }
        ],
        edges: [
          { from: 'enter', to: 'has-key' },
          { from: 'has-key', to: 'unlock', pin: 'true' },
          { from: 'unlock', to: 'score' },
          { from: 'score', to: 'notify' }
        ]
      },
      actions: {
        awardScore({ runtime: graphRuntime, args }) {
          graphRuntime.set('variables.score', graphRuntime.get('variables.score') + args.amount);
          return { awarded: args.amount };
        }
      }
    });

    const report = runtime.validate();
    expect(report.ok).toBe(true);
    expect(report.summary).toEqual({
      nodeCount: 5,
      edgeCount: 4,
      eventCount: 1,
      issueCount: 0
    });

    const result = runtime.trigger('player.enter', { keys: 1 });

    expect(runtime.variables).toEqual({ score: 25, doorLocked: false });
    expect(result.events).toEqual([
      {
        event: 'door.unlocked',
        payload: { score: 25, locked: false }
      }
    ]);
    expect(result.trace.map((step) => `${step.nodeId}:${step.type}`)).toEqual([
      'enter:event',
      'has-key:branch',
      'unlock:set',
      'score:call',
      'notify:emit'
    ]);
    expect(result.trace.find((step) => step.nodeId === 'score').result).toEqual({ awarded: 25 });
  });

  it('reports authoring issues and documents which engine advantages are being learned', () => {
    const runtime = new VisualScriptGraphRuntime({
      graph: {
        nodes: [
          { id: 'start', type: 'event', event: 'ready' },
          { id: 'missing-action', type: 'call', action: 'spawnEnemy' }
        ],
        edges: [
          { from: 'start', to: 'missing-action' },
          { from: 'missing-action', to: 'ghost' }
        ]
      }
    });

    const report = runtime.validate();

    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(['missing-node', 'missing-action']);

    const profile = VisualScriptGraphRuntime.crossEngineProfile();
    expect(profile.sources.map((source) => source.engine)).toEqual([
      'Unreal Blueprint',
      'Unity Visual Scripting',
      'Godot Signals',
      'Construct / GDevelop Event Sheets'
    ]);
    expect(profile.localCapabilities).toEqual([
      'event-entry-nodes',
      'branch-pins',
      'runtime-variables',
      'custom-action-bindings',
      'signal-emission',
      'authoring-diagnostics',
      'execution-trace'
    ]);
  });
});
