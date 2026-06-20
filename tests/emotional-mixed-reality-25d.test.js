import { describe, expect, it } from 'vitest';
import {
  EmotionalPalette25D,
  RealitySensor25D
} from '../src/index.js';

describe('OmniCore 2.5D emotional and mixed reality layer', () => {
  it('resolves combat, safe, sad, and neutral mood descriptors', () => {
    const palette = new EmotionalPalette25D();

    expect(palette.resolve({ mood: 'combat', intensity: 0.8 })).toMatchObject({
      pipeline: 'omnicore-25d-emotional-palette/v1',
      mood: 'combat',
      colorTemperature: expect.any(Number),
      vignette: expect.objectContaining({ strength: expect.any(Number) }),
      tint: expect.objectContaining({ color: '#ff3b30' })
    });
    expect(palette.resolve({ mood: 'safe', intensity: 0.5 }).tint.color).toBe('#f59e0b');
    expect(palette.resolve({ mood: 'sad', intensity: 1 }).saturation).toBeLessThan(1);
    expect(palette.resolve({ mood: 'neutral', intensity: 9 })).toMatchObject({
      mood: 'neutral',
      intensity: 1,
      tint: { color: '#ffffff', amount: 0 }
    });
  });

  it('uses local time daylight fallback without requesting geolocation', async () => {
    const sensors = new RealitySensor25D({
      now: () => new Date('2026-06-20T22:00:00')
    });

    const sample = await sensors.sample({ daylight: true, geolocation: false });

    expect(sample.daylight).toMatchObject({ source: 'local-time', phase: 'night' });
    expect(sample.permissions.geolocation).toBe('not-requested');
  });

  it('returns permission status data when geolocation is denied', async () => {
    const sensors = new RealitySensor25D({
      navigator: {
        geolocation: {
          getCurrentPosition: (_success, failure) => failure({ code: 1, message: 'denied' })
        }
      }
    });

    const sample = await sensors.sample({ daylight: true, geolocation: true });

    expect(sample.permissions.geolocation).toBe('denied');
    expect(sample.daylight.source).toBe('local-time');
  });

  it('returns unavailable zero tilt when device orientation is missing', async () => {
    const sensors = new RealitySensor25D({ window: {} });
    const sample = await sensors.sample({ orientation: true });

    expect(sample.orientation).toEqual({ source: 'unavailable', tiltX: 0, tiltY: 0 });
  });
});
