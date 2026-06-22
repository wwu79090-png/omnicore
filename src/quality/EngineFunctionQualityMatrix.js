const DEFAULT_DIMENSIONS = Object.freeze({
  usability: { weight: 1 },
  reliability: { weight: 1 },
  performance: { weight: 1 },
  maintainability: { weight: 1 }
});

export class EngineFunctionQualityMatrix {
  constructor({ dimensions = DEFAULT_DIMENSIONS } = {}) {
    this.dimensions = normalizeDimensions(dimensions);
  }

  evaluate({
    features = [],
    minimumScore = 70
  } = {}) {
    const minimum = clampScore(minimumScore);
    const normalizedFeatures = normalizeArray(features).map((feature) => evaluateFeature({
      feature,
      dimensions: this.dimensions,
      minimumScore: minimum
    }));
    const score = normalizedFeatures.length
      ? Math.round(normalizedFeatures.reduce((total, feature) => total + feature.score, 0) / normalizedFeatures.length)
      : 100;
    const atRiskFeatures = normalizedFeatures.filter((feature) => feature.score < minimum);

    return {
      generatedBy: 'OmniCore engine function quality matrix',
      summary: {
        featureCount: normalizedFeatures.length,
        dimensionCount: Object.keys(this.dimensions).length,
        score,
        minimumScore: minimum,
        ready: atRiskFeatures.length === 0
      },
      dimensions: clone(this.dimensions),
      features: normalizedFeatures,
      atRiskFeatures,
      recommendations: buildRecommendations(atRiskFeatures)
    };
  }
}

function evaluateFeature({ feature = {}, dimensions, minimumScore }) {
  const id = String(feature.id || feature.name || 'feature');
  const scores = {};
  const weighted = [];
  for (const [dimension, config] of Object.entries(dimensions)) {
    const score = clampScore(feature.scores?.[dimension]);
    scores[dimension] = score;
    weighted.push({ dimension, score, weight: config.weight });
  }
  const weightTotal = weighted.reduce((total, item) => total + item.weight, 0) || 1;
  const score = Math.round(weighted.reduce((total, item) => total + (item.score * item.weight), 0) / weightTotal);
  const weakDimensions = weighted
    .filter((item) => item.score < minimumScore)
    .map((item) => ({
      dimension: item.dimension,
      score: item.score,
      gap: minimumScore - item.score
    }))
    .sort((left, right) => right.gap - left.gap || left.dimension.localeCompare(right.dimension));

  return {
    id,
    score,
    scores,
    evidence: clone(feature.evidence || {}),
    weakDimensions
  };
}

function buildRecommendations(features) {
  const recommendations = [];
  for (const feature of features) {
    for (const weak of feature.weakDimensions) {
      recommendations.push(`improve:${feature.id}:${weak.dimension}`);
    }
  }
  return recommendations;
}

function normalizeDimensions(dimensions) {
  return Object.fromEntries(
    Object.entries(dimensions || DEFAULT_DIMENSIONS).map(([id, config]) => [
      String(id),
      { weight: normalizeWeight(config?.weight) }
    ])
  );
}

function normalizeWeight(value) {
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight <= 0) return 1;
  return weight;
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

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default EngineFunctionQualityMatrix;
