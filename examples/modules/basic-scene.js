import OmniCore from '../../src/index.js';

export const title = '基础场景';
export const description = '演示 Canvas 后端、Scene 与 Sprite 的最小组合。';

export async function run({ container }) {
  container.textContent = '';
  const mount = document.createElement('div');
  mount.style.width = '100%';
  mount.style.height = '300px';
  container.appendChild(mount);

  const game = await new OmniCore.Game({
    parent: mount,
    width: 760,
    height: 300,
    renderer: 'canvas',
    autoStart: true,
    autoAttach: true,
    debug: false
  }).init();

  const scene = new OmniCore.Scene('basic');
  scene.add(new OmniCore.Sprite('hero', {
    x: 80,
    y: 92,
    width: 56,
    height: 56,
    color: '#38bdf8',
    label: false
  }));
  scene.add(new OmniCore.Sprite('cloud', {
    x: 220,
    y: 62,
    width: 96,
    height: 32,
    color: '#e0f2fe',
    label: false
  }));
  scene.add(new OmniCore.Sprite('tile', {
    x: 52,
    y: 210,
    width: 560,
    height: 24,
    color: '#22c55e',
    label: false
  }));

  game.scene.register(scene);
  await game.scene.push('basic');

  return () => {
    game.destroy?.();
    container.textContent = '';
  };
}
