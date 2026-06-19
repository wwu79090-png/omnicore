import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('ParticlePack', (OmniCore) => ({
  burst(scene, count = 16, options = {}) {
    return Array.from({ length: count }, (_, index) => scene.add(new OmniCore.Sprite(options.texture || 'particle', {
      x: options.x || 0,
      y: options.y || 0,
      width: options.size || 4,
      height: options.size || 4,
      alpha: 1 - index / count
    })));
  }
}));
