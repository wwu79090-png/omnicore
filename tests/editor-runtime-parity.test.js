import { describe, expect, it } from 'vitest';
import LiveInspector from '../src/debug/LiveInspector.js';
import RemoteDevTools from '../src/debug/RemoteDevTools.js';
import { DebugRenderer } from '../src/debug/DebugRenderer.js';
import { StorageManager } from '../src/index.js';

describe('runtime editor parity helpers', () => {
  it('shows a floating runtime state panel when hovering an entity on the game canvas', () => {
    document.body.innerHTML = '<canvas id="game"></canvas>';
    const canvas = document.getElementById('game');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 320, height: 180 })
    });

    const game = {
      core: { canvas },
      scene: {
        current: {
          children: [{
            id: 'enemy-1',
            name: 'Slime',
            x: 24,
            y: 32,
            width: 32,
            height: 24,
            hp: 50,
            maxHp: 100,
            state: 'Chase'
          }]
        }
      }
    };

    const inspector = new LiveInspector(game, { hover: true });
    inspector.attach();

    canvas.dispatchEvent(new MouseEvent('pointermove', {
      clientX: 30,
      clientY: 40,
      bubbles: true
    }));

    const hoverPanel = document.querySelector('[data-omnicore-hover-inspector]');
    expect(hoverPanel).not.toBeNull();
    expect(hoverPanel.textContent).toContain('Slime');
    expect(hoverPanel.textContent).toContain('hp: 50');
    expect(hoverPanel.textContent).toContain('maxHp: 100');
    expect(hoverPanel.textContent).toContain('state: Chase');

    inspector.detach();
  });

  it('stores remote mobile viewport, touch, fps, and memory telemetry in debug snapshots', () => {
    const tools = new RemoteDevTools({ scene: { current: { children: [] } } }, { debug: true });

    tools.ingestDeviceReport({
      deviceId: 'phone-1',
      viewport: { width: 390, height: 844, dpr: 3 },
      fps: 58,
      memory: 24_000_000,
      touches: [{ type: 'touchmove', x: 128, y: 240 }]
    });

    const snapshot = tools.snapshot();

    expect(snapshot.remoteDevices).toEqual([
      expect.objectContaining({
        deviceId: 'phone-1',
        viewport: { width: 390, height: 844, dpr: 3 },
        fps: 58,
        memory: 24_000_000,
        touches: [{ type: 'touchmove', x: 128, y: 240 }]
      })
    ]);
  });

  it('converts physics bodies and static tile collisions into debug overlay commands', () => {
    const renderer = new DebugRenderer({ debug: true });
    const commands = renderer.drawPhysicsWorld({
      engine: {
        world: {
          bodies: [{
            label: 'enemy-hitbox',
            bounds: {
              min: { x: 10, y: 20 },
              max: { x: 42, y: 52 }
            },
            isSensor: false
          }, {
            label: 'bullet-trigger',
            position: { x: 80, y: 90 },
            circleRadius: 12,
            isSensor: true
          }]
        }
      },
      staticCollisionPolygons: [{ x: 0, y: 0, width: 16, height: 16 }]
    });

    expect(commands.map((command) => command.type)).toEqual(['aabb', 'circle', 'aabb']);
    expect(commands[0]).toMatchObject({ x: 10, y: 20, width: 32, height: 32 });
    expect(commands[1]).toMatchObject({ x: 80, y: 90, radius: 12 });
    expect(commands[2]).toMatchObject({ x: 0, y: 0, width: 16, height: 16 });
  });

  it('migrates versioned save slots through multiple steps and rejects downgrades', async () => {
    StorageManager.memory.clear();
    StorageManager.set('save:slot1', {
      __version: '1.0.0',
      player: { hp: 50 }
    });

    const result = await StorageManager.ensureSaveVersion('save:slot1', {
      version: '1.2.0',
      migrations: {
        '1.0.0->1.1.0': (save) => ({
          __version: '1.1.0',
          player: { health: save.player.hp }
        }),
        '1.1.0->1.2.0': (save) => ({
          __version: '1.2.0',
          player: { health: save.player.health, maxHealth: 100 }
        })
      }
    });

    expect(result).toMatchObject({
      migrated: true,
      from: '1.0.0',
      to: '1.2.0',
      steps: ['1.0.0->1.1.0', '1.1.0->1.2.0']
    });
    expect(StorageManager.get('save:slot1')).toEqual({
      __version: '1.2.0',
      player: { health: 50, maxHealth: 100 }
    });
    expect(StorageManager.get('omnicore:backup:1.0.0:save:slot1')).toEqual({
      __version: '1.0.0',
      player: { hp: 50 }
    });

    StorageManager.set('save:slot1', { __version: '2.0.0', player: { health: 80 } });
    await expect(StorageManager.ensureSaveVersion('save:slot1', {
      version: '1.2.0'
    })).rejects.toThrow('存档版本高于当前代码期望版本');
  });
});
