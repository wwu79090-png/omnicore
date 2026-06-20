import { describe, expect, it } from 'vitest';
import OmniCore from '../src/index.js';
import TelemetryCollector from '../src/debug/TelemetryCollector.js';

describe('TelemetryCollector opt-in anonymous summary', () => {
  it('keeps anonymous telemetry disabled by default', () => {
    const collector = new TelemetryCollector({ debug: true, engineVersion: '1.0.0' });

    collector.recordApi('Game.init', { duration: 4 });
    collector.recordError('Store.set', new TypeError('bad state'));

    expect(collector.anonymous).toBe(false);
    expect(collector.exportAnonymousSummary()).toBeNull();
  });

  it('exports only aggregate anonymous usage after explicit opt-in', () => {
    const collector = new TelemetryCollector({
      debug: true,
      anonymous: true,
      engineVersion: '1.0.0'
    });

    collector.recordApi('Game.init', { duration: 4, configPath: 'boot' });
    collector.recordApi('Game.init', { duration: 6, configPath: 'boot' });
    collector.recordApi('Scene.push', { duration: 2 });
    collector.recordError('Store.set', new TypeError('bad state'));
    collector.recordError('Loader.load', new Error('missing asset'));

    expect(collector.exportAnonymousSummary()).toEqual({
      schema: 'omnicore.anonymous-telemetry.v1',
      anonymous: true,
      engineVersion: '1.0.0',
      apiUsage: {
        'Game.init': 2,
        'Scene.push': 1
      },
      errorTypes: {
        TypeError: 1,
        Error: 1
      },
      samples: 5
    });
  });

  it('treats Game telemetry true as explicit anonymous opt-in without enabling debug UI', async () => {
    const game = await new OmniCore.Game({
      headless: true,
      autoStart: false,
      telemetry: true,
      engineVersion: '1.0.0'
    }).init();

    game.store.set('score', 1);
    const summary = game.telemetryCollector.exportAnonymousSummary();

    expect(game.config.debug).not.toBe(true);
    expect(summary).toMatchObject({
      anonymous: true,
      engineVersion: '1.0.0'
    });
    expect(summary.apiUsage['Store.set']).toBe(1);

    game.destroy();
  });
});
