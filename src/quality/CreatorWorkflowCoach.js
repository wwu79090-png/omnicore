const DEFAULT_PLAYBOOK = Object.freeze({
  programming: ['write-regression-test', 'refactor-hot-path'],
  artPipeline: ['create-asset-style-board', 'build-atlas-smoke-test'],
  gameDesign: ['prototype-core-loop', 'playtest-feedback-pass'],
  releaseOps: ['run-release-readiness', 'write-platform-checklist'],
  performance: ['capture-frame-budget', 'reduce-hotspots']
});

export class CreatorWorkflowCoach {
  constructor({ playbook = DEFAULT_PLAYBOOK } = {}) {
    this.playbook = clonePlaybook(playbook);
  }

  plan({
    profile = {},
    bottlenecks = [],
    hoursAvailable = 4
  } = {}) {
    const hours = Math.max(1, Math.floor(Number(hoursAvailable) || 1));
    const focuses = collectFocuses({ profile, bottlenecks }).slice(0, hours);
    const steps = focuses.map((focus, index) => createStep({
      focus,
      action: firstAction(this.playbook[focus.id]),
      index
    }));

    return {
      generatedBy: 'OmniCore creator workflow coach',
      summary: {
        focusCount: focuses.length,
        hoursAvailable: hours,
        mode: 'solo-sprint'
      },
      steps
    };
  }
}

function collectFocuses({ profile, bottlenecks }) {
  const focuses = [];
  for (const weak of normalizeArray(profile.weakest)) {
    focuses.push({
      id: String(weak.id),
      score: Number(weak.score ?? 0),
      reason: 'weak-ability'
    });
  }
  for (const bottleneck of normalizeArray(bottlenecks)) {
    focuses.push({
      id: String(bottleneck.area || 'performance'),
      score: Number(bottleneck.score ?? 0),
      reason: 'engine-bottleneck',
      drivers: normalizeArray(bottleneck.drivers).map(String)
    });
  }
  return focuses;
}

function createStep({ focus, action, index }) {
  return {
    id: `${focus.id}:${action}`,
    focus: focus.id,
    action,
    reason: focus.reason,
    priority: priorityFor(focus, index),
    verification: verificationFor(focus.id)
  };
}

function firstAction(actions) {
  const list = normalizeArray(actions).map(String).filter(Boolean);
  return list[0] || 'create-next-proof';
}

function priorityFor(focus, index) {
  if (index === 0) return 'P0';
  if (focus.reason === 'engine-bottleneck' && focus.score >= 7) return 'P0';
  if (focus.score < 45) return 'P0';
  return 'P1';
}

function verificationFor(focus) {
  if (focus === 'releaseOps') return 'npm test -- tests/release-readiness.test.js';
  if (focus === 'performance') return 'npm run benchmark:ci';
  if (focus === 'artPipeline') return 'npm test -- tests/build-asset-pipeline.test.js';
  if (focus === 'gameDesign') return 'npm test -- tests/core-experience-acceptance.test.js';
  return 'npm test -- tests/engine-personal-capability-pack.test.js';
}

function clonePlaybook(playbook) {
  return Object.fromEntries(
    Object.entries(playbook || {}).map(([key, value]) => [String(key), normalizeArray(value).map(String)])
  );
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default CreatorWorkflowCoach;
