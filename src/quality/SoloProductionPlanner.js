export class SoloProductionPlanner {
  plan({
    goal = 'solo-game',
    scope = [],
    risks = [],
    deadlineDays = 14
  } = {}) {
    const days = Math.max(1, Math.floor(Number(deadlineDays) || 1));
    const normalizedScope = normalizeArray(scope).map(String);
    const normalizedRisks = normalizeArray(risks).map(String);
    const milestones = createMilestones(days);

    return {
      generatedBy: 'OmniCore solo production planner',
      summary: {
        goal: String(goal),
        deadlineDays: days,
        phaseCount: 4,
        riskCount: normalizedRisks.length
      },
      phases: [
        createPhase('prototype', 1, milestones.prototype, normalizedScope.slice(0, 2), 'playable-loop'),
        createPhase('content-slice', milestones.prototype + 1, milestones.content, normalizedScope, 'content-proof'),
        createPhase('quality-pass', milestones.content + 1, milestones.quality, ['tests', 'performance', 'save-replay'], 'quality-gate'),
        createPhase('release', milestones.quality + 1, milestones.release, ['build', 'export', 'release-notes'], 'release-candidate')
      ],
      checkpoints: [
        `playable-loop-by-day-${milestones.prototype}`,
        `content-slice-by-day-${milestones.content}`,
        `quality-gate-by-day-${milestones.quality}`,
        `release-candidate-by-day-${milestones.release}`
      ],
      riskMitigations: normalizedRisks.map((risk) => ({
        risk,
        mitigation: mitigationFor(risk)
      }))
    };
  }
}

function createPhase(id, startDay, endDay, scope, output) {
  return {
    id,
    startDay: Math.max(1, startDay),
    endDay: Math.max(1, endDay),
    scope: normalizeArray(scope).map(String),
    output
  };
}

function createMilestones(days) {
  return {
    prototype: Math.max(1, Math.ceil(days * 0.2)),
    content: Math.max(1, Math.ceil(days * 0.5)),
    quality: Math.max(1, Math.ceil(days * 0.8)),
    release: days
  };
}

function mitigationFor(risk) {
  const key = String(risk || '').toLowerCase();
  if (key.includes('asset')) return 'lock-style-and-atlas-budget';
  if (key.includes('test')) return 'run-daily-smoke-and-save-replay';
  if (key.includes('scope')) return 'cut-to-core-loop-first';
  if (key.includes('performance')) return 'capture-frame-budget-before-content-growth';
  return 'make-risk-visible-in-daily-checkpoint';
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default SoloProductionPlanner;
