const PRIORITY_WEIGHT = Object.freeze({
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
});

const EVIDENCE_SEVERITY = Object.freeze({
  tests: 'P0',
  docs: 'P1',
  examples: 'P2',
  benchmark: 'P2'
});

export class FeatureQualityAuditor {
  constructor({ requiredEvidence = ['tests', 'docs'] } = {}) {
    this.requiredEvidence = normalizeArray(requiredEvidence).map(String);
  }

  audit(features = []) {
    const normalizedFeatures = normalizeArray(features).map(normalizeFeature);
    const issues = normalizedFeatures
      .flatMap((feature) => auditFeature(feature, this.requiredEvidence))
      .sort((left, right) => PRIORITY_WEIGHT[left.severity] - PRIORITY_WEIGHT[right.severity]);

    return {
      generatedBy: 'OmniCore feature quality auditor',
      summary: {
        featureCount: normalizedFeatures.length,
        issueCount: issues.length,
        ready: issues.length === 0
      },
      features: normalizedFeatures,
      issues,
      recommendations: issues.map(issueRecommendation)
    };
  }
}

function normalizeFeature(feature = {}) {
  return {
    id: String(feature.id || feature.name || 'feature'),
    owner: feature.owner == null ? null : String(feature.owner),
    evidence: { ...(feature.evidence || {}) },
    api: normalizeArray(feature.api).map(String),
    failureModes: normalizeArray(feature.failureModes).map(String),
    smoke: feature.smoke == null ? null : String(feature.smoke)
  };
}

function auditFeature(feature, requiredEvidence) {
  const issues = [];
  for (const evidence of requiredEvidence) {
    if (feature.evidence[evidence]) continue;
    issues.push({
      feature: feature.id,
      code: `missing-${evidence}`,
      severity: EVIDENCE_SEVERITY[evidence] || 'P2',
      message: `${feature.id} is missing ${evidence} evidence.`
    });
  }
  if (!feature.owner) {
    issues.push({
      feature: feature.id,
      code: 'missing-owner',
      severity: 'P1',
      message: `${feature.id} has no owner.`
    });
  }
  if (!feature.failureModes.length) {
    issues.push({
      feature: feature.id,
      code: 'missing-failure-modes',
      severity: 'P1',
      message: `${feature.id} has no failure-mode coverage.`
    });
  }
  return issues;
}

function issueRecommendation(issue) {
  if (issue.code === 'missing-docs') return `document:${issue.feature}`;
  if (issue.code === 'missing-examples') return `addExample:${issue.feature}`;
  if (issue.code === 'missing-owner') return `assignOwner:${issue.feature}`;
  if (issue.code === 'missing-failure-modes') return `addFailureModeTests:${issue.feature}`;
  if (issue.code === 'missing-tests') return `addTests:${issue.feature}`;
  return `fix:${issue.feature}:${issue.code}`;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default FeatureQualityAuditor;
