export class PerformanceMonitorRegistry {
  constructor() {
    this.monitors = new Map();
  }

  register(id, read, { budget = {}, category = 'runtime' } = {}) {
    this.monitors.set(String(id), {
      id: String(id),
      read,
      budget: normalizeBudget(budget),
      category: String(category || 'runtime')
    });
    return this;
  }

  sample({ timeMs = Date.now() } = {}) {
    const monitors = {};
    const alerts = [];
    for (const monitor of this.monitors.values()) {
      const value = Number(typeof monitor.read === 'function' ? monitor.read() : monitor.read);
      const status = statusFor(value, monitor.budget);
      const entry = {
        value,
        status,
        category: monitor.category,
        budget: { ...monitor.budget }
      };
      monitors[monitor.id] = entry;
      if (status !== 'ok') {
        alerts.push({
          id: monitor.id,
          status,
          value,
          category: monitor.category
        });
      }
    }
    return {
      timeMs: Number(timeMs) || 0,
      monitors,
      alerts
    };
  }
}

function normalizeBudget(budget) {
  return {
    min: optionalNumber(budget.min),
    max: optionalNumber(budget.max)
  };
}

function statusFor(value, budget) {
  if (budget.min != null && value < budget.min) return 'under-min';
  if (budget.max != null && value > budget.max) return 'over-max';
  return 'ok';
}

function optionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default PerformanceMonitorRegistry;
