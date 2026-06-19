import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('CameraShake', () => ({
  shake(camera, { strength = 8, duration = 250 } = {}) {
    camera.shake = { strength, duration, startedAt: Date.now() };
    return camera.shake;
  }
}));
