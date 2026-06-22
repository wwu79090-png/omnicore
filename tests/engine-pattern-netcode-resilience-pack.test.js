import { describe, expect, it } from 'vitest';
import {
  ClientPredictionReconciler,
  LagCompensationTimeline,
  NetworkSnapshotBuffer,
  ReplicationInterestGraph,
  RollbackFrameStore
} from '../src/index.js';

describe('engine pattern netcode resilience pack', () => {
  it('buffers authoritative snapshots and samples interpolation or bounded extrapolation', () => {
    const buffer = new NetworkSnapshotBuffer({ capacity: 3 });

    buffer
      .push({ tick: 10, timeMs: 100, state: { x: 0, y: 0, health: 100 } })
      .push({ tick: 20, timeMs: 200, state: { x: 10, y: 0, health: 90 } })
      .push({ tick: 30, timeMs: 300, state: { x: 20, y: 10, health: 80 } })
      .push({ tick: 40, timeMs: 400, state: { x: 30, y: 10, health: 70 } });

    expect(buffer.snapshot().ticks).toEqual([20, 30, 40]);
    expect(buffer.sample(250)).toEqual({
      mode: 'interpolate',
      fromTick: 20,
      toTick: 30,
      alpha: 0.5,
      state: { x: 15, y: 5, health: 85 }
    });
    expect(buffer.sample(450, { extrapolateMs: 100 })).toEqual({
      mode: 'extrapolate',
      fromTick: 30,
      toTick: 40,
      alpha: 1.5,
      state: { x: 35, y: 10, health: 65 }
    });
  });

  it('reconciles client prediction against authoritative snapshots and replays pending inputs', () => {
    const reconciler = new ClientPredictionReconciler({
      initialState: { x: 0, y: 0 },
      reducer: (state, input) => ({
        x: state.x + Number(input.dx || 0),
        y: state.y + Number(input.dy || 0)
      })
    });

    reconciler.recordInput({ tick: 1, input: { dx: 2, dy: 0 } });
    reconciler.recordInput({ tick: 2, input: { dx: 2, dy: 0 } });

    expect(reconciler.state()).toEqual({ x: 4, y: 0 });
    expect(reconciler.reconcile({ tick: 1, state: { x: 1, y: 0 } })).toEqual({
      authoritativeTick: 1,
      corrected: true,
      correction: {
        before: { x: 2, y: 0 },
        after: { x: 1, y: 0 }
      },
      replayedTicks: [2],
      state: { x: 3, y: 0 }
    });
    expect(reconciler.pendingInputs().map((entry) => entry.tick)).toEqual([2]);
  });

  it('keeps rollback frames in a fixed-capacity timeline and restores cloned state', () => {
    const frames = new RollbackFrameStore({ capacity: 3 });

    frames
      .save({ tick: 1, state: { hp: 100 } })
      .save({ tick: 2, state: { hp: 90 } })
      .save({ tick: 3, state: { hp: 80 } })
      .save({ tick: 4, state: { hp: 70 } });

    const restored = frames.restore(3);
    restored.hp = 1;

    expect(frames.snapshot().ticks).toEqual([2, 3, 4]);
    expect(frames.restore(3)).toEqual({ hp: 80 });
    expect(frames.range({ fromTick: 2, toTick: 4 }).map((frame) => frame.tick)).toEqual([2, 3, 4]);
  });

  it('rewinds historical hitboxes for server-side lag compensation validation', () => {
    const timeline = new LagCompensationTimeline({ historyMs: 300 });

    timeline
      .record({ timeMs: 1000, entity: 'enemy', hitbox: { x: 0, y: 0, w: 10, h: 10 } })
      .record({ timeMs: 1100, entity: 'enemy', hitbox: { x: 10, y: 0, w: 10, h: 10 } })
      .record({ timeMs: 1200, entity: 'enemy', hitbox: { x: 20, y: 0, w: 10, h: 10 } });

    expect(timeline.rewind(1150, { entities: ['enemy'] })).toEqual({
      timeMs: 1150,
      entities: {
        enemy: { x: 15, y: 0, w: 10, h: 10 }
      }
    });
    expect(timeline.validateHit({ timeMs: 1150, entity: 'enemy', point: { x: 17, y: 5 } })).toEqual({
      entity: 'enemy',
      hit: true,
      timeMs: 1150,
      hitbox: { x: 15, y: 0, w: 10, h: 10 }
    });
    expect(timeline.validateHit({ timeMs: 1150, entity: 'enemy', point: { x: 40, y: 5 } }).hit).toBe(false);
  });

  it('builds Unreal-style replication interest lists by global, owner, team, and spatial relevance', () => {
    const graph = new ReplicationInterestGraph({ cellSize: 100 });

    graph
      .addActor('globalClock', { x: 999, y: 999, alwaysRelevant: true })
      .addActor('ownerSword', { x: 900, y: 900, owner: 'clientA' })
      .addActor('blueAlly', { x: 400, y: 0, team: 'blue' })
      .addActor('redEnemyNear', { x: 120, y: 40, team: 'red' })
      .addActor('redEnemyFar', { x: 500, y: 500, team: 'red' })
      .addActor('sleepingCrate', { x: 140, y: 40, dormant: true });

    expect(graph.gatherForClient({
      id: 'clientA',
      x: 100,
      y: 50,
      radius: 120,
      team: 'blue'
    })).toEqual({
      clientId: 'clientA',
      actors: [
        { id: 'globalClock', reason: 'always' },
        { id: 'ownerSword', reason: 'owner' },
        { id: 'blueAlly', reason: 'team' },
        { id: 'redEnemyNear', reason: 'spatial' }
      ],
      skippedDormant: ['sleepingCrate']
    });
  });
});
