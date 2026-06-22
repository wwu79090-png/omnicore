export class PersonalCapabilityProfile {
  constructor({ abilities = {} } = {}) {
    this.abilities = Object.fromEntries(
      Object.entries(abilities).map(([id, ability]) => [String(id), normalizeAbility(id, ability)])
    );
  }

  evaluate({
    target = 'solo-project',
    minimumScore = 60,
    weights = {}
  } = {}) {
    const abilities = Object.values(this.abilities);
    const score = computeEvidenceBackedScore(abilities);
    const weakest = abilities
      .filter((ability) => ability.score < minimumScore)
      .map((ability) => ({
        ...ability,
        gap: minimumScore - ability.score,
        weightedGap: round((minimumScore - ability.score) * normalizeWeight(weights[ability.id]))
      }))
      .sort((left, right) => (
        right.weightedGap - left.weightedGap
        || left.score - right.score
        || left.id.localeCompare(right.id)
      ));

    return {
      generatedBy: 'OmniCore personal capability profile',
      summary: {
        target: String(target),
        abilityCount: abilities.length,
        score,
        minimumScore,
        ready: weakest.length === 0
      },
      abilities,
      weakest,
      recommendations: weakest.map((ability) => `train:${ability.id}`)
    };
  }
}

function normalizeAbility(id, ability = {}) {
  return {
    id: String(id),
    score: clampScore(ability.score),
    evidence: normalizeArray(ability.evidence).map(String),
    notes: ability.notes == null ? null : String(ability.notes)
  };
}

function computeEvidenceBackedScore(abilities) {
  if (!abilities.length) return 0;
  const average = abilities.reduce((total, ability) => total + ability.score, 0) / abilities.length;
  const evidenceBonus = abilities.some((ability) => ability.evidence.length > 0) ? 1 : 0;
  return Math.round(average + evidenceBonus);
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeWeight(value) {
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight <= 0) return 1;
  return weight;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function round(value) {
  return Number(value.toFixed(3));
}

export default PersonalCapabilityProfile;
