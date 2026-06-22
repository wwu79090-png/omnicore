import { createOmniError } from './OmniError.js';

export class JobDependencyGraph {
  constructor() {
    this.jobs = new Map();
  }

  addJob(name, { dependsOn = [] } = {}) {
    const key = String(name);
    this.jobs.set(key, {
      name: key,
      dependsOn: normalizeArray(dependsOn).map(String)
    });
    return this;
  }

  compile() {
    const remaining = new Map([...this.jobs.entries()].map(([name, job]) => [name, new Set(job.dependsOn)]));
    const batches = [];
    const completed = new Set();

    while (remaining.size > 0) {
      const ready = [...remaining.entries()]
        .filter(([, dependencies]) => [...dependencies].every((dependency) => completed.has(dependency)))
        .map(([name]) => name)
        .sort();
      if (ready.length === 0) throw createOmniError('JobDependencyGraph', 'Job dependency cycle or missing dependency detected.');
      batches.push(ready);
      for (const name of ready) {
        completed.add(name);
        remaining.delete(name);
      }
    }

    return { batches };
  }

  run({ handlers = {} } = {}) {
    const executed = [];
    for (const batch of this.compile().batches) {
      for (const name of batch) {
        handlers[name]?.();
        executed.push(name);
      }
    }
    return executed;
  }
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default JobDependencyGraph;
