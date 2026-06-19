import createOfficialAddon from './_createOfficialAddon.js';

export default createOfficialAddon('TimelineAnimator', () => ({
  createTrack(name, keyframes = []) {
    return {
      name,
      keyframes: [...keyframes].sort((left, right) => Number(left.time || 0) - Number(right.time || 0)),
      sample(time = 0) {
        const sorted = this.keyframes;
        if (!sorted.length) return null;
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        if (time <= first.time) return { ...first };
        if (time >= last.time) return { ...last };
        return sorted.findLast((frame) => frame.time <= time) || first;
      }
    };
  }
}));
