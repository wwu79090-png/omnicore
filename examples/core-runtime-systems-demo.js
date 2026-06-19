import OmniCore from '../src/index.js';

/**
 * Integration demo for Task, Query, Store.derive, and Input.bind.
 *
 * @param {object} options Demo dependencies.
 * @returns {object} Demo runtime handles.
 */
export function createCoreRuntimeSystemsDemo({
  button = { visible: false },
  inputTarget = null,
  enemyCount = 1000
} = {}) {
  const events = new OmniCore.EventBus();
  const input = new OmniCore.InputManager({ target: inputTarget, events });
  const store = new OmniCore.Store({ hp: 80, max_hp: 100 });
  const player = OmniCore.Query.add({ id: 'player', kind: 'player', x: 160, y: 160, vx: 0, vy: 0 });

  store.derive('hp_percent', ['hp', 'max_hp'], ({ hp, max_hp: maxHp }) => (
    maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0
  ));

  const visibilityTask = OmniCore.Task.start(function* toggleButtonVisibility() {
    yield OmniCore.Task.wait(2000);
    button.visible = true;
    yield OmniCore.Task.wait(1000);
    button.visible = false;
  });

  const enemies = Array.from({ length: enemyCount }, (_, index) => OmniCore.Query.add({
    id: `enemy-${index}`,
    kind: 'enemy',
    x: (index % 50) * 32 + 16,
    y: Math.floor(index / 50) * 32 + 16
  }));

  input.bind('move:left', ['A', 'ArrowLeft']);
  input.bind('move:right', ['D', 'ArrowRight']);
  input.bind('move:up', ['W', 'ArrowUp']);
  input.bind('move:down', ['S', 'ArrowDown']);

  events.on('action:move:left', ({ down }) => { player.vx = down ? -1 : 0; });
  events.on('action:move:right', ({ down }) => { player.vx = down ? 1 : 0; });
  events.on('action:move:up', ({ down }) => { player.vy = down ? -1 : 0; });
  events.on('action:move:down', ({ down }) => { player.vy = down ? 1 : 0; });

  function updateFrame() {
    player.x += player.vx * 4;
    player.y += player.vy * 4;
    return OmniCore.Query.inRadius(player.x, player.y, 5 * 32, (entity) => entity.kind === 'enemy');
  }

  function destroy() {
    visibilityTask.cancel();
    input.destroy();
    OmniCore.Query.clear();
  }

  return {
    button,
    enemies,
    events,
    input,
    player,
    store,
    updateFrame,
    destroy
  };
}

export default createCoreRuntimeSystemsDemo;
