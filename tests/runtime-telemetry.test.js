import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore from '../src/index.js';
import telemetryHandler from '../api/telemetry.js';

describe('runtime health telemetry', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
    vi.restoreAllMocks();
  });

  it('keeps Game runtime telemetry disabled unless explicitly enabled', async () => {
    const game = await new OmniCore.Game({
      headless: true,
      autoStart: false,
      debug: false,
      adaptiveQuality: false
    }).init();

    expect(game.telemetryCollector).toBeNull();
    game.destroy();
  });

  it('collects opt-in runtime FPS, memory, renderer, WebGL and error summaries', async () => {
    const game = await new OmniCore.Game({
      headless: true,
      autoStart: false,
      debug: false,
      adaptiveQuality: false,
      telemetry: {
        enabled: true,
        anonymous: true,
        intervalMs: 0,
        engineVersion: '1.0.0'
      }
    }).init();

    game.store.set('fps', 58);
    game.webglContext = { lost: true };
    game.telemetryCollector.recordError('Renderer.renderScene', new Error('context lost'));
    const sample = game.telemetryCollector.captureRuntimeSample(game);
    const summary = game.telemetryCollector.exportRuntimeHealthSummary();

    expect(sample).toMatchObject({
      fps: 58,
      renderer: 'headless',
      webgl: { lost: true }
    });
    expect(sample.memoryMB).toBeGreaterThanOrEqual(0);
    expect(summary).toMatchObject({
      schema: 'omnicore.runtime-health.v1',
      anonymous: true,
      engineVersion: '1.0.0',
      samples: 1,
      errorTypes: { Error: 1 },
      latest: expect.objectContaining({ fps: 58 })
    });
    game.destroy();
  });

  it('flushes anonymous runtime summaries through a developer-owned transport', async () => {
    const transport = vi.fn(async () => ({ ok: true }));
    const game = await new OmniCore.Game({
      headless: true,
      autoStart: false,
      debug: false,
      adaptiveQuality: false,
      telemetry: {
        enabled: true,
        anonymous: true,
        intervalMs: 0,
        transport
      }
    }).init();

    game.store.set('fps', 61);
    game.telemetryCollector.captureRuntimeSample(game);
    await game.telemetryCollector.flushRuntimeSummary();

    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      schema: 'omnicore.runtime-health.v1',
      latest: expect.objectContaining({ fps: 61 })
    }));
    game.destroy();
  });

  it('writes telemetry POST payloads to a local JSONL file for Vercel or dev servers', async () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-telemetry-'));
    const outFile = path.join(temp, 'telemetry.jsonl');
    process.env.OMNICORE_TELEMETRY_FILE = outFile;
    const response = createMockResponse();

    await telemetryHandler({
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: {
        schema: 'omnicore.runtime-health.v1',
        anonymous: true,
        latest: { fps: 60 }
      }
    }, response);

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, stored: true });
    expect(readFileSync(outFile, 'utf8')).toContain('omnicore.runtime-health.v1');
    delete process.env.OMNICORE_TELEMETRY_FILE;
  });
});

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = JSON.stringify(payload);
      return this;
    },
    end(payload = '') {
      this.body = payload;
      return this;
    }
  };
}
