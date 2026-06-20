import { createOmniError } from '../core/OmniError.js';

export class ResourceOwnershipGraph {
  constructor({ warn = null } = {}) {
    this.warn = warn;
    this.ownerRecords = new Map();
    this.resourceRecords = new Map();
  }

  track(owner, resource, {
    id = resource?.id || resource?.key || resource?.url || `resource-${this.resourceRecords.size + 1}`,
    type = resource?.type || 'resource',
    dispose = null
  } = {}) {
    if (!owner) throw createOmniError('ResourceLifecycle', 'track(owner, resource) requires an owner.');
    if (!resource) throw createOmniError('ResourceLifecycle', 'track(owner, resource) requires a resource.');
    const record = this.resourceRecords.get(resource) || {
      id: String(id),
      type: String(type),
      resource,
      dispose,
      owners: new Set(),
      released: false
    };
    if (dispose) record.dispose = dispose;
    record.owners.add(owner);
    this.resourceRecords.set(resource, record);
    if (!this.ownerRecords.has(owner)) this.ownerRecords.set(owner, new Set());
    this.ownerRecords.get(owner).add(record);
    return resource;
  }

  release(resource, { force = false } = {}) {
    const record = this.resourceRecords.get(resource);
    if (!record || record.released) return false;
    if (!force && record.owners.size > 0) return false;
    record.released = true;
    callDispose(record);
    this.resourceRecords.delete(resource);
    return true;
  }

  releaseOwner(owner) {
    const records = this.ownerRecords.get(owner);
    if (!records) return { released: 0, retained: 0 };
    let released = 0;
    let retained = 0;
    for (const record of [...records]) {
      record.owners.delete(owner);
      if (record.owners.size === 0) {
        record.released = true;
        callDispose(record);
        this.resourceRecords.delete(record.resource);
        released += 1;
      } else {
        retained += 1;
      }
    }
    records.clear();
    this.ownerRecords.delete(owner);
    return { released, retained };
  }

  refCount(resource) {
    return this.resourceRecords.get(resource)?.owners.size || 0;
  }

  has(resource) {
    return this.resourceRecords.has(resource);
  }

  snapshot(owner = null) {
    const records = owner ? [...(this.ownerRecords.get(owner) || [])] : [...this.resourceRecords.values()];
    return records.map((record) => ({
      id: record.id,
      type: record.type,
      refCount: record.owners.size,
      released: record.released
    }));
  }

  assertNoLeaks(owner) {
    const leaks = this.snapshot(owner).filter((record) => !record.released && record.refCount > 0);
    if (leaks.length) {
      this.warn?.(`[OmniCore] Resource leak detected: ${leaks.map((item) => item.id).join(', ')}`);
    }
    return {
      ok: leaks.length === 0,
      leaks
    };
  }
}

function callDispose(record) {
  const { dispose, resource } = record;
  if (dispose) {
    dispose(resource);
    return;
  }
  resource.destroy?.(true);
  resource.dispose?.();
  resource.close?.();
}

export default ResourceOwnershipGraph;
