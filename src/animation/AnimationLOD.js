/**
 * Creates per-animation sampling decisions for CPU skinning and FFD cost.
 */
export function createAnimationLODPlan(animations = [], {
  nearDistance = 256,
  farDistance = 768,
  nearSampleRate = 1,
  midSampleRate = 0.5,
  farSampleRate = 0.25
} = {}) {
  const near = Math.max(1, Number(nearDistance) || 256);
  const far = Math.max(near, Number(farDistance) || 768);
  const items = animations.map((animation) => {
    const distance = Math.max(0, Number(animation.distance ?? animation.cameraDistance ?? 0) || 0);
    const visible = animation.visible !== false && animation.culled !== true;
    if (!visible) {
      return {
        id: animation.id || animation.name,
        tier: 'offscreen',
        distance,
        sampleRate: 0,
        ffd: false,
        paused: true
      };
    }
    if (distance <= near) {
      return {
        id: animation.id || animation.name,
        tier: 'near',
        distance,
        sampleRate: nearSampleRate,
        ffd: animation.hasFFD !== false,
        paused: false
      };
    }
    if (distance <= far) {
      return {
        id: animation.id || animation.name,
        tier: 'mid',
        distance,
        sampleRate: midSampleRate,
        ffd: false,
        paused: false
      };
    }
    return {
      id: animation.id || animation.name,
      tier: 'far',
      distance,
      sampleRate: farSampleRate,
      ffd: false,
      paused: false
    };
  });

  return {
    format: 'OmniCore.AnimationLODPlan',
    nearDistance: near,
    farDistance: far,
    items,
    paused: items.filter((item) => item.paused).length,
    ffdDisabled: items.filter((item) => item.ffd === false).length
  };
}

export default createAnimationLODPlan;
