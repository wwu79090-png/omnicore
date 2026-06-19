import { describe, expect, it, vi } from 'vitest';
import WorkerManager from '../src/worker/WorkerManager.js';

describe('WorkerManager shared-buffer high frequency sync', () => {
  it('publishes a SharedArrayBuffer channel and records high-frequency frame writes', () => {
    const worker = { postMessage: vi.fn() };
    const manager = new WorkerManager({ workerFactory: () => worker });
    const channel = manager.createSharedBuffer({ name: 'transforms', length: 16 });

    manager.syncSharedBuffer('transforms', channel);
    for (let frame = 1; frame <= 240; frame += 1) {
      manager.writeSharedFrame(channel, [
        frame,
        frame * 2,
        frame * 3,
        frame * 4
      ]);
    }

    const snapshot = manager.readSharedFrame(channel);

    expect(channel.shared).toBe(typeof SharedArrayBuffer !== 'undefined');
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'shared-buffer',
      name: 'transforms',
      length: 16
    }));
    expect(snapshot.version).toBe(240);
    expect(snapshot.values.slice(0, 4)).toEqual([240, 480, 720, 960]);
  });
});
