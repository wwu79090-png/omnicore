/**
 * Default OmniCore damage formula.
 */
export function calculateDamage({
  base = 0,
  attack = 0,
  defense = 0,
  multiplier = 1,
  multiplier100 = null
} = {}) {
  const scale = multiplier100 == null ? Math.round(multiplier * 100) : multiplier100;
  return Math.max(0, Math.round(((base + attack - defense) * scale) / 100));
}

export default calculateDamage;
