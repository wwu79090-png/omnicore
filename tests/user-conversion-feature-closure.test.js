import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createWebGPUHardwareEvidencePayload,
  createWebGPUShaderVariantRegistry,
  createWebGPUTextureAtlasDescriptor
} from '../src/renderer/WebGPURenderer.js';
import OmniCore from '../src/index.js';
import { createEngineDoctorReport, writeEngineDoctorMarkdown } from '../scripts/engine-doctor.js';
import { generateMobileShells } from '../scripts/generate-mobile-shells.js';

const tempRoots = [];
let createEditorApp;

beforeAll(async () => {
  ({ createEditorApp } = await import(pathToFileURL(path.resolve('packages/omnicore-editor/src/editor-app.js')).href));
});

afterEach(() => {
  while (tempRoots.length) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe('user conversion feature closure', () => {
  it('ships three official playable templates with copy-ready project files', () => {
    const templates = [
      ['platformer', ['gravity', 'platforms', 'collectible']],
      ['rpg-dialogue', ['dialogueState', 'npc', 'inventory']],
      ['bullet-heaven', ['spawnEnemyWave', 'projectilePool', 'levelUp']]
    ];

    for (const [name, markers] of templates) {
      const root = path.join('examples', 'official-templates', name);
      const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      const main = readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
      const templateManifest = JSON.parse(readFileSync(path.join(root, 'omnicore.template.json'), 'utf8'));

      expect(packageJson.scripts.dev).toBe('vite --host 0.0.0.0');
      expect(readFileSync(path.join(root, 'index.html'), 'utf8')).toContain('id="game"');
      expect(readFileSync(path.join(root, 'README.md'), 'utf8')).toContain('npm install');
      expect(templateManifest.kind).toBe('official-playable-template');
      expect(main).toContain('new OmniCore.Game');
      expect(main).toContain('new OmniCore.Scene');
      expect(main).toContain('new OmniCore.Sprite');
      for (const marker of markers) expect(main).toContain(marker);
    }
  });

  it('documents common API recipes and links them from README', () => {
    const cookbook = readFileSync('docs/api-cookbook.md', 'utf8');
    const readme = readFileSync('README.md', 'utf8');

    for (const marker of [
      '三行画出第一个角色',
      'Sprite',
      'Scene',
      'Tween',
      'Input',
      'Audio',
      'Loader',
      'Mask',
      '2.5D',
      'Physics adapter',
      'HTML overlay',
      'exportRunnableProject'
    ]) {
      expect(cookbook).toContain(marker);
    }
    expect(readme).toContain('docs/api-cookbook.md');
    expect(readme).toContain('examples/official-templates/platformer');
  });

  it('exposes deeper WebGPU descriptors and hardware evidence payloads', () => {
    const atlas = createWebGPUTextureAtlasDescriptor({ maxTextures: 12, atlasSize: 4096 });
    const variants = createWebGPUShaderVariantRegistry();
    const evidence = createWebGPUHardwareEvidencePayload({
      device: 'RTX 4060 Laptop',
      browser: 'Chrome 126',
      gpu: { vendor: 'NVIDIA', architecture: 'Ada' },
      checks: [{ name: '1000 sprites', fps: 144, pass: true }]
    });

    expect(atlas.maxTextures).toBe(12);
    expect(atlas.atlasSize).toBe(4096);
    expect(atlas.bindGroupLayout.entries.map((entry) => entry.binding)).toEqual([0, 1]);
    expect(atlas.sampler.type).toBe('filtering');
    expect(variants.variants.instancedSprite.pipelineLabel).toContain('instanced');
    expect(variants.variants.hd2d.fragmentTargets[0]).toBe('rgba16float');
    expect(evidence.format).toBe('OmniCore.WebGPUHardwareEvidence');
    expect(evidence.hardware.device).toBe('RTX 4060 Laptop');
    expect(evidence.checks[0]).toMatchObject({ name: '1000 sprites', pass: true });
    expect(OmniCore.createWebGPUTextureAtlasDescriptor).toBe(createWebGPUTextureAtlasDescriptor);
    expect(OmniCore.createWebGPUShaderVariantRegistry).toBe(createWebGPUShaderVariantRegistry);
    expect(OmniCore.createWebGPUHardwareEvidencePayload).toBe(createWebGPUHardwareEvidencePayload);
  });

  it('exports a runnable project from the editor API', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const app = createEditorApp(root, {
      autoCheckRecovery: false,
      state: {
        scene: {
          id: 'demo-scene',
          name: 'Demo Scene',
          entities: [{ id: 'hero', type: 'sprite', texture: 'hero.png', x: 32, y: 48 }]
        },
        assets: [{ name: 'hero', path: 'assets/hero.png', type: 'image' }],
        buildTargets: { web: true, wechat: true }
      }
    });

    const project = app.EditorAPI.exportRunnableProject({
      projectName: 'demo-export',
      generatedAt: '2026-06-21T00:00:00.000Z'
    });
    const files = new Map(project.files.map((file) => [file.path, file.data]));

    expect(project.format).toBe('OmniCore.RunnableProjectExport');
    expect(project.manifest.entry).toBe('src/main.js');
    expect(files.has('package.json')).toBe(true);
    expect(files.has('index.html')).toBe(true);
    expect(files.has('src/main.js')).toBe(true);
    expect(files.has('assets/manifest.json')).toBe(true);
    expect(files.has('scenes/demo-scene.scene.json')).toBe(true);
    expect(files.get('src/main.js')).toContain("from 'omnicore'");
    expect(files.get('src/main.js')).toContain('new OmniCore.Game');
    expect(files.get('assets/manifest.json').assets[0].path).toBe('assets/hero.png');
    app.destroy();
  });

  it('reports external asset conversion plans for source asset import', async () => {
    const source = mkdtempSync(path.join(tmpdir(), 'omnicore-source-assets-'));
    const out = mkdtempSync(path.join(tmpdir(), 'omnicore-imported-assets-'));
    tempRoots.push(source, out);
    writeFileSync(path.join(source, 'hero.spine'), '{}', 'utf8');
    writeFileSync(path.join(source, 'city.blend'), 'blend', 'utf8');
    writeFileSync(path.join(source, 'ui.png'), 'png', 'utf8');
    writeFileSync(path.join(source, 'zh.fnt'), 'font', 'utf8');
    writeFileSync(path.join(source, 'theme.mp3'), 'mp3', 'utf8');

    const { default: runScript } = await import('../scripts/asset-importer.js');
    const report = runScript({
      source,
      out,
      platforms: ['web', 'wechat'],
      now: '2026-06-21T00:00:00.000Z'
    });
    const graph = JSON.parse(readFileSync(path.join(out, 'asset-graph.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(path.join(out, 'assets.manifest.json'), 'utf8'));

    expect(report.externalCommandPlan.map((item) => item.tool)).toEqual(expect.arrayContaining([
      'spine-cli',
      'blender',
      'texture-packer',
      'font-bitmap',
      'ffmpeg'
    ]));
    expect(graph.externalCommandPlan.length).toBeGreaterThanOrEqual(5);
    expect(manifest.fonts[0]).toMatchObject({ name: 'zh', format: 'bitmap-font' });
    expect(report.conversions.find((item) => item.type === 'image').edgePadding).toBe(2);
  });

  it('ships official plugin samples for leaderboard, achievements, and WeChat capabilities', () => {
    for (const name of ['Leaderboard', 'Achievements', 'WechatCapabilities']) {
      const root = path.join('examples', 'plugins', name);
      const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
      const source = readFileSync(path.join(root, 'src', 'index.js'), 'utf8');
      const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

      expect(packageJson.keywords).toContain('omnicore-plugin');
      expect(readme).toContain('Official OmniCore plugin');
      expect(source).toMatch(/install\s*\(|registerProvider/);
    }
  });

  it('adds mobile and WeChat smoke evidence guidance', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omnicore-mobile-evidence-'));
    tempRoots.push(root);
    const result = generateMobileShells({ root, appName: 'EvidenceApp' });
    const checklist = readFileSync(result.evidence.checklist, 'utf8');
    const docs = readFileSync('docs/platforms/mobile-wechat-evidence.md', 'utf8');

    expect(checklist).toContain('iOS WebView smoke');
    expect(checklist).toContain('Android WebView smoke');
    expect(checklist).toContain('WeChat DevTools');
    expect(checklist).toContain('console error/warn');
    expect(docs).toContain('WeChat DevTools');
    expect(docs).toContain('FPS');
    expect(docs).toContain('4MB');
  });

  it('adds Chinese doctor diagnostics for common release and runtime failures', () => {
    const report = createEngineDoctorReport({ generatedAt: '2026-06-21T00:00:00.000Z' });
    const markdown = writeEngineDoctorMarkdown(report);
    const codes = report.diagnostics.zh.map((item) => item.code);

    expect(codes).toEqual(expect.arrayContaining([
      'resource-404',
      'font-load-failed',
      'webgl-webgpu-unsupported',
      'npm-publish-pending',
      'vercel-wrong-site',
      'wechat-package-state'
    ]));
    expect(markdown).toContain('## 中文诊断建议');
    expect(markdown).toContain('资源 404');
    expect(markdown).toContain('中文字体');
  });
});
