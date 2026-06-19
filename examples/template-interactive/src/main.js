import OmniCore, { BehaviorTree, EventSheet } from 'omnicore';

const story = {
  flag: 'intro',
  line: 'Click the terminal to wake the city.',
  terminal: { x: 330, y: 180 }
};

const eventSheet = EventSheet.parse({
  events: [
    {
      conditions: [{ op: 'equals', left: 'state.flag', right: 'intro' }],
      actions: [{ op: 'set', target: 'state.line', value: 'The terminal hums. Follow the light.' }]
    }
  ]
});

const behaviorTree = BehaviorTree.fromJSON({
  type: 'selector',
  children: [
    {
      type: 'sequence',
      children: [
        { type: 'condition', op: 'equals', left: 'state.flag', right: 'terminal' },
        { type: 'action', op: 'call', name: 'openDoor' }
      ]
    },
    { type: 'action', op: 'call', name: 'idlePulse' }
  ]
});

const game = await new OmniCore.Game({
  parent: '#game',
  width: 640,
  height: 400,
  renderer: 'canvas',
  autoStart: false
}).init();

const scene = new OmniCore.Scene('template-interactive');
const actor = new OmniCore.Sprite('actor', { x: 120, y: 190, width: 30, height: 42, color: '#38bdf8' });
const terminal = new OmniCore.Sprite('terminal', { x: story.terminal.x, y: story.terminal.y, width: 48, height: 64, color: '#facc15' });
scene.add(actor);
scene.add(terminal);

game.store.set('template:interactive:story', story);
game.store.set('template:interactive:line', story.line);

window.addEventListener('click', (event) => {
  const rect = game.core?.canvas?.getBoundingClientRect?.() || { left: 0, top: 0 };
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hitTerminal = x >= terminal.x && x <= terminal.x + terminal.width && y >= terminal.y && y <= terminal.y + terminal.height;
  if (hitTerminal) story.flag = 'terminal';
  eventSheet.run({ state: story });
  behaviorTree.tick({
    state: story,
    actions: {
      idlePulse: () => {
        terminal.alpha = terminal.alpha === 1 ? 0.65 : 1;
        return true;
      },
      openDoor: () => {
        story.line = 'Door opened by behavior tree.';
        actor.x += 24;
        return true;
      }
    }
  });
  game.store.set('template:interactive:line', story.line);
  game.renderer.renderScene(scene);
});

game.scene.register(scene);
await game.scene.push('template-interactive');
game.renderer.renderScene(scene);
