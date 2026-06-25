import EngineCompletenessMatrix from './EngineCompletenessMatrix.js';
import EngineFunctionQualityMatrix from './EngineFunctionQualityMatrix.js';
import CompletenessClosurePlanner from './CompletenessClosurePlanner.js';
import LimitRemovalPlanner from './LimitRemovalPlanner.js';
import SoloProductionPlanner from './SoloProductionPlanner.js';

const PRIORITY_WEIGHT = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
const SOURCE_WEIGHT = Object.freeze({ completeness: 0, evidence: 1, limit: 2, quality: 3 });
const CONNECTED_LOOPS = Object.freeze([
  'completeness-matrix',
  'closure-plan',
  'function-quality',
  'limit-removal',
  'production-plan',
  'editor-next-actions',
  'release-gate'
]);

export class EngineCommercialClosureGate {
  constructor({
    minimumCompletenessScore = 85,
    minimumQualityScore = 80,
    requiredStages
  } = {}) {
    this.minimumCompletenessScore = clampScore(minimumCompletenessScore);
    this.minimumQualityScore = clampScore(minimumQualityScore);
    this.requiredStages = requiredStages;
  }

  evaluate({
    domains = [],
    features = [],
    limits = [],
    evidence = {},
    production = {}
  } = {}) {
    const completeness = new EngineCompletenessMatrix({ requiredStages: this.requiredStages }).evaluate({
      domains,
      minimumScore: this.minimumCompletenessScore
    });
    const quality = new EngineFunctionQualityMatrix().evaluate({
      features,
      minimumScore: this.minimumQualityScore
    });
    const evidenceIssues = normalizeArray(evidence.issues).map(normalizeEvidenceIssue);
    const closurePlan = new CompletenessClosurePlanner().plan({
      matrix: completeness,
      evidence: { ...evidence, issues: evidenceIssues }
    });
    const limitPlan = new LimitRemovalPlanner().plan(limits);
    const productionPlan = new SoloProductionPlanner().plan(production);
    const blockers = sortBlockers([
      ...createCompletenessBlockers(completeness, closurePlan),
      ...createQualityBlockers(quality, this.minimumQualityScore),
      ...createLimitBlockers(limitPlan),
      ...createEvidenceBlockers(evidenceIssues)
    ]);
    const hardLimitCount = normalizeArray(limits)
      .filter((limit) => limit?.kind === 'hard' && !['lifted', 'removed'].includes(String(limit?.status || 'active')))
      .length;
    const commercialReady = (
      completeness.summary.ready
      && quality.summary.ready
      && limitPlan.summary.planned === 0
      && evidenceIssues.length === 0
      && blockers.length === 0
    );
    const releaseGate = createReleaseGate({ commercialReady, blockers });
    const summary = {
      commercialReady,
      status: commercialReady ? 'release-candidate' : 'blocked',
      score: calculateCommercialScore({
        completenessScore: completeness.summary.score,
        qualityScore: quality.summary.score,
        plannedLimitCount: limitPlan.summary.planned,
        evidenceIssueCount: evidenceIssues.length
      }),
      domainCount: completeness.summary.domainCount,
      featureCount: quality.summary.featureCount,
      hardLimitCount,
      blockerCount: blockers.length,
      p0BlockerCount: blockers.filter((blocker) => blocker.priority === 'P0').length
    };

    return {
      generatedBy: 'OmniCore commercial closure gate',
      summary,
      connectedLoops: [...CONNECTED_LOOPS],
      gates: {
        completeness: {
          ready: completeness.summary.ready,
          score: completeness.summary.score,
          gapCount: completeness.gaps.length
        },
        quality: {
          ready: quality.summary.ready,
          score: quality.summary.score,
          atRiskFeatureCount: quality.atRiskFeatures.length
        },
        limits: {
          ready: limitPlan.summary.planned === 0,
          planned: limitPlan.summary.planned,
          hardLimitCount
        },
        evidence: {
          ready: evidenceIssues.length === 0,
          issueCount: evidenceIssues.length
        }
      },
      completeness,
      quality,
      closurePlan,
      limitPlan,
      productionPlan,
      blockers,
      editorNextActions: createEditorNextActions({ commercialReady, blockers }),
      releaseGate
    };
  }
}

export function createEngineCommercialClosureReport(options = {}) {
  return new EngineCommercialClosureGate(options).evaluate(options);
}

function createCompletenessBlockers(completeness = {}, closurePlan = {}) {
  const closureSteps = new Map(normalizeArray(closurePlan.steps).map((step) => [step.id, step]));
  return normalizeArray(completeness.gaps).map((gap) => {
    const id = `${gap.domain}:close-${gap.type}-${gap.id}`;
    const step = closureSteps.get(id);
    return {
      id,
      source: 'completeness',
      area: String(gap.domain || 'engine'),
      priority: normalizePriority(gap.severity),
      action: id,
      reason: `${gap.type || 'capability'}-gap`,
      verification: step?.verification || 'npm test -- tests/engine-completeness-optimization-pack.test.js'
    };
  });
}

function createQualityBlockers(quality = {}, minimumQualityScore = 80) {
  return normalizeArray(quality.atRiskFeatures).flatMap((feature) => (
    normalizeArray(feature.weakDimensions).map((weak) => ({
      id: `improve:${feature.id}:${weak.dimension}`,
      source: 'quality',
      area: String(feature.id || 'feature'),
      priority: weak.gap >= Math.ceil(minimumQualityScore * 0.15) ? 'P0' : 'P1',
      action: `improve:${feature.id}:${weak.dimension}`,
      reason: `weak-${weak.dimension}`,
      verification: 'npm test -- tests/engine-commercial-closure-gate.test.js'
    }))
  ));
}

function createLimitBlockers(limitPlan = {}) {
  return normalizeArray(limitPlan.steps).map((step) => ({
    id: step.id,
    source: 'limit',
    area: String(step.area || 'runtime'),
    priority: normalizePriority(step.priority),
    action: step.id,
    reason: step.strategy || step.action || 'limit',
    verification: step.verification || 'npm test -- tests/engine-limit-removal-pack.test.js'
  }));
}

function createEvidenceBlockers(evidenceIssues = []) {
  return normalizeArray(evidenceIssues).map((issue) => ({
    id: `${issue.feature}:add-${issue.type}`,
    source: 'evidence',
    area: issue.feature,
    priority: normalizePriority(issue.severity),
    action: `${issue.feature}:add-${issue.type}`,
    reason: `missing-${issue.type}`,
    verification: 'npm test -- tests/engine-commercial-closure-gate.test.js'
  }));
}

function createReleaseGate({ commercialReady, blockers }) {
  return {
    commercialReady,
    status: commercialReady ? 'release-candidate' : 'blocked',
    requiredActions: unique(blockers.map((blocker) => blocker.action)),
    verificationCommands: unique(blockers.map((blocker) => blocker.verification).filter(Boolean))
  };
}

function createEditorNextActions({ commercialReady, blockers }) {
  if (commercialReady) return [{ command: 'release-check', reason: 'release-candidate-ready', area: 'commercial' }];
  return uniqueActions([
    { command: 'quality-gate', reason: 'release-gate-blocked', area: 'commercial' },
    ...blockers.flatMap(editorActionsForBlocker)
  ]);
}

function editorActionsForBlocker(blocker = {}) {
  const area = String(blocker.area || '').toLowerCase();
  const id = String(blocker.id || '').toLowerCase();
  const actions = [];
  if (area.includes('3d') || id.includes('3d')) {
    actions.push({ command: 'scene-3d-demo', reason: blocker.reason, area: blocker.area });
  }
  if (area.includes('renderer') || area.includes('webgpu') || id.includes('webgpu')) {
    actions.push({ command: 'webgpu-diagnostics', reason: blocker.reason, area: blocker.area });
  }
  if (area.includes('asset')) {
    actions.push({ command: 'asset-refresh', reason: blocker.reason, area: blocker.area });
  }
  if (blocker.source === 'completeness') {
    actions.push({ command: 'governance-report', reason: blocker.reason, area: blocker.area });
  }
  return actions;
}

function calculateCommercialScore({
  completenessScore = 100,
  qualityScore = 100,
  plannedLimitCount = 0,
  evidenceIssueCount = 0
} = {}) {
  const limitScore = Math.max(0, 100 - (plannedLimitCount * 15));
  const evidenceScore = Math.max(0, 100 - (evidenceIssueCount * 15));
  return clampScore((completenessScore + qualityScore + limitScore + evidenceScore) / 4);
}

function sortBlockers(blockers = []) {
  return normalizeArray(blockers).sort((left, right) => (
    PRIORITY_WEIGHT[left.priority] - PRIORITY_WEIGHT[right.priority]
    || SOURCE_WEIGHT[left.source] - SOURCE_WEIGHT[right.source]
    || left.area.localeCompare(right.area)
    || left.id.localeCompare(right.id)
  ));
}

function normalizeEvidenceIssue(issue = {}) {
  return {
    feature: String(issue.feature || 'feature'),
    type: String(issue.type || 'evidence'),
    severity: normalizePriority(issue.severity)
  };
}

function normalizePriority(value) {
  return Object.prototype.hasOwnProperty.call(PRIORITY_WEIGHT, value) ? value : 'P1';
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function uniqueActions(actions = []) {
  const seen = new Set();
  const uniqueItems = [];
  for (const action of actions) {
    const key = `${action.command}:${action.area}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(action);
  }
  return uniqueItems;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default EngineCommercialClosureGate;
