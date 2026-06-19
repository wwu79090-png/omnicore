import { afterEach, describe, expect, it } from 'vitest';
import OmniCore, {
  AnimationEditor,
  AssetBrowser,
  Game,
  Scene,
  Sprite
} from '../src/index.js';

describe('editor MVP upgrade workflow', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('manages an asset path tree with folder creation, drag rename, and fast search', () => {
    const browser = new AssetBrowser({
      entries: [
        'assets/sprites/hero.png',
        'assets/sprites/enemy.png',
        { path: 'assets/prefabs/slime.json', type: 'prefab', data: { name: 'slime' } }
      ]
    });

    browser.createFolder('assets', 'ui');
    browser.renamePath('assets/sprites/hero.png', 'player.png');

    expect(browser.entries.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      'assets/sprites/player.png',
      'assets/sprites/enemy.png',
      'assets/prefabs/slime.json',
      'assets/ui/'
    ]));
    expect(browser.search('slime')).toEqual([
      expect.objectContaining({ path: 'assets/prefabs/slime.json', type: 'prefab' })
    ]);
    expect(browser.toTree().children.assets.children.sprites.children['player.png'].type).toBe('file');
  });

  it('links scene tree selection, editable properties, asset browser, and prefab preview without inserting prefab into the scene', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const game = await new Game({
      parent: '#root',
      renderer: 'canvas',
      autoStart: false,
      editor: true,
      editorPanel: {
        assets: [
          'assets/sprites/hero.png',
          {
            path: 'assets/prefabs/slime.json',
            type: 'prefab',
            data: {
              name: 'Slime Prefab',
              entities: [{ type: 'sprite', texture: 'slime', x: 4, y: 6, width: 16, height: 16 }]
            }
          }
        ],
        animation: {
          frames: ['idle-0', 'idle-1']
        }
      }
    }).init();
    const scene = new Scene('mvp-editor');
    const hero = scene.add(new Sprite('hero', { x: 10, y: 12, width: 32, height: 32, scale: 1 }));
    hero.name = 'Hero';
    game.scene.register(scene);
    await game.scene.push('mvp-editor');

    game.editor.refresh();
    document.querySelector('[data-editor-entity-id="0"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const xInput = document.querySelector('[data-editor-prop="x"]');
    const scaleInput = document.querySelector('[data-editor-prop="scale"]');
    xInput.value = '72';
    scaleInput.value = '2';
    xInput.dispatchEvent(new Event('input', { bubbles: true }));
    scaleInput.dispatchEvent(new Event('input', { bubbles: true }));

    document.querySelector('[data-editor-asset-path="assets/prefabs/slime.json"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(hero).toMatchObject({ x: 72, scale: 2, scaleX: 2, scaleY: 2 });
    expect(game.store.get('editor:selectedEntity')).toMatchObject({ name: 'Hero', x: 72, scale: 2 });
    expect(scene.children).toHaveLength(1);
    expect(document.querySelector('[data-omnicore-prefab-preview]')?.textContent).toContain('Slime Prefab');
    expect(game.store.get('editor:prefabPreview')).toMatchObject({
      path: 'assets/prefabs/slime.json',
      insertedIntoScene: false
    });
    expect(OmniCore.AssetBrowser).toBe(AssetBrowser);

    game.destroy();
  });

  it('drags timeline keyframes and previews sprite rotation, scale, and alpha in-panel', () => {
    const sprite = new Sprite('hero', { rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 });
    const editor = new AnimationEditor({
      frames: ['idle-0', 'idle-1'],
      targetSprite: sprite
    }).attach(document.body);

    editor.addKeyframe('idle-0', { time: 0, rotation: 0, scale: 1, alpha: 1 });
    editor.addKeyframe('idle-1', { time: 10, rotation: 1, scale: 2, alpha: 0.4 });
    editor.moveKeyframe(1, 6);
    const preview = editor.previewAt(3);

    expect(editor.keyframes[1].time).toBe(6);
    expect(preview).toMatchObject({
      rotation: 0.5,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0.7
    });
    expect(sprite.rotation).toBeCloseTo(0.5);
    expect(sprite.scaleX).toBeCloseTo(1.5);
    expect(sprite.scaleY).toBeCloseTo(1.5);
    expect(sprite.alpha).toBeCloseTo(0.7);
    expect(document.querySelector('[data-omnicore-animation-preview]')).toBeTruthy();
  });
});
