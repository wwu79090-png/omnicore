import { describe, expect, it, vi } from 'vitest';
import AudioAddon from '../src/addons/Audio.js';
import AssetLoader from '../src/loader/AssetLoader.js';

class FakeAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.destination = { name: 'destination' };
    this.decodeAudioData = vi.fn(async () => ({ decoded: true }));
  }

  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (index) => data[index]
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect: vi.fn(),
      start: vi.fn()
    };
  }

  close() {}
}

describe('AudioAddon missing audio fallback', () => {
  it('replaces failed audio loads with a quiet placeholder and remains playable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const addon = new AudioAddon({ AudioContextRef: FakeAudioContext, debug: true });
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 404,
      arrayBuffer: vi.fn()
    }));

    const placeholder = await addon.loadAudio('footstep', '/src/audio/missing-footstep.wav', fetcher);
    const source = addon.play('footstep');

    expect(fetcher).toHaveBeenCalledWith('/src/audio/missing-footstep.wav');
    expect(placeholder).toBe(addon.sounds.get('footstep'));
    expect(placeholder.duration).toBeLessThan(0.08);
    expect(placeholder.getChannelData(0).some((sample) => sample !== 0)).toBe(true);
    expect(source?.buffer).toBe(placeholder);
    expect(source?.start).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[OmniCore] 音效 [footstep] 加载失败，已替换为静音占位。');

    warn.mockRestore();
  });

  it('uses the same quiet placeholder when decoding fails after a successful fetch', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class DecodeFailAudioContext extends FakeAudioContext {
      constructor() {
        super();
        this.decodeAudioData = vi.fn(async () => {
          throw new Error('decode failed');
        });
      }
    }
    const addon = new AudioAddon({ AudioContextRef: DecodeFailAudioContext, debug: true });
    const fetcher = vi.fn(async () => ({
      ok: true,
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8))
    }));

    const placeholder = await addon.loadAudio('broken', '/src/audio/broken.wav', fetcher);

    expect(placeholder.omnicorePlaceholder).toBe('missing-audio');
    expect(placeholder.duration).toBeLessThan(0.08);
    expect(addon.sounds.get('broken')).toBe(placeholder);
    expect(warn).toHaveBeenCalledWith('[OmniCore] 音效 [broken] 加载失败，已替换为静音占位。');

    warn.mockRestore();
  });

  it('lets AssetLoader replace failed audio assets with non-blocking placeholders', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = new AssetLoader({
      audioContext: new FakeAudioContext(),
      debug: true,
      fetcher: vi.fn(async () => ({
        ok: false,
        status: 404,
        arrayBuffer: vi.fn()
      }))
    });

    const asset = await loader.loadAudio({ key: 'music', url: '/audio/missing.ogg' });

    expect(asset).toMatchObject({
      key: 'music',
      url: '/audio/missing.ogg',
      type: 'audio',
      fallback: true
    });
    expect(asset.buffer.omnicorePlaceholder).toBe('missing-audio');
    expect(asset.buffer.duration).toBeLessThan(0.08);
    expect(warn).toHaveBeenCalledWith('[OmniCore] [loader] 音频资源加载失败，已生成占位音频：music (/audio/missing.ogg)');

    warn.mockRestore();
  });
});
