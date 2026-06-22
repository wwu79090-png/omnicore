export class ApiSurfaceFocusLens {
  analyze({ coreWorkflows = [], apis = [] } = {}) {
    const workflows = coreWorkflows.map(String);
    const normalizedApis = apis.map(normalizeApi);
    const coveredWorkflows = new Set(
      normalizedApis.flatMap((api) => api.workflows).filter((workflow) => workflows.includes(workflow))
    );
    const weakCoreApis = normalizedApis
      .filter((api) => api.tier === 'core' && (!api.docs || !api.tests))
      .map((api) => api.name);
    const noisyApis = normalizedApis
      .filter((api) => api.tier !== 'core' && api.workflows.length === 0)
      .map((api) => api.name);
    const focusScore = Math.max(0, Math.round(100 - ((weakCoreApis.length + noisyApis.length) * 12.5)));

    return {
      summary: {
        apiCount: normalizedApis.length,
        coreWorkflowCount: workflows.length,
        coveredCoreWorkflowCount: coveredWorkflows.size,
        focusScore,
        ready: weakCoreApis.length === 0 && noisyApis.length === 0 && coveredWorkflows.size === workflows.length
      },
      weakCoreApis,
      noisyApis,
      recommendations: buildRecommendations(normalizedApis, weakCoreApis, noisyApis)
    };
  }
}

function normalizeApi(api = {}) {
  return {
    name: String(api.name || 'api'),
    tier: String(api.tier || 'experimental'),
    workflows: normalizeArray(api.workflows).map(String),
    docs: Boolean(api.docs),
    tests: Boolean(api.tests)
  };
}

function buildRecommendations(apis, weakCoreApis, noisyApis) {
  const byName = new Map(apis.map((api) => [api.name, api]));
  const recommendations = [];
  for (const name of weakCoreApis) {
    const api = byName.get(name);
    if (!api?.docs) recommendations.push(`document:${name}`);
    if (!api?.tests) recommendations.push(`addTests:${name}`);
  }
  for (const name of noisyApis) recommendations.push(`hideOrMoveExperimental:${name}`);
  return recommendations;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export default ApiSurfaceFocusLens;
