import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_2D_25D_DIRECTOR_SCHEMA,
  createCamera2D25DDirectorStep
} from '../src/index.js';

describe('2D/2.5D camera director', () => {
  it('builds a production camera step with deadzone, lookahead, room bounds, shake, parallax, debug, editor, and runtime sync', () => {
    const step = createCamera2D25DDirectorStep({
      delta: 1 / 60,
      camera: {
        x: 120,
        y: 40,
        viewport: { width: 160, height: 96 },
        zoom: 1,
        pixelSnap: true
      },
      target: {
        id: 'hero',
        x: 210,
        y: 74,
        width: 16,
        height: 24,
        velocity: { x: 140, y: -40 },
        lookAhead: { x: 36, y: -8 }
      },
      rooms: [
        { id: 'room-a', x: 0, y: 0, width: 240, height: 144 },
        { id: 'room-b', x: 240, y: 0, width: 240, height: 144, transition: 'push' }
      ],
      deadzone: { x: 56, y: 28, width: 48, height: 36 },
      smoothing: { follow: 0.5, lookAhead: 1 },
      shake: { trauma: 0.5, decay: 0.1, maxOffset: 12, seed: 4 },
      parallax: [
        { id: 'sky', factorX: 0.25, factorY: 0.1, offsetX: 4 },
        { id: 'mid', factorX: 0.6, factorY: 0.35 }
      ]
    });

    expect(step.schema).toBe(CAMERA_2D_25D_DIRECTOR_SCHEMA);
    expect(step.target).toMatchObject({ id: 'hero', center: { x: 218, y: 86 } });
    expect(step.room).toMatchObject({ activeRoomId: 'room-b', transition: 'push' });
    expect(step.view).toMatchObject({ x: 240, y: 12, width: 160, height: 96, zoom: 1 });
    expect(step.deadzone.world).toMatchObject({ x: 296, y: 40, width: 48, height: 36 });
    expect(step.shake).toMatchObject({ active: true, trauma: 0.5, nextTrauma: 0.4 });
    expect(step.shake.offset.x).not.toBe(0);
    expect(step.parallax.layers).toEqual([
      expect.objectContaining({ id: 'sky', x: -56, y: -1.2 }),
      expect.objectContaining({ id: 'mid', x: -144, y: -4.2 })
    ]);
    expect(step.editor.panels).toEqual(expect.arrayContaining([
      'CameraDirector',
      'Deadzone',
      'LookAhead',
      'RoomBounds',
      'ShakeTrauma',
      'ParallaxLayers',
      'PixelSnap',
      'RuntimeDebug'
    ]));
    expect(step.runtimeSync.payloads).toEqual(expect.arrayContaining([
      'camera',
      'target',
      'room',
      'deadzone',
      'shake',
      'parallax'
    ]));
    expect(step.debugDraw.map((command) => command.op)).toEqual(expect.arrayContaining([
      'debug:camera-view',
      'debug:camera-deadzone',
      'debug:camera-room',
      'debug:camera-lookahead',
      'debug:camera-shake',
      'debug:camera-parallax-layer'
    ]));
    expect(step.quality.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'camera-room-bounds', pass: true }),
      expect.objectContaining({ id: 'camera-deadzone-follow', pass: true }),
      expect.objectContaining({ id: 'camera-shake-trauma', pass: true }),
      expect.objectContaining({ id: 'camera-parallax-layers', pass: true }),
      expect.objectContaining({ id: 'camera-editor-runtime-sync', pass: true })
    ]));
  });

  it('is wired into the official 2D/2.5D platformer demo', () => {
    const root = join(process.cwd(), 'examples/2d-25d-platformer-demo');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');

    expect(main).toContain('createCamera2D25DDirectorStep');
    expect(main).toContain('CameraDirector');
    expect(main).toContain('ParallaxLayers');
    expect(main).toContain('ShakeTrauma');
    expect(readme).toContain('camera director');
    expect(readme).toContain('deadzone');
    expect(readme).toContain('parallax');
  });
});
