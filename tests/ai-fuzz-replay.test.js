import { describe, expect, it } from 'vitest';
import {
  generateDeterministicOperations,
  resolveFuzzProvider,
  parseCrashReplay,
  serializeCrashReplay
} from '../scripts/lib/crash-replay.js';

describe('AI fuzz crash replay format', () => {
  it('round-trips deterministic operation sequences', () => {
    const replay = serializeCrashReplay({
      seed: 123,
      operations: [{ type: 'click', x: 10, y: 20 }, { type: 'scene', name: 'battle' }],
      error: { message: 'deadlock detected' }
    });
    const parsed = parseCrashReplay(replay);

    expect(parsed.seed).toBe(123);
    expect(parsed.operations).toHaveLength(2);
    expect(parsed.error.message).toBe('deadlock detected');
  });

  it('generates replayable local operations without network access', () => {
    const first = generateDeterministicOperations({ seed: 99, count: 5 });
    const second = generateDeterministicOperations({ seed: 99, count: 5 });

    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    expect(first.every((operation) => typeof operation.type === 'string')).toBe(true);
  });

  it('records local model metadata without network dependency', () => {
    expect(resolveFuzzProvider({ model: 'ollama:llama3.2' })).toEqual({
      provider: 'local-llm',
      model: 'ollama:llama3.2',
      network: false
    });
    expect(resolveFuzzProvider({})).toEqual({
      provider: 'deterministic-local',
      model: null,
      network: false
    });
  });
});
