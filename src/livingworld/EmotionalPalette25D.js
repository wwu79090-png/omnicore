const PALETTES = {
  combat: {
    colorTemperature: -1600,
    saturation: 1.08,
    vignette: { color: '#1a0505', strength: 0.42, radius: 0.72 },
    tint: { color: '#ff3b30', amount: 0.28 }
  },
  safe: {
    colorTemperature: 900,
    saturation: 1.04,
    vignette: { color: '#3a2205', strength: 0.12, radius: 0.86 },
    tint: { color: '#f59e0b', amount: 0.18 }
  },
  sad: {
    colorTemperature: -900,
    saturation: 0.58,
    vignette: { color: '#071329', strength: 0.3, radius: 0.78 },
    tint: { color: '#3b82f6', amount: 0.22 }
  },
  neutral: {
    colorTemperature: 0,
    saturation: 1,
    vignette: { color: '#000000', strength: 0, radius: 1 },
    tint: { color: '#ffffff', amount: 0 }
  }
};

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(1, Math.max(0, numeric));
}

function scale(value, intensity) {
  return Number((value * intensity).toFixed(4));
}

function normalizeMood(mood) {
  const key = String(mood || 'neutral').toLowerCase();
  return Object.hasOwn(PALETTES, key) ? key : 'neutral';
}

export class EmotionalPalette25D {
  resolve({ mood = 'neutral', intensity = 1, transitionMs = 350 } = {}) {
    const normalizedMood = normalizeMood(mood);
    const normalizedIntensity = clamp01(intensity);
    const palette = PALETTES[normalizedMood];
    const transition = Math.max(0, Number(transitionMs) || 0);

    return {
      pipeline: 'omnicore-25d-emotional-palette/v1',
      mood: normalizedMood,
      intensity: normalizedIntensity,
      transitionMs: transition,
      colorTemperature: scale(palette.colorTemperature, normalizedIntensity),
      saturation: normalizedMood === 'neutral'
        ? palette.saturation
        : Number((1 + (palette.saturation - 1) * normalizedIntensity).toFixed(4)),
      vignette: {
        color: palette.vignette.color,
        strength: scale(palette.vignette.strength, normalizedIntensity),
        radius: palette.vignette.radius
      },
      tint: {
        color: palette.tint.color,
        amount: scale(palette.tint.amount, normalizedIntensity)
      }
    };
  }
}

export default EmotionalPalette25D;
