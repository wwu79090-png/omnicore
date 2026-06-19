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
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import Dimension3D from '../src/dimension3d/Dimension3D.js';

let createEditorApp;
let createEditorState;

describe('OmniCore experience gap closure', () => {
  let temp = null;

  beforeAll(async () => {
    ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
    ({ createEditorState } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/live-sync-protocol.js')).href));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('supports editor highlighting, origin markers, multi-select, copy paste, delete, and whole-drag undo', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      state: createEditorState({
        scene: {
          name: 'interaction-gap',
          entities: [
            { id: 'hero', name: 'Hero', x: 10, y: 16, width: 32, height: 32 },
            { id: 'slime', name: 'Slime', x: 64, y: 48, width: 24, height: 24 },
            { id: 'door', name: 'Door', x: 180, y: 48, width: 32, height: 48 }
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

    expect(root.querySelector('[data-editor-selection-outline="hero"]')).toBeTruthy();
    expect(root.querySelector('[data-editor-origin="hero"]')).toBeTruthy();

    const heroNode = root.querySelector('[data-scene-node-id="hero"]');
    heroNode.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 16, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 44, clientY: 52, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 88, clientY: 96, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(app.getState().scene.entities.find((entity) => entity.id === 'hero')).toMatchObject({ x: 88, y: 96 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(app.getState().scene.entities.find((entity) => entity.id === 'hero')).toMatchObject({ x: 10, y: 16 });

    const canvas = root.querySelector('[data-scene-drop-zone="true"]');
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      clientX: 0,
      clientY: 0,
      shiftKey: true,
      bubbles: true
    }));
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 110,
      clientY: 90,
      shiftKey: true,
      bubbles: true
    }));
    window.dispatchEvent(new MouseEvent('mouseup', { shiftKey: true, bubbles: true }));

    expect(app.getState().selectedEntityIds).toEqual(expect.arrayContaining(['hero', 'slime']));
    expect(root.querySelectorAll('.scene-node.selected')).toHaveLength(2);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, cancelable: true }));

    const copyIds = app.getState().scene.entities
      .filter((entity) => entity.id.includes('-copy-'))
      .map((entity) => entity.id);
    expect(copyIds).toHaveLength(2);
    expect(app.getState().selectedEntityIds).toEqual(copyIds);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    expect(app.getState().scene.entities.some((entity) => copyIds.includes(entity.id))).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(app.getState().scene.entities.filter((entity) => copyIds.includes(entity.id))).toHaveLength(2);

    app.destroy();
  });

  it('stops WeChat builds over 4MB and emits debug proxy logs for player runtime state', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-wechat-build-'));
    const source = path.join(temp, 'source');
    const out = path.join(temp, 'out');
    mkdirSync(source, { recursive: true });
    writeFileSync(path.join(source, 'game.js'), 'console.log("small");\n');
    writeFileSync(path.join(source, 'quality-report.json'), '{}\n');
    writeFileSync(path.join(source, 'quality-report-check.json'), '{}\n');
    writeFileSync(path.join(source, 'engine-improvements.json'), '{}\n');
    writeFileSync(path.join(source, 'production-ready-check.json'), '{}\n');

    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts['build:wechat']).toContain('scripts/build-wechat.js');

    execFileSync(process.execPath, ['scripts/build-wechat.js', '--source', source, '--out', out, '--debug'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120000
    });

    expect(readFileSync(path.join(out, 'omnicore-debug-proxy.js'), 'utf8')).toContain('player.x');
    expect(readFileSync(path.join(out, 'omnicore-debug-proxy.js'), 'utf8')).toContain('player.hp');
    expect(readFileSync(path.join(out, 'omnicore-debug-proxy.js'), 'utf8')).toContain('console.info');
    expect(existsSync(path.join(out, 'quality-report.json'))).toBe(false);
    expect(existsSync(path.join(out, 'quality-report-check.json'))).toBe(false);
    expect(existsSync(path.join(out, 'engine-improvements.json'))).toBe(false);
    expect(existsSync(path.join(out, 'production-ready-check.json'))).toBe(false);

    const oversized = path.join(temp, 'oversized');
    mkdirSync(oversized, { recursive: true });
    writeFileSync(path.join(oversized, 'game.js'), Buffer.alloc((4 * 1024 * 1024) + 1, 7));

    expect(() => execFileSync(process.execPath, ['scripts/build-wechat.js', '--source', oversized, '--out', path.join(temp, 'bad')], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000
    })).toThrow(/4MB|package size|包体/);
  });

  it('marks core deprecated APIs and migrates old JavaScript projects with a report', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-migrate-'));
    const src = path.join(temp, 'src');
    const report = path.join(temp, 'migration-report.md');
    mkdirSync(src, { recursive: true });
    const file = path.join(src, 'game.js');
    writeFileSync(file, [
      "import OmniCore from 'omnicore';",
      'const game = new OmniCore.Game({ debug: true });',
      'const store = new OmniCore.Store({});',
      "store.set('player.hp', 10);",
      "Store.set('player.x', 20);",
      "const hero = OmniCore.Entity.create('sprite', { texture: 'hero.png' });",
      "const npc = Entity.create('sprite', { texture: 'npc.png' });",
      'console.log(game, hero, npc);'
    ].join('\n'));

    execFileSync(process.execPath, ['scripts/omni-migrate.js', '--root', temp, '--write', '--report', report], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120000
    });

    const migrated = readFileSync(file, 'utf8');
    expect(migrated).toContain('OmniCore.createGame({ debug: true })');
    expect(migrated).toContain("store.setValue('player.hp', 10)");
    expect(migrated).toContain("Store.setValue('player.x', 20)");
    expect(migrated).toContain("OmniCore.createEntity('sprite'");
    expect(migrated).toContain("Entity.createEntity('sprite'");
    expect(readFileSync(report, 'utf8')).toContain('| `OmniCore.Game` |');
    expect(readFileSync('src/index.js', 'utf8')).toContain('@deprecated');
    expect(readFileSync('src/store/Store.js', 'utf8')).toContain('@deprecated');
    expect(readFileSync('src/core/Entity.js', 'utf8')).toContain('@deprecated');
  });

  it('maps 3D Z to 2D Y depth and collider projection without enabling full 3D physics', () => {
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

    expect(layer.worldToPlane(backgroundModel.position)).toMatchObject({ x: 64, y: 80 });
    expect(behind.zIndex).toBeLessThan(backgroundModel.zIndex);
    expect(backgroundModel.zIndex).toBeLessThan(front.zIndex);
    expect(layer.projectCollider3D(backgroundModel)).toMatchObject({
      minX: 48,
      maxX: 80,
      minY: 68,
      maxY: 92
    });
    expect(layer.collides2D({ x: 60, y: 72, width: 8, height: 8 }, backgroundModel)).toBe(true);
    expect(layer.collides2D({ x: 100, y: 72, width: 8, height: 8 }, backgroundModel)).toBe(false);
    expect(Dimension3D.prototype.createPhysicsWorld).toBeUndefined();
  });

  it('ships focused getting started, WeChat publish, positioning, and example debugging docs', () => {
    expect(readFileSync('README.md', 'utf8')).toMatch(/2D\/2\.5D/);
    expect(readFileSync('README.md', 'utf8')).toMatch(/非全 3D|不是全 3D/);
    expect(readFileSync('website/editor/index.html', 'utf8')).toMatch(/2D\/2\.5D|非全 3D|不是全 3D/);

    const gettingStarted = readFileSync('docs/getting-started.md', 'utf8');
    expect(gettingStarted).toContain('10 分钟');
    expect(gettingStarted).toContain('create-omnicore-app');
    expect(gettingStarted).toContain('jump');

    const wechatManual = readFileSync('docs/platforms/wechat-mini-game-publish.md', 'utf8');
    expect(wechatManual).toContain('微信开发者工具');
    expect(wechatManual).toContain('![导入项目]');
    expect(wechatManual).toContain('4MB');
    expect(wechatManual).toContain('真机调试');

    for (const name of ['template-platformer', 'template-rpg', 'template-interactive']) {
      const guide = path.join('examples', name, 'DEBUGGING.md');
      expect(existsSync(guide)).toBe(true);
      const text = readFileSync(guide, 'utf8');
      expect(text).toContain('npm test');
      expect(text).toContain('npm run dev');
      expect(text).toContain('常见问题');
    }
  });
});
