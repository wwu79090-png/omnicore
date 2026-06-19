import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('UIManager', (OmniCore) => ({
  createButton(label, options = {}) {
    return new OmniCore.UI.Button(label, options);
  }
}));
