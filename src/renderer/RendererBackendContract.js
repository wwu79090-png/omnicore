export class RendererBackendContract {
  constructor({ backends = [] } = {}) {
    this.backends = backends.map(normalizeBackend).sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  }

  resolve({ preferred = 'auto', requiredFeatures = [] } = {}) {
    const fallbackChain = this._fallbackChain(preferred);
    const required = requiredFeatures.map(String);
    const rejected = [];
    let accepted = null;

    for (const id of fallbackChain) {
      const backend = this.backends.find((entry) => entry.id === id);
      if (!backend) {
        rejected.push({ id, reason: 'backend-not-registered' });
        continue;
      }
      if (!backend.available) {
        rejected.push({ id, reason: backend.reason || 'backend-unavailable' });
        continue;
      }
      const missing = required.filter((feature) => !backend.features.includes(feature));
      if (missing.length) {
        rejected.push({ id, reason: `missing-features:${missing.join(',')}` });
        continue;
      }
      accepted = backend;
      break;
    }

    return {
      preferred,
      selected: accepted?.id || null,
      fallbackChain,
      accepted: accepted ? {
        id: accepted.id,
        reason: accepted.reason,
        features: [...accepted.features]
      } : null,
      rejected
    };
  }

  _fallbackChain(preferred) {
    const ids = this.backends.map((backend) => backend.id);
    if (preferred === 'auto') return ids;
    return [...new Set([String(preferred), ...ids.filter((id) => id !== preferred)])];
  }
}

function normalizeBackend(backend = {}) {
  return {
    id: String(backend.id || backend.name),
    priority: Number.isFinite(Number(backend.priority)) ? Number(backend.priority) : 100,
    available: backend.available !== false,
    reason: backend.reason || 'available',
    features: normalizeArray(backend.features).map(String)
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default RendererBackendContract;
