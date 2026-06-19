import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('DebugConsole', (OmniCore) => ({
  create(options = {}) {
    return new OmniCore.DebugConsole(options);
  }
}));
