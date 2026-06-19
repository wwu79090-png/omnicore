import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('AudioMixer', (OmniCore) => ({
  create(options = {}) {
    return new OmniCore.AudioManager(options);
  }
}));
