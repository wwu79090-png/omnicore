export class TextureStreamingBudget {
  constructor({ poolBytes = 64 * 1024 * 1024 } = {}) {
    this.poolBytes = Math.max(0, Number(poolBytes) || 0);
    this.textures = new Map();
  }

  register(id, {
    fullBytes = 0,
    wantedMip = 0,
    maxMip = 0,
    priority = 0,
    pinned = false
  } = {}) {
    const key = String(id);
    this.textures.set(key, {
      id: key,
      fullBytes: Math.max(0, Number(fullBytes) || 0),
      wantedMip: clampMip(wantedMip, maxMip),
      maxMip: Math.max(0, Math.floor(Number(maxMip) || 0)),
      priority: Number(priority || 0),
      pinned: Boolean(pinned)
    });
    return this;
  }

  plan() {
    const entries = [...this.textures.values()].map((texture) => ({
      ...texture,
      mip: texture.pinned ? 0 : texture.wantedMip
    }));
    let totalBytes = total(entries);
    const downgrades = [];

    const candidates = entries
      .filter((entry) => !entry.pinned)
      .sort((a, b) => a.priority - b.priority || b.fullBytes - a.fullBytes || a.id.localeCompare(b.id));

    for (const candidate of candidates) {
      if (totalBytes <= this.poolBytes) break;
      if (candidate.mip >= candidate.maxMip) continue;
      candidate.mip = nextMipForBudget(candidate);
      downgrades.push({ id: candidate.id, mip: candidate.mip });
      totalBytes = total(entries);
    }

    return {
      poolBytes: this.poolBytes,
      totalBytes,
      overBudgetBytes: Math.max(0, totalBytes - this.poolBytes),
      downgrades,
      textures: Object.fromEntries(entries.sort((a, b) => a.id.localeCompare(b.id)).map((entry) => [
        entry.id,
        {
          mip: entry.mip,
          bytes: bytesForMip(entry.fullBytes, entry.mip),
          priority: entry.priority,
          pinned: entry.pinned
        }
      ]))
    };
  }
}

function total(entries) {
  return entries.reduce((sum, entry) => sum + bytesForMip(entry.fullBytes, entry.mip), 0);
}

function bytesForMip(fullBytes, mip) {
  return Math.max(1, Math.round(Number(fullBytes || 0) / (2 ** Math.max(0, Number(mip) || 0))));
}

function clampMip(value, maxMip) {
  return Math.max(0, Math.min(Math.floor(Number(value) || 0), Math.max(0, Math.floor(Number(maxMip) || 0))));
}

function nextMipForBudget(entry) {
  if (entry.priority <= 1) return entry.maxMip;
  return Math.min(entry.maxMip, entry.mip + 1);
}

export default TextureStreamingBudget;
