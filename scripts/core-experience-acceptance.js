import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CORE_EXPERIENCE_ACCEPTANCE_ITEMS = Object.freeze([
  {
    key: 'undoRedo',
    label: 'Editor undo/redo',
    owner: 'core-experience'
  },
  {
    key: 'wechatPackageSizeGate',
    label: 'build:wechat 4MB package gate',
    owner: 'platform-publishing'
  },
  {
    key: 'deprecatedApiMigration',
    label: 'Deprecated API migration check',
    owner: 'api-stability'
  },
  {
    key: 'depthOcclusion25d',
    label: '2.5D depth occlusion example',
    owner: 'runtime-2.5d'
  },
  {
    key: 'gettingStartedPath',
    label: 'Getting started path',
    owner: 'onboarding'
  }
]);

const CHECKS = {
  undoRedo: checkUndoRedo,
  wechatPackageSizeGate: checkWechatPackageSizeGate,
  deprecatedApiMigration: checkDeprecatedApiMigration,
  depthOcclusion25d: checkDepthOcclusion25d,
  gettingStartedPath: checkGettingStartedPath
};
const STATUS_VALUES = new Set(['pass', 'fail', 'todo']);
const DEFAULT_OUT_FILE = path.join('docs', 'release-notes', 'core-experience-acceptance-latest.json');

export async function runCoreExperienceAcceptance({
  projectRoot = process.cwd(),
  outFile = path.join(projectRoot, DEFAULT_OUT_FILE),
  tempRoot = null
} = {}) {
  const root = path.resolve(projectRoot);
  const ownedTempRoot = tempRoot ? null : mkdtempSync(path.join(tmpdir(), 'omnicore-core-experience-'));
  const scratchRoot = path.resolve(tempRoot || ownedTempRoot);

  try {
    const items = [];
    for (const item of CORE_EXPERIENCE_ACCEPTANCE_ITEMS) {
      items.push(await runCheck(item, { projectRoot: root, tempRoot: scratchRoot }));
    }

    const report = {
      title: 'OmniCore core experience acceptance baseline',
      generatedAt: new Date().toISOString(),
      summary: summarize(items),
      items
    };

    if (outFile) writeJson(path.resolve(outFile), report);
    return report;
  } finally {
    if (ownedTempRoot) rmSync(ownedTempRoot, { recursive: true, force: true });
  }
}

async function runCheck(item, context) {
  try {
    const result = await CHECKS[item.key](context);
    const status = STATUS_VALUES.has(result.status) ? result.status : 'pass';
    return {
      ...item,
      status,
      evidence: normalizeEvidence(result.evidence),
      notes: result.notes || []
    };
  } catch (error) {
    return {
      ...item,
      status: 'fail',
      evidence: [error.message],
      notes: []
    };
  }
}

async function checkUndoRedo({ projectRoot }) {
  const cleanup = await installDom();
  try {
    const editorModule = await import(pathToFileURL(path.join(projectRoot, 'packages', 'omnicore-editor', 'src', 'editor-app.js')).href);
    const stateModule = await import(pathToFileURL(path.join(projectRoot, 'packages', 'omnicore-editor', 'src', 'live-sync-protocol.js')).href);
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = editorModule.createEditorApp(root, {
      autoCheckRecovery: false,
      state: stateModule.createEditorState({
        scene: {
          name: 'acceptance-undo-redo',
          entities: [
            { id: 'hero', name: 'Hero', x: 10, y: 16, width: 32, height: 32 }
          ]
        },
        selectedEntityId: 'hero',
        dockLayout: {
          left: ['hierarchy'],
          center: ['scene-view'],
          right: ['inspector'],
          bottom: ['tilemap']
        }
      })
    });

    const heroNode = root.querySelector('[data-scene-node-id="hero"]');
    assert(heroNode, 'editor scene node for hero was not rendered');
    heroNode.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 16, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 88, clientY: 96, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    assertEntityPosition(app, 'hero', { x: 88, y: 96 }, 'drag did not update hero position');
    app.undo();
    assertEntityPosition(app, 'hero', { x: 10, y: 16 }, 'undo did not restore original position');
    app.redo();
    assertEntityPosition(app, 'hero', { x: 88, y: 96 }, 'redo did not restore dragged position');
    app.destroy();

    return {
      status: 'pass',
      evidence: [
        'createEditorApp rendered a real scene node',
        'drag mutation entered history',
        'undo restored x=10 y=16',
        'redo restored x=88 y=96'
      ]
    };
  } finally {
    cleanup();
  }
}

function checkWechatPackageSizeGate({ projectRoot, tempRoot }) {
  const packageJson = readJson(path.join(projectRoot, 'package.json'));
  assert(packageJson.scripts?.['build:wechat'] === 'node scripts/build-wechat.js', 'package.json missing build:wechat script');

  const source = path.join(tempRoot, 'wechat-oversize-source');
  const out = path.join(tempRoot, 'wechat-oversize-out');
  mkdirSync(source, { recursive: true });
  writeFileSync(path.join(source, 'game.js'), Buffer.alloc((4 * 1024 * 1024) + 1, 7));

  let message = '';
  try {
    execFileSync(process.execPath, [
      path.join(projectRoot, 'scripts', 'build-wechat.js'),
      '--source',
      source,
      '--out',
      out
    ], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000
    });
  } catch (error) {
    message = [
      error.stdout?.toString?.() || '',
      error.stderr?.toString?.() || '',
      error.message
    ].filter(Boolean).join('\n');
  }
  assert(/4MB|package size|exceeds/i.test(message), 'buildWechatPackage did not abort over the 4MB limit');

  return {
    status: 'pass',
    evidence: [
      'package.json exposes npm run build:wechat',
      '4MB+1 byte fixture aborts build-wechat',
      message
    ]
  };
}

function checkDeprecatedApiMigration({ projectRoot, tempRoot }) {
  const packageJson = readJson(path.join(projectRoot, 'package.json'));
  assert(packageJson.scripts?.['audit:deprecated'] === 'node scripts/audit-deprecated.js', 'package.json missing audit:deprecated script');

  const fixtureRoot = path.join(tempRoot, 'deprecated-fixture');
  const fixtureSrc = path.join(fixtureRoot, 'src');
  const report = path.join(fixtureRoot, 'migration-report.md');
  mkdirSync(fixtureSrc, { recursive: true });
  const file = path.join(fixtureSrc, 'game.js');
  const source = [
    "import OmniCore from 'omnicore';",
    'const game = new OmniCore.Game({ debug: true });',
    'const store = new OmniCore.Store({});',
    "store.set('player.hp', 10);",
    "const hero = OmniCore.Entity.create('sprite', { texture: 'hero.png' });",
    'console.log(game, hero);'
  ].join('\n');
  writeFileSync(file, source, 'utf8');

  execFileSync(process.execPath, [
    path.join(projectRoot, 'scripts', 'omni-migrate.js'),
    '--root',
    fixtureRoot,
    '--write',
    '--report',
    report
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 120000
  });

  const migrated = readFileSync(file, 'utf8');
  const migrationReport = readFileSync(report, 'utf8');
  assert(migrated.includes('OmniCore.createGame({ debug: true })'), 'omni-migrate did not rewrite OmniCore.Game');
  assert(migrated.includes("store.setValue('player.hp', 10)"), 'omni-migrate did not rewrite Store#set');
  assert(migrated.includes("OmniCore.createEntity('sprite'"), 'omni-migrate did not rewrite OmniCore.Entity.create');
  assert(migrationReport.includes('| `OmniCore.Game` |'), 'migration report did not include OmniCore.Game');
  assert(migrationReport.includes('| `OmniCore.Entity.create` |'), 'migration report did not include OmniCore.Entity.create');

  return {
    status: 'pass',
    evidence: [
      'package.json exposes npm run audit:deprecated',
      'omni-migrate rewrote deprecated API calls in fixture',
      'migration report includes deprecated API rows'
    ]
  };
}

async function checkDepthOcclusion25d({ projectRoot }) {
  const Dimension3D = (await import(pathToFileURL(path.join(projectRoot, 'src', 'dimension3d', 'Dimension3D.js')).href)).default;
  const exampleFile = path.join(projectRoot, 'examples', 'template-25d-showcase', 'src', 'main.js');
  assert(existsSync(exampleFile), '2.5D showcase example is missing');

  const layer = new Dimension3D.PlaneLayer({ zToYScale: 16 });
  const backgroundModel = {
    id: 'tower',
    position: { x: 64, y: 0, z: 5 },
    bounds: { width: 32, height: 48, depth: 24 }
  };
  const behind = { id: 'hero-behind', x: 56, y: 24, width: 16, height: 24 };
  const front = { id: 'hero-front', x: 56, y: 92, width: 16, height: 24 };

  layer.add3D(backgroundModel);
  layer.add2D(behind);
  layer.add2D(front);
  layer.applyZSort();

  assertEqual(layer.worldToPlane(backgroundModel.position).y, 80, 'worldToPlane did not map 3D Z to 2D Y');
  assert(behind.zIndex < backgroundModel.zIndex, 'behind sprite was not sorted behind the model');
  assert(backgroundModel.zIndex < front.zIndex, 'front sprite was not sorted in front of the model');
  assert(layer.collides2D({ x: 60, y: 72, width: 8, height: 8 }, backgroundModel), 'projected 2D collision did not hit the model footprint');
  assert(!layer.collides2D({ x: 100, y: 72, width: 8, height: 8 }, backgroundModel), 'projected 2D collision produced a false positive');
  assert(Dimension3D.prototype.createPhysicsWorld === undefined, 'Dimension3D unexpectedly exposes full 3D physics');

  return {
    status: 'pass',
    evidence: [
      'examples/template-25d-showcase exists',
      'PlaneLayer maps z=5 to y=80',
      '2D/3D/2D zIndex ordering is correct',
      'projected collider hit and miss both verified'
    ]
  };
}

function checkGettingStartedPath({ projectRoot, tempRoot }) {
  const docs = readFileSync(path.join(projectRoot, 'docs', 'getting-started.md'), 'utf8');
  assert(docs.includes('create-omnicore-app'), 'getting-started docs do not mention create-omnicore-app');
  assert(docs.includes('npm run dev'), 'getting-started docs do not include npm run dev');
  assert(/jump/i.test(docs), 'getting-started docs do not include jump verification');

  const appDir = path.join(tempRoot, 'my-first-game');
  execFileSync(process.execPath, [
    path.join(projectRoot, 'scripts', 'create-omnicore-app.mjs'),
    appDir,
    '--template',
    'platformer'
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 120000
  });

  const scaffoldPackage = readJson(path.join(appDir, 'package.json'));
  const scaffoldSource = readFileSync(path.join(appDir, 'src', 'main.js'), 'utf8');
  assert(scaffoldPackage.scripts?.dev === 'vite --host 0.0.0.0', 'scaffolded project is missing the dev script');
  assert(scaffoldSource.includes('this.velocityY = -8'), 'platformer scaffold is missing jump behavior');

  return {
    status: 'pass',
    evidence: [
      'docs/getting-started.md includes scaffold, dev, and jump steps',
      'create-omnicore-app generated a platformer project',
      'generated project exposes npm run dev',
      'generated src/main.js contains jump behavior'
    ]
  };
}

async function installDom() {
  if (typeof document !== 'undefined' && typeof window !== 'undefined') return () => {};
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLCanvasElement: dom.window.HTMLCanvasElement,
    MouseEvent: dom.window.MouseEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage
  };
  const previous = new Map();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value
    });
  }
  return () => {
    for (const [key, descriptor] of previous.entries()) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  };
}

function assertEntityPosition(app, id, expected, message) {
  const entity = app.getState().scene.entities.find((item) => item.id === id);
  assert(entity, `entity not found: ${id}`);
  assertEqual(entity.x, expected.x, `${message}: x=${entity.x}`);
  assertEqual(entity.y, expected.y, `${message}: y=${entity.y}`);
}

function summarize(items) {
  return {
    total: items.length,
    pass: items.filter((item) => item.status === 'pass').length,
    fail: items.filter((item) => item.status === 'fail').length,
    todo: items.filter((item) => item.status === 'todo').length,
    ok: items.every((item) => item.status !== 'fail')
  };
}

function normalizeEvidence(evidence) {
  if (!evidence) return [];
  return Array.isArray(evidence) ? evidence.map(String) : [String(evidence)];
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, payload) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function parseArgs(argv) {
  const options = {
    outFile: path.join(process.cwd(), DEFAULT_OUT_FILE),
    strict: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.outFile = path.resolve(argv[index]);
    } else if (arg === '--no-write') {
      options.outFile = null;
    } else if (arg === '--strict') {
      options.strict = true;
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  const report = await runCoreExperienceAcceptance({ outFile: options.outFile });
  console.log(JSON.stringify(report, null, 2));
  if (options.strict && report.summary.fail > 0) process.exitCode = 1;
}
