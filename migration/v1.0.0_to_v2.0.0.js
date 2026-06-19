/**
 * OmniCore sample migration: v1.0.0 -> v2.0.0.
 *
 * Converts legacy `playerData` into the v2 `player` structure and preserves
 * the original value under `__backup.playerData`.
 *
 * @example
 * const upgraded = migrate({ engineVersion: '1.0.0', playerData: { name: 'Ada' } });
 */
export function migrate(oldData = {}) {
  const playerData = oldData.playerData || {};
  return {
    ...oldData,
    engineVersion: '2.0.0',
    player: {
      id: playerData.id || null,
      profile: {
        name: playerData.name || 'Player'
      },
      progression: {
        level: Number(playerData.level || 1)
      },
      inventory: Array.isArray(playerData.inventory) ? [...playerData.inventory] : []
    },
    __backup: {
      ...(oldData.__backup || {}),
      playerData: JSON.parse(JSON.stringify(playerData))
    }
  };
}

export default migrate;
