import { describe, expect, it, vi } from 'vitest';
import OmniCore, { AICommandService, Scene, Tilemap } from '../src/index.js';

describe('AI toolchain MVP', () => {
  it('generates a WASD player command and injects a controllable entity into the current scene', async () => {
    const service = new AICommandService();
    const command = await service.generateCommand('创建一个速度5的玩家实体，按WASD控制');
    const scene = new Scene('ai-scene');
    const game = {
      scene: { current: scene },
      input: { keyboard: { isDown: (code) => code === 'KeyD' } },
      renderer: { renderScene: vi.fn() },
      store: { set: vi.fn() }
    };
    scene.game = game;

    const [player] = service.inject(command, game);
    player.update(1);

    expect(command.entities[0]).toMatchObject({
      id: 'player',
      type: 'sprite',
      controls: 'wasd',
      speed: 5
    });
    expect(scene.children).toContain(player);
    expect(player.x).toBe(5);
    expect(game.store.set).toHaveBeenCalledWith('ai:lastCommand', command);
    expect(game.renderer.renderScene).toHaveBeenCalledWith(scene);
  });

  it('adds an AI command input to the F1 panel and runs commands through OmniCore.Console', async () => {
    document.body.innerHTML = '';
    const service = {
      generateAndInject: vi.fn(async () => [{ id: 'player' }])
    };
    const game = { aiCommand: service };
    const panel = new OmniCore.ApiQuickPanel({ game });

    panel.attach();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1' }));
    const input = document.querySelector('[data-omnicore-ai-command]');
    input.value = '创建一个速度5的玩家实体，按WASD控制';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    expect(service.generateAndInject).toHaveBeenCalledWith(input.value, game);
    expect(document.querySelector('[data-omnicore-ai-status]').textContent).toContain('1');

    panel.detach();
  });

  it('generates a marked tilemap and scene.json from a terrain prompt', () => {
    const generated = Tilemap.generateWithAI('森林，中央湖泊，右侧悬崖', {
      width: 8,
      height: 6,
      tileWidth: 16,
      tileHeight: 16
    });

    expect(generated.tilemap.getTileLayer('AI Terrain').data).toContain(1);
    expect(generated.tilemap.getTileLayer('AI Terrain').data).toContain(2);
    expect(generated.tilemap.getTileLayer('AI Terrain').data).toContain(3);
    expect(generated.sceneJson).toMatchObject({
      format: 'OmniCore.Scene.json',
      name: 'ai-tilemap',
      entities: expect.arrayContaining([
        expect.objectContaining({ type: 'tilemap', x: 0, y: 0 })
      ])
    });
  });
});
