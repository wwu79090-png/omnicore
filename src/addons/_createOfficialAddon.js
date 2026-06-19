export function createOfficialAddon(name, install) {
  return {
    name,
    install(OmniCore, options = {}) {
      const api = install?.(OmniCore, options) || {};
      OmniCore.addons = OmniCore.addons || {};
      OmniCore.addons[name] = api;
      OmniCore[name] = api;
      return api;
    }
  };
}

export default createOfficialAddon;
