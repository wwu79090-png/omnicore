import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('SaveCloud', () => {
  const saves = new Map();
  return {
    save(slot, data) {
      saves.set(slot, JSON.parse(JSON.stringify(data)));
    },
    load(slot) {
      return saves.get(slot) || null;
    }
  };
});
