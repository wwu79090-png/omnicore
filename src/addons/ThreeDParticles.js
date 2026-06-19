import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('ThreeDParticles', (OmniCore) => ({
  spawnBurst3D(scene, options = {}) {
    const particles = [];
    const count = Number(options.count || 24);
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / Math.max(1, count);
      const depth = (index % 6) / 6;
      const particle = scene?.add?.(new OmniCore.Sprite(options.texture || 'spark', {
        x: options.x || 0,
        y: (options.y || 0) - depth * 12,
        width: options.size || 4,
        height: options.size || 4,
        alpha: 1 - depth * 0.25,
        scale: 1 + depth * 0.35
      })) || {
        x: options.x || 0,
        y: options.y || 0,
        z: options.z || depth,
        vx: Math.cos(angle) * (options.speed || 80),
        vy: Math.sin(angle) * (options.speed || 80),
        alpha: 1
      };
      particle.z = options.z || depth;
      particles.push(particle);
    }
    return particles;
  }
}));
