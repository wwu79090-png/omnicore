import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('3DDecorator', () => ({
  decorate(entity, options = {}) {
    entity.dimension3d = { enabled: true, depth: options.depth || 1, tilt: options.tilt || 0 };
    return entity;
  }
}));
