#!/usr/bin/env node
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

function parseArgs(argv) {
  const positional = [];
  const options = { platform: 'web', template: null, deploy: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--platform') {
      options.platform = argv[index + 1] || 'web';
      index += 1;
    } else if (arg === '--template') {
      options.template = argv[index + 1] || 'basic';
      index += 1;
    } else if (arg === '--deploy') {
      options.deploy = argv[index + 1] || null;
      index += 1;
    } else {
      positional.push(arg);
    }
  }
  return {
    appName: positional[0] || 'omnicore-app',
    template: options.template || positional[1] || 'basic',
    platform: options.platform,
    deploy: options.deploy
  };
}

function packageJson(appName) {
  return JSON.stringify(
    {
      name: appName,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite --host 0.0.0.0',
        build: 'vite build'
      },
      dependencies: {
        omnicore: '^0.1.0'
      },
      devDependencies: {
        vite: '^8.0.16'
      }
    },
    null,
    2
  );
}

function baseFiles(appName) {
  return {
    'package.json': packageJson(appName),
    'index.html': `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`,
    'asset-manifest.json': JSON.stringify({
      assets: [
        { key: 'default-atlas', type: 'json', url: '/assets/sprites/default/default-atlas.json' }
      ]
    }, null, 2)
  };
}

function basicTemplate(appName) {
  return {
    ...baseFiles(appName),
    'src/main.js': `import OmniCore, { Scene, Sprite } from 'omnicore';

class PlayScene extends Scene {
  create() {
    this.hero = this.add(new Sprite('player', { x: 120, y: 120, width: 32, height: 32 }));
  }

  update() {
    if (this.input.keyboard.isDown('ArrowRight')) this.hero.x += 2;
    if (this.input.keyboard.isDown('ArrowLeft')) this.hero.x -= 2;
  }
}

const game = await new OmniCore.Game({
  container: '#app',
  width: 960,
  height: 540,
  renderer: 'canvas',
  debug: true
}).init();

game.scene.register(new PlayScene('play'));
game.scene.push('play');
`
  };
}

function rpgMiniTemplate(appName) {
  return {
    ...baseFiles(appName),
    'src/main.js': `import OmniCore, { Scene, Sprite } from 'omnicore';

const inventory = [{ id: 'potion', count: 2 }];

class RpgScene extends Scene {
  create() {
    this.dialogue = document.createElement('div');
    this.dialogue.textContent = '靠近 NPC 按 Space 对话 | 背包: potion x2';
    Object.assign(this.dialogue.style, {
      position: 'fixed',
      left: '16px',
      bottom: '16px',
      padding: '8px 12px',
      color: '#fff',
      background: 'rgba(0,0,0,0.72)',
      font: '14px sans-serif'
    });
    document.body.appendChild(this.dialogue);

    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        this.add(new Sprite('grass', { x: x * 32, y: y * 32, width: 32, height: 32, zIndex: 0 }));
      }
    }
    this.player = this.add(new Sprite('player', { x: 64, y: 64, width: 28, height: 28, zIndex: 2 }));
    this.npc = this.add(new Sprite('npc', { x: 220, y: 120, width: 28, height: 28, zIndex: 1 }));
    this.game?.store?.set?.('template:rpg:inventory', inventory);
  }

  update() {
    const speed = 2;
    if (this.input.keyboard.isDown('ArrowRight')) this.player.x += speed;
    if (this.input.keyboard.isDown('ArrowLeft')) this.player.x -= speed;
    if (this.input.keyboard.isDown('ArrowDown')) this.player.y += speed;
    if (this.input.keyboard.isDown('ArrowUp')) this.player.y -= speed;
    const nearNpc = Math.abs(this.player.x - this.npc.x) < 36 && Math.abs(this.player.y - this.npc.y) < 36;
    if (nearNpc && this.input.keyboard.isDown('Space')) this.dialogue.textContent = 'NPC：欢迎来到 OmniCore RPG Mini。';
  }

  destroy() {
    this.dialogue?.remove();
    super.destroy();
  }
}

const game = await new OmniCore.Game({
  container: '#app',
  width: 384,
  height: 256,
  renderer: 'canvas',
  debug: true
}).init();

game.scene.register(new RpgScene('rpg'));
game.scene.push('rpg');
`
  };
}

function platformerTemplate(appName) {
  return {
    ...baseFiles(appName),
    'src/main.js': `import OmniCore, { Scene, Sprite } from 'omnicore';

// platformer template
class PlatformerScene extends Scene {
  create() {
    this.player = this.add(new Sprite('player', { x: 80, y: 120, width: 28, height: 28, zIndex: 2 }));
    this.enemy = this.add(new Sprite('enemy', { x: 320, y: 192, width: 28, height: 28, zIndex: 2 }));
    this.velocityY = 0;
    this.enemyDirection = -1;
    for (let x = 0; x < 16; x += 1) this.add(new Sprite('ground', { x: x * 32, y: 220, width: 32, height: 32 }));
  }

  update() {
    if (this.input.keyboard.isDown('ArrowLeft')) this.player.x -= 2;
    if (this.input.keyboard.isDown('ArrowRight')) this.player.x += 2;
    if (this.input.keyboard.isDown('Space') && this.player.y >= 192) this.velocityY = -8;
    this.velocityY += 0.35;
    this.player.y = Math.min(192, this.player.y + this.velocityY);
    this.enemy.x += this.enemyDirection;
    if (this.enemy.x < 220 || this.enemy.x > 360) this.enemyDirection *= -1;
    const hitEnemy = Math.abs(this.player.x - this.enemy.x) < 26 && Math.abs(this.player.y - this.enemy.y) < 26;
    if (hitEnemy) this.player.x = 80;
  }
}

const game = await new OmniCore.Game({ container: '#app', width: 512, height: 256, renderer: 'canvas', debug: true }).init();
game.scene.register(new PlatformerScene('platformer'));
game.scene.push('platformer');
`
  };
}

function rpgTemplate(appName) {
  const files = rpgMiniTemplate(appName);
  files['src/main.js'] = files['src/main.js'].replace('class RpgScene', '// rpg template\nclass RpgScene');
  return files;
}

function puzzleTemplate(appName) {
  return {
    ...baseFiles(appName),
    'src/main.js': `import OmniCore, { Scene, Sprite } from 'omnicore';

// puzzle template
class PuzzleScene extends Scene {
  create() {
    this.tiles = [];
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const tile = this.add(new Sprite((x + y) % 2 ? 'blue' : 'green', { x: 80 + x * 42, y: 48 + y * 42, width: 36, height: 36 }));
        tile.name = \`tile-\${x}-\${y}\`;
        this.tiles.push(tile);
      }
    }
    this.input.pointer.on('click', ({ x, y }) => {
      const tile = this.tiles.find((item) => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
      if (tile) tile.alpha = tile.alpha === 1 ? 0.4 : 1;
    });
  }
}

const game = await new OmniCore.Game({ container: '#app', width: 360, height: 240, renderer: 'canvas', debug: true }).init();
game.scene.register(new PuzzleScene('puzzle'));
game.scene.push('puzzle');
`
  };
}

function interactiveTemplate(appName) {
  return {
    ...baseFiles(appName),
    'src/main.js': `import OmniCore, { BehaviorTree, EventSheet, Scene, Sprite } from 'omnicore';

const story = { flag: 'intro', line: 'Click the terminal.' };
const eventSheet = EventSheet.parse({
  events: [{
    conditions: [{ op: 'equals', left: 'state.flag', right: 'terminal' }],
    actions: [{ op: 'set', target: 'state.line', value: 'Terminal activated.' }]
  }]
});
const behaviorTree = BehaviorTree.fromJSON({
  type: 'selector',
  children: [
    { type: 'sequence', children: [
      { type: 'condition', op: 'equals', left: 'state.flag', right: 'terminal' },
      { type: 'action', op: 'call', name: 'advanceStory' }
    ] },
    { type: 'action', op: 'call', name: 'idle' }
  ]
});

class InteractiveScene extends Scene {
  create() {
    this.actor = this.add(new Sprite('actor', { x: 120, y: 190, width: 30, height: 42, zIndex: 2 }));
    this.terminal = this.add(new Sprite('terminal', { x: 330, y: 180, width: 48, height: 64, zIndex: 1 }));
    this.input.pointer.on('click', ({ x, y }) => {
      const hit = x >= this.terminal.x && x <= this.terminal.x + this.terminal.width && y >= this.terminal.y && y <= this.terminal.y + this.terminal.height;
      if (hit) story.flag = 'terminal';
      eventSheet.run({ state: story });
      behaviorTree.tick({
        state: story,
        actions: {
          idle: () => true,
          advanceStory: () => {
            story.line = 'Behavior tree opened the route.';
            this.actor.x += 24;
            return true;
          }
        }
      });
      this.game.store.set('template:interactive:line', story.line);
    });
  }
}

const game = await new OmniCore.Game({ container: '#app', width: 512, height: 256, renderer: 'canvas', debug: true }).init();
game.scene.register(new InteractiveScene('interactive'));
game.scene.push('interactive');
`
  };
}

function selectTemplate(template, appName) {
  switch (template) {
    case 'platformer':
      return platformerTemplate(appName);
    case 'rpg':
    case 'rpg-mini':
      return rpgTemplate(appName);
    case '3d-physics':
    case '3d_physics':
      return {
        ...baseFiles(appName),
        'src/main.js': `import { createLeanRuntime } from 'omnicore/lean';

const bootstrapRoot = document.createElement('div');
bootstrapRoot.id = 'game-stage';
document.body.appendChild(bootstrapRoot);
const backgroundRoot = document.createElement('div');
backgroundRoot.id = 'background-layer';
document.body.appendChild(backgroundRoot);

const game = await new (await import('omnicore')).default({
  parent: '#game-stage',
  width: 960,
  height: 540,
  renderer: 'pixi',
  debug: true,
  dimension3D: {
    backend: 'three',
    parent: '#background-layer',
    decorativeModel: {
      url: '/models/demo-scene.glb',
      position: { x: 0, y: -1, z: -6 },
      scale: 1.25,
      rotationSpeed: { y: 0.1 }
    }
  }
}).init();

const physicsRuntime = await createLeanRuntime({
  debug: false,
  renderer: { backend: 'canvas', parent: '#game-stage' },
  physics: {}
});
const physics = physicsRuntime.addons.physics;
await physics.loadExternal(async () => {
  const module = await import('https://cdn.jsdelivr.net/npm/matter-js@0.20.1/build/matter.mjs');
  return module.Matter || module;
});
physics.mount();
console.log('[omnicore] 3D + physics production template ready.');
`
      };
    case 'puzzle':
      return puzzleTemplate(appName);
    case 'interactive':
      return interactiveTemplate(appName);
    default:
      return basicTemplate(appName);
  }
}

function wechatFiles(appName) {
  return {
    'project.config.json': JSON.stringify({
      appid: 'touristappid',
      projectname: appName,
      compileType: 'game',
      miniprogramRoot: './'
    }, null, 2),
    'game.json': JSON.stringify({
      deviceOrientation: 'portrait',
      showStatusBar: false
    }, null, 2),
    'wechat-adapter.js': `// Minimal WeChat Mini Game adapter for OmniCore starters.
globalThis.window = globalThis;
globalThis.document ||= {
  createElement(type) {
    if (type === 'canvas' && typeof wx !== 'undefined') return wx.createCanvas();
    return { style: {} };
  },
  body: { appendChild() {}, removeChild() {} },
  querySelector() { return null; }
};
globalThis.requestAnimationFrame ||= (fn) => setTimeout(() => fn(Date.now()), 16);
globalThis.cancelAnimationFrame ||= (id) => clearTimeout(id);
`
  };
}

function deployFiles(target) {
  if (target === 'vercel') {
    return {
      'vercel.json': JSON.stringify({
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
        framework: 'vite'
      }, null, 2)
    };
  }
  if (target === 'netlify') {
    return {
      'netlify.toml': `[build]
  command = "npm run build"
  publish = "dist"
`
    };
  }
  return {};
}

async function writeFiles(root, files) {
  await Promise.all(Object.entries(files).map(async ([file, content]) => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }));
}

const options = parseArgs(process.argv.slice(2));
const root = path.resolve(process.cwd(), options.appName);
const selected = selectTemplate(options.template, options.appName);

await mkdir(root, { recursive: true });
await writeFiles(root, {
  ...selected,
  ...(options.platform === 'wechat' ? wechatFiles(options.appName) : {}),
  ...deployFiles(options.deploy)
});
await cp(path.join(repoRoot, 'assets/sprites/default'), path.join(root, 'assets/sprites/default'), { recursive: true });

const command = path.basename(fileURLToPath(import.meta.url));
console.log(`${command}: created ${options.appName} with ${options.template} template at ${root}`);
