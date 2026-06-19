export default {
  name: 'CameraShake',
  version: '1.0.0',
  install({ game, camera = game?.camera, intensity = 8, duration = 0.25 } = {}) {
    let remaining = 0;
    const origin = { x: camera?.x || 0, y: camera?.y || 0 };
    const unsubscribe = game?.loop?.subscribe?.((delta) => {
      if (!camera || remaining <= 0) return;
      remaining = Math.max(0, remaining - delta);
      camera.x = origin.x + (Math.random() - 0.5) * intensity;
      camera.y = origin.y + (Math.random() - 0.5) * intensity;
      if (remaining === 0) Object.assign(camera, origin);
    });
    return {
      shake(nextDuration = duration) {
        remaining = nextDuration;
      },
      destroy() {
        unsubscribe?.();
        if (camera) Object.assign(camera, origin);
      }
    };
  }
};
