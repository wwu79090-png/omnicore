const DEFAULT_REQUIRED_EVIDENCE = Object.freeze({
  api: 1,
  docs: 1,
  tests: 1,
  examples: 1,
  production: 1
});

const SEVERITY_BY_TYPE = Object.freeze({
  tests: 'P0',
  api: 'P1',
  docs: 'P1',
  examples: 'P1',
  production: 'P1'
});

const PRIORITY_WEIGHT = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

export class CompletenessGapAnalyzer {
  constructor({ requiredEvidence = DEFAULT_REQUIRED_EVIDENCE } = {}) {
    this.requiredEvidence = normalizeRequiredEvidence(requiredEvidence);
  }

  analyze(features = []) {
    const normalizedFeatures = normalizeArray(features).map(normalizeFeature);
    const issues = normalizedFeatures
      .flatMap((feature) => analyzeFeature(feature, this.requiredEvidence))
      .sort((left, right) => (
        PRIORITY_WEIGHT[left.severity] - PRIORITY_WEIGHT[right.severity]
        || left.feature.localeCompare(right.feature)
        || evidenceOrder(left.type) - evidenceOrder(right.type)
      ));

    return {
      generatedBy: 'OmniCore completeness gap analyzer',
      summary: {
        featureCount: normalizedFeatures.length,
        issueCount: issues.length,
        ready: issues.length === 0
      },
      requiredEvidence: { ...this.requiredEvidence },
      features: normalizedFeatures,
      issues,
      recommendations: issues.map(recommendationForIssue)
    };
  }
}

function normalizeRequiredEvidence(requiredEvidence) {
  return Object.fromEntries(
    Object.entries(requiredEvidence || DEFAULT_REQUIRED_EVIDENCE).map(([type, count]) => [
      String(type),
      Math.max(0, Math.floor(Number(count) || 0))
    ])
  );
}

function normalizeFeature(feature = {}) {
  return {
    id: String(feature.id || feature.name || 'feature'),
    api: normalizeArray(feature.api).map(String),
    docs: normalizeArray(feature.docs).map(String),
    tests: normalizeArray(feature.tests).map(String),
    examples: normalizeArray(feature.examples).map(String),
    production: normalizeArray(feature.production).map(String)
  };
}

function analyzeFeature(feature, requiredEvidence) {
  const issues = [];
  for (const [type, required] of Object.entries(requiredEvidence)) {
    const current = normalizeArray(feature[type]).length;
    const missing = Math.max(0, required - current);
    if (!missing) continue;
    issues.push({
      feature: feature.id,
      type,
      missing,
      severity: SEVERITY_BY_TYPE[type] || 'P1'
    });
  }
  return issues;
}

function recommendationForIssue(issue) {
  if (issue.type === 'api') return `expandApi:${issue.feature}`;
  if (issue.type === 'docs') return `addDocs:${issue.feature}`;
  if (issue.type === 'tests') return `addTests:${issue.feature}`;
  if (issue.type === 'examples') return `addExamples:${issue.feature}`;
  if (issue.type === 'production') return `addProductionProof:${issue.feature}`;
  return `closeEvidence:${issue.feature}:${issue.type}`;
}

function evidenceOrder(type) {
  return ['api', 'docs', 'tests', 'examples', 'production'].indexOf(type);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default CompletenessGapAnalyzer;
