export function createResourceWaterfall({ now = defaultNow } = {}) {
  const records = new Map();
  const ensure = (id) => {
    if (!records.has(id)) {
      records.set(id, {
        id,
        startAt: null,
        downloadedAt: null,
        decodedAt: null,
        cacheHitAt: null,
        fallbackAt: null,
        bytes: 0,
        reason: null
      });
    }
    return records.get(id);
  };
  return {
    markStart(id, { at = now() } = {}) {
      ensure(id).startAt = at;
    },
    markDownloaded(id, { bytes = 0, at = now() } = {}) {
      const record = ensure(id);
      record.downloadedAt = at;
      record.bytes = Number(bytes) || 0;
    },
    markDecoded(id, { at = now() } = {}) {
      ensure(id).decodedAt = at;
    },
    markCacheHit(id, { at = now() } = {}) {
      const record = ensure(id);
      record.startAt = record.startAt ?? at;
      record.cacheHitAt = at;
    },
    markFallback(id, { reason = 'unknown', at = now() } = {}) {
      const record = ensure(id);
      record.startAt = record.startAt ?? at;
      record.fallbackAt = at;
      record.reason = reason;
    },
    entries() {
      return [...records.values()].map(normalizeEntry);
    }
  };
}

export function summarizeResourceWaterfall(entries = []) {
  const normalized = entries.map(normalizeEntry);
  const totalMs = normalized.reduce((sum, entry) => sum + entry.totalMs, 0);
  return {
    format: 'OmniCore.ResourceWaterfallSummary',
    totalResources: normalized.length,
    totalMs: round(totalMs),
    cacheHits: normalized.filter((entry) => entry.cacheHit).length,
    decodeFailures: normalized.filter((entry) => entry.fallback).length,
    fallbacks: normalized
      .filter((entry) => entry.fallback)
      .map((entry) => ({ id: entry.id, reason: entry.reason })),
    slowest: normalized
      .slice()
      .sort((left, right) => right.totalMs - left.totalMs)
      .slice(0, 8)
  };
}

function normalizeEntry(entry = {}) {
  const startAt = number(entry.startAt);
  const endAt = number(entry.decodedAt ?? entry.fallbackAt ?? entry.cacheHitAt ?? entry.downloadedAt ?? startAt);
  return {
    ...entry,
    startAt,
    downloadedAt: entry.downloadedAt ?? null,
    decodedAt: entry.decodedAt ?? null,
    cacheHitAt: entry.cacheHitAt ?? null,
    fallbackAt: entry.fallbackAt ?? null,
    downloadMs: entry.downloadedAt == null ? 0 : round(number(entry.downloadedAt) - startAt),
    decodeMs: entry.decodedAt == null || entry.downloadedAt == null ? 0 : round(number(entry.decodedAt) - number(entry.downloadedAt)),
    totalMs: round(endAt - startAt),
    cacheHit: entry.cacheHitAt != null,
    fallback: entry.fallbackAt != null
  };
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function defaultNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function round(value) {
  return Number(value.toFixed(3));
}

export default createResourceWaterfall;
