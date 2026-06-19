import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import OmniCore from '../src/index.js';
import ErrorDiagnostics from '../src/debug/ErrorDiagnostics.js';
import TutorialGuide from '../src/debug/TutorialGuide.js';
import DeveloperUsageReport from '../src/debug/DeveloperUsageReport.js';
import { migrateSource } from '../scripts/omni-migrate.js';

describe('developer experience helpers', () => {
  it('activates TutorialGuide only in debug mode and highlights an API target', () => {
    document.body.innerHTML = '<button data-omnicore-api="Entity.create">create</button>';
    const disabled = new TutorialGuide({ debug: false });
    expect(disabled.attach()).toBe(disabled);
    expect(document.querySelector('[data-omnicore-tutorial]')).toBeNull();

    const guide = new TutorialGuide({ debug: true });
    guide.attach();
    guide.showStep('Entity.create');

    const panel = document.querySelector('[data-omnicore-tutorial]');
    const target = document.querySelector('[data-omnicore-api="Entity.create"]');
    expect(panel?.textContent).toContain('Entity.create');
    expect(target?.dataset.omnicoreTutorialActive).toBe('true');
    guide.detach();
  });

  it('diagnoses common errors with friendly Chinese hints and docs links', () => {
    const diagnostic = ErrorDiagnostics.analyze(new Error('Cannot read properties of undefined (reading "add")'));

    expect(diagnostic.title).toContain('对象未初始化');
    expect(diagnostic.message).toContain('请确认 Scene 或 Entity 已创建');
    expect(diagnostic.docs).toMatch(/docs\/DX\.md/);
    expect(OmniCore.Console.analyzeError('404 asset missing').title).toContain('资源路径');
  });

  it('exposes OmniCore.help metadata and records debug API usage reports', () => {
    const help = OmniCore.help('Game');
    const report = new DeveloperUsageReport({ debug: true });

    report.record('Game.init', { duration: 12 });
    report.record('Renderer.drawRect', { duration: 3 });
    report.record('Renderer.drawRect', { duration: 5 });

    const payload = report.generate({ reason: 'test' });
    expect(help.signature).toContain('OmniCore.Game');
    expect(help.example).toContain('new OmniCore.Game');
    expect(payload.calls['Renderer.drawRect'].count).toBe(2);
    expect(payload.suggestions).toEqual(expect.arrayContaining([expect.stringContaining('Renderer.drawRect')]));
  });
});

describe('DX pages and automation scripts', () => {
  it('ships click-to-run example playground and browser IDE pages', () => {
    expect(existsSync('examples/playground.html')).toBe(true);
    expect(existsSync('examples/modules/basic-scene.js')).toBe(true);
    expect(existsSync('website/playground/index.html')).toBe(true);

    const examplePage = readFileSync('examples/playground.html', 'utf8');
    const idePage = readFileSync('website/playground/index.html', 'utf8');

    expect(examplePage).toContain('data-example');
    expect(examplePage).toContain('type="module"');
    expect(idePage).toContain('实时预览');
    expect(idePage).toContain('iframe');
  });

  it('provides dry-run deploy output with a shareable URL field', () => {
    const output = execFileSync(process.execPath, ['scripts/deploy.js', '--dry-run', '--target', 'vercel'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    const payload = JSON.parse(output);

    expect(payload.target).toBe('vercel');
    expect(payload.shareUrl).toMatch(/^https?:\/\//);
    expect(payload.steps).toEqual(expect.arrayContaining(['build', 'compress-assets', 'upload-cdn']));
  });

  it('rewrites v1 APIs with omni-migrate and writes a migration report', () => {
    const workdir = mkdtempSync(path.join(tmpdir(), 'omni-migrate-'));
    const sourcePath = path.join(workdir, 'main.js');
    writeFileSync(sourcePath, 'OmniCore.Backend.use("canvas");\nconst scene = game.scene.currentScene;\n');

    const result = migrateSource({
      source: readFileSync(sourcePath, 'utf8'),
      file: sourcePath,
      from: '1.x',
      to: '2.x'
    });

    expect(result.output).toContain('OmniCore.Backend.switch("canvas")');
    expect(result.output).toContain('game.store.get("currentScene")');
    expect(result.changes).toHaveLength(2);
  });
});
