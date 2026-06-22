const DEFAULT_STAGES = Object.freeze(['runtime', 'authoring', 'tests', 'docs', 'release']);
const PRIORITY_WEIGHT = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

export class EngineCompletenessMatrix {
  constructor({ requiredStages = DEFAULT_STAGES } = {}) {
    this.requiredStages = normalizeArray(requiredStages).map(String);
  }

  evaluate({
    domains = [],
    minimumScore = 80
  } = {}) {
    const minimum = clampScore(minimumScore);
    const evaluatedDomains = normalizeArray(domains).map((domain) => evaluateDomain({
      domain,
      requiredStages: this.requiredStages,
      minimumScore: minimum
    }));
    const requiredStageCount = evaluatedDomains.reduce((total, domain) => total + domain.requiredStages.length, 0);
    const coveredStageCount = evaluatedDomains.reduce((total, domain) => total + domain.coveredStages.length, 0);
    const requiredCapabilityCount = evaluatedDomains.reduce((total, domain) => total + domain.requiredCapabilities.length, 0);
    const coveredCapabilityCount = evaluatedDomains.reduce((total, domain) => total + domain.coveredCapabilities.length, 0);
    const score = evaluatedDomains.length
      ? Math.round(evaluatedDomains.reduce((total, domain) => total + domain.score, 0) / evaluatedDomains.length)
      : 100;
    const gaps = evaluatedDomains
      .flatMap((domain) => domain.gaps)
      .sort((left, right) => (
        PRIORITY_WEIGHT[left.severity] - PRIORITY_WEIGHT[right.severity]
        || left.domain.localeCompare(right.domain)
        || gapTypeOrder(left.type) - gapTypeOrder(right.type)
        || left.order - right.order
        || left.id.localeCompare(right.id)
      ))
      .map(({ order, ...gap }) => gap);

    return {
      generatedBy: 'OmniCore engine completeness matrix',
      summary: {
        domainCount: evaluatedDomains.length,
        requiredStageCount,
        coveredStageCount,
        requiredCapabilityCount,
        coveredCapabilityCount,
        score,
        ready: score >= minimum && gaps.length === 0
      },
      requiredStages: [...this.requiredStages],
      domains: evaluatedDomains,
      gaps
    };
  }
}

function evaluateDomain({ domain = {}, requiredStages, minimumScore }) {
  const id = String(domain.id || domain.name || 'domain');
  const stages = domain.stages || {};
  const coveredStages = requiredStages.filter((stage) => Boolean(stages[stage]));
  const requiredCapabilities = normalizeArray(domain.requiredCapabilities).map(String);
  const capabilitySet = new Set(normalizeArray(domain.capabilities).map(String));
  const coveredCapabilities = requiredCapabilities.filter((capability) => capabilitySet.has(capability));
  const stageCoverage = requiredStages.length ? coveredStages.length / requiredStages.length : 1;
  const capabilityCoverage = requiredCapabilities.length ? coveredCapabilities.length / requiredCapabilities.length : 1;
  const score = Math.round((stageCoverage * 60) + (capabilityCoverage * 40));
  const severity = score < minimumScore * 0.75 ? 'P0' : 'P1';

  return {
    id,
    score,
    requiredStages: [...requiredStages],
    coveredStages,
    missingStages: requiredStages.filter((stage) => !coveredStages.includes(stage)),
    requiredCapabilities,
    coveredCapabilities,
    missingCapabilities: requiredCapabilities.filter((capability) => !coveredCapabilities.includes(capability)),
    gaps: [
      ...requiredStages
        .map((stage, order) => ({ stage, order }))
        .filter(({ stage }) => !coveredStages.includes(stage))
        .map(({ stage, order }) => ({ domain: id, type: 'stage', id: stage, severity, order })),
      ...requiredCapabilities
        .map((capability, index) => ({ capability, order: requiredStages.length + index }))
        .filter(({ capability }) => !coveredCapabilities.includes(capability))
        .map(({ capability, order }) => ({ domain: id, type: 'capability', id: capability, severity, order }))
    ]
  };
}

function gapTypeOrder(type) {
  if (type === 'stage') return 0;
  if (type === 'capability') return 1;
  return 2;
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default EngineCompletenessMatrix;
