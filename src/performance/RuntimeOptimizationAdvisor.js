import PerformanceBudgetEnvelope from './PerformanceBudgetEnvelope.js';
import QualityScalerProfile from './QualityScalerProfile.js';

export class RuntimeOptimizationAdvisor {
  constructor({ envelope = new PerformanceBudgetEnvelope(), qualityProfile = new QualityScalerProfile() } = {}) {
    this.envelope = envelope;
    this.qualityProfile = qualityProfile;
  }

  analyze({ metrics = {}, capabilityAtlas = null } = {}) {
    const budget = this.envelope.evaluate(metrics);
    const targets = budget.violations.map((violation) => violation.metric);
    const qualityPlan = this.qualityProfile.planReduction({ targets, maxSteps: 6 });
    const gates = buildGates(capabilityAtlas);
    const actions = unique([
      ...actionsForViolations(budget.violations),
      ...qualityPlan.steps.map((step) => `reduce${capitalize(step.id)}`)
    ]);

    return {
      status: budget.status === 'ok' ? 'maintain' : 'degrade',
      bottleneck: budget.primaryBottleneck,
      gates,
      budget,
      qualityPlan,
      actions
    };
  }
}

function actionsForViolations(violations) {
  const actions = [];
  for (const violation of violations) {
    if (violation.category === 'cpu') {
      actions.push('deferNonCriticalJobs', 'reduceSimulationRate');
    } else if (violation.category === 'memory') {
      actions.push('tightenTexturePool');
    } else if (violation.category === 'network') {
      actions.push('lowerNetworkSnapshotRate');
    } else if (violation.category === 'gpu' || violation.category === 'render') {
      actions.push('reduceRenderScale');
    }
  }
  return actions;
}

function buildGates(atlas) {
  const summary = atlas?.summary || {};
  return {
    capabilityCoverage: Number(summary.coverageScore || 0) >= 90 && Number(summary.p0GapCount || 0) === 0
      ? 'pass'
      : 'review'
  };
}

function unique(values) {
  return [...new Set(values)];
}

function capitalize(value) {
  const text = String(value || '');
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}

export default RuntimeOptimizationAdvisor;
