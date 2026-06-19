import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('Achievement', () => {
  const unlocked = new Set();
  return {
    unlock(id) {
      unlocked.add(id);
      return { id, unlocked: true };
    },
    has(id) {
      return unlocked.has(id);
    }
  };
});
