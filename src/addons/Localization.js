import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('Localization', () => {
  const messages = new Map();
  return {
    load(locale, values) {
      messages.set(locale, { ...(values || {}) });
    },
    t(locale, key) {
      return messages.get(locale)?.[key] || key;
    }
  };
});
