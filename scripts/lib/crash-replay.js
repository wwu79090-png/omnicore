export const CRASH_REPLAY_VERSION = 1;

export function serializeCrashReplay({
  seed = Date.now(),
  provider = 'deterministic-local',
  operations = [],
  error = null,
  metadata = {}
} = {}) {
  return `${JSON.stringify({
    version: CRASH_REPLAY_VERSION,
    seed,
    provider,
    operations,
    error,
    metadata,
    createdAt: new Date(0).toISOString()
  }, null, 2)}\n`;
}

export function parseCrashReplay(input) {
  const payload = typeof input === 'string' ? JSON.parse(input) : input;
  if (payload.version !== CRASH_REPLAY_VERSION) {
    throw new Error(`Unsupported .crash-replay version: ${payload.version}`);
  }
  if (!Array.isArray(payload.operations)) {
    throw new Error('.crash-replay operations must be an array.');
  }
  return payload;
}

export function generateDeterministicOperations({ seed = 1, count = 1000 } = {}) {
  const random = mulberry32(seed);
  const scenes = ['boot', 'menu', 'overworld', 'battle', 'inventory'];
  const operations = [];
  for (let index = 0; index < count; index += 1) {
    const roll = random();
    if (roll < 0.35) {
      operations.push({
        type: 'click',
        x: Math.floor(random() * 1280),
        y: Math.floor(random() * 720),
        button: random() > 0.85 ? 2 : 0
      });
    } else if (roll < 0.7) {
      operations.push({
        type: 'move',
        dx: Number(((random() * 2) - 1).toFixed(3)),
        dy: Number(((random() * 2) - 1).toFixed(3)),
        durationMs: 16 + Math.floor(random() * 240)
      });
    } else if (roll < 0.9) {
      operations.push({
        type: 'scene',
        name: scenes[Math.floor(random() * scenes.length)]
      });
    } else {
      operations.push({
        type: 'store',
        key: `fuzz.${Math.floor(random() * 8)}`,
        value: Math.floor(random() * 1000)
      });
    }
  }
  return operations;
}

export function resolveFuzzProvider({ model = null } = {}) {
  if (typeof model === 'string' && model.trim()) {
    return {
      provider: 'local-llm',
      model,
      network: false
    };
  }
  return {
    provider: 'deterministic-local',
    model: null,
    network: false
  };
}

export async function replayOperations(target, operations = []) {
  for (const operation of operations) {
    await target?.dispatch?.(operation);
  }
  return { operations: operations.length };
}

function mulberry32(seed) {
  let value = Math.trunc(seed) % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}
