import { DEFAULT_DEBUG } from '../config/defaults.js';

/**
 * Aggregates debug API usage for documentation and onboarding reports.
 */
export class DeveloperUsageReport {
  constructor({ debug = DEFAULT_DEBUG } = {}) {
    this.debug = debug;
    this.calls = new Map();
  }

  record(api, { duration = 0, configPath = null } = {}) {
    if (!this.debug || !api) return null;
    const current = this.calls.get(api) || {
      api,
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      maxDuration: 0,
      configPaths: {}
    };
    const safeDuration = Number.isFinite(duration) ? duration : 0;
    current.count += 1;
    current.totalDuration += safeDuration;
    current.avgDuration = Number((current.totalDuration / current.count).toFixed(3));
    current.maxDuration = Math.max(current.maxDuration, safeDuration);
    if (configPath) current.configPaths[configPath] = (current.configPaths[configPath] || 0) + 1;
    this.calls.set(api, current);
    return { ...current };
  }

  generate({ reason = 'manual' } = {}) {
    const calls = {};
    for (const [api, value] of this.calls) {
      calls[api] = {
        ...value,
        configPaths: { ...value.configPaths }
      };
    }
    const suggestions = Object.values(calls)
      .sort((left, right) => right.count - left.count)
      .map((item) => `${item.api} 调用 ${item.count} 次，建议补充示例或性能说明。`);
    return {
      reason,
      generatedAt: new Date().toISOString(),
      calls,
      suggestions
    };
  }
}

export default DeveloperUsageReport;
