export const DEFAULT_SYSTEM_STAGES = Object.freeze(['Startup', 'PreUpdate', 'Update', 'PostUpdate', 'FixedUpdate']);

export class SystemSchedule {
  constructor({ stages = DEFAULT_SYSTEM_STAGES } = {}) {
    this.stageOrder = [...stages];
    this.systems = new Map(this.stageOrder.map((stage) => [stage, []]));
    this.ranStartup = false;
  }

  add(stage, name, system, options = {}) {
    const stageName = String(stage || 'Update');
    if (!this.systems.has(stageName)) {
      this.systems.set(stageName, []);
      this.stageOrder.push(stageName);
    }
    const entry = { name: String(name || `system-${this.systems.get(stageName).length}`), system, options };
    this.systems.get(stageName).push(entry);
    return entry;
  }

  run(context = {}) {
    const report = { stages: [] };
    for (const stage of this.stageOrder) {
      if (stage === 'FixedUpdate' && !context.fixed) continue;
      if (stage === 'Startup' && this.ranStartup) continue;
      const entries = this.systems.get(stage) || [];
      const executed = [];
      for (const entry of entries) {
        entry.system?.(context);
        executed.push(entry.name);
      }
      if (stage === 'Startup') this.ranStartup = true;
      report.stages.push({ name: stage, systems: executed });
    }
    return report;
  }
}

export default SystemSchedule;
