import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const positioning = 'OmniCore: 33KB Lean Core Web 游戏引擎，1000 Sprite 演示目标 144 FPS。';

describe('showcase adoption and feedback loop', () => {
  it('uses one repeatable positioning anchor across public surfaces', () => {
    const readme = readFileSync('README.md', 'utf8');
    const homepage = readFileSync('website/index.html', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(readme).toContain(positioning);
    expect(homepage).toContain(positioning);
    expect(pkg.description).toContain('33KB Lean Core Web 游戏引擎');
    expect(homepage).toContain('data-positioning-anchor');
    expect(homepage).toContain('data-flagship-case="code-awakener"');
    expect(homepage).toContain('代码觉醒者');
    expect(homepage).toMatch(/Play Now|立即试玩/);
  });

  it('ships a playable 30-minute full game demo using OmniCore core APIs', () => {
    const readme = readFileSync('examples/full-game-demo/README.md', 'utf8');
    const index = readFileSync('examples/full-game-demo/index.html', 'utf8');
    const main = readFileSync('examples/full-game-demo/main.js', 'utf8');
    const examples = readFileSync('examples/index.html', 'utf8');
    const homepage = readFileSync('website/index.html', 'utf8');

    expect(readme).toContain('30 分钟');
    expect(readme).toContain('只使用 OmniCore 核心功能');
    expect(readme).toContain('可玩');
    expect(index).toContain('data-full-game-demo');
    expect(index).toContain('./main.js');
    expect(main).toContain("from '../../src/index.js'");
    expect(main).toContain('new OmniCore.Game');
    expect(main).toContain('new OmniCore.Scene');
    expect(main).toContain('new OmniCore.Sprite');
    expect(main).toContain('restartGame');
    expect(main).toContain('score');
    expect(main).toMatch(/ArrowLeft|KeyA/);
    expect(existsSync('examples/full-game-demo/index.html')).toBe(true);
    expect(examples).toContain('examples/full-game-demo/');
    expect(homepage).toContain('examples/full-game-demo/');
  });

  it('ships a market showcase demo that proves performance, 2.5D layering, and HTML UI migration in one page', () => {
    const readme = readFileSync('examples/market-showcase/README.md', 'utf8');
    const index = readFileSync('examples/market-showcase/index.html', 'utf8');
    const main = readFileSync('examples/market-showcase/main.js', 'utf8');
    const pkg = JSON.parse(readFileSync('examples/market-showcase/package.json', 'utf8'));
    const examples = readFileSync('examples/index.html', 'utf8');
    const rootReadme = readFileSync('README.md', 'utf8');

    expect(pkg.scripts.dev).toContain('vite');
    expect(index).toContain('data-market-showcase');
    expect(index).toContain('data-html-overlay');
    expect(main).toContain("from '../../src/index.js'");
    expect(main).toContain('new OmniCore.Game');
    expect(main).toContain('new OmniCore.Scene');
    expect(main).toContain('new OmniCore.Sprite');
    expect(main).toContain('spawnSpriteCloud(1000)');
    expect(main).toContain('parallaxLayers');
    expect(main).toContain('htmlOverlayState');
    expect(readme).toContain('三行代码');
    expect(readme).toContain('144 FPS');
    expect(readme).toContain('2.5D');
    expect(examples).toContain('examples/market-showcase/');
    expect(rootReadme).toContain('examples/market-showcase/');
  });

  it('turns the example entry into a Chinese OmniCore Hub launcher without breaking backend switching', () => {
    const examples = readFileSync('examples/index.html', 'utf8');
    const rootIndex = readFileSync('index.html', 'utf8');

    expect(examples).toContain('<title>OmniCore Hub</title>');
    expect(examples).toContain('data-omnicore-hub');
    expect(examples).toContain('项目中心');
    expect(examples).toContain('Demo 中心');
    expect(examples).toContain('模板库');
    expect(examples).toContain('诊断');
    expect(examples).toContain('构建发布');
    expect(examples).toContain('文档');
    expect(examples).toContain('data-hub-section="project-center"');
    expect(examples).toContain('data-hub-section="demo-center"');
    expect(examples).toContain('data-hub-section="template-library"');
    expect(examples).toContain('data-hub-section="diagnostics"');
    expect(examples).toContain('data-hub-section="build-publish"');
    expect(examples).toContain('data-hub-section="docs"');
    expect(examples).toContain('data-hub-action="open-editor"');
    expect(examples).toContain('data-hub-command="npm run editor"');
    expect(examples).toContain('data-hub-command="npm run doctor"');
    expect(examples).toContain('data-hub-command="npm run build:wechat"');
    expect(examples).toContain('examples/full-game-demo/');
    expect(examples).toContain('examples/market-showcase/');
    expect(examples).toContain('website/playground/');
    expect(examples).toContain('docs/api/index.html');
    expect(examples).toContain('data-backend="pixi"');
    expect(examples).toContain('data-backend="canvas"');
    expect(examples).toContain('data-backend="webgl"');
    expect(examples).toContain("get('backend') || 'canvas'");
    expect(examples).not.toContain('<title>OmniCore Backend Switch</title>');
    expect(rootIndex).toContain('data-root-launcher-redirect');
    expect(rootIndex).toContain('正在打开 OmniCore Hub');
    expect(rootIndex).toContain('window.location.replace');
    expect(rootIndex).toContain('/examples/');
    expect(rootIndex).not.toContain('assets/index-');
  });

  it('adds a complete animated Hub onboarding layer for zero-experience creators', () => {
    const examples = readFileSync('examples/index.html', 'utf8');

    expect(examples).toContain('data-boot-animation');
    expect(examples).toContain('data-boot-progress');
    expect(examples).toContain('data-boot-stage="runtime"');
    expect(examples).toContain('data-motion-card');
    expect(examples).toContain('data-capability-section="complete-workflow"');
    expect(examples).toContain('data-capability-section="engine-systems"');
    expect(examples).toContain('data-capability-section="production-checks"');
    expect(examples).toContain('data-beginner-tutorial');
    expect(examples).toContain('0 基础新手教程');
    expect(examples).toContain('data-tutorial-step="1"');
    expect(examples).toContain('data-tutorial-step="2"');
    expect(examples).toContain('data-tutorial-step="3"');
    expect(examples).toContain('data-tutorial-step="4"');
    expect(examples).toContain('data-tutorial-progress');
    expect(examples).toContain('data-tutorial-code');
    expect(examples).toContain('data-tutorial-action="play"');
    expect(examples).toContain('data-tutorial-action="copy"');
    expect(examples).toContain('data-tutorial-preview');
    expect(examples).toContain('createScene');
    expect(examples).toContain('new OmniCore.Game');
    expect(examples).toContain('resolvePreviewBackend');
    expect(examples).toContain('已安全降级');
    expect(examples).toContain('requestAnimationFrame(animateHubMotion)');
    expect(examples).toContain('prefers-reduced-motion');
  });

  it('turns the benchmark page into a visual performance showroom without breaking CI output', () => {
    const html = readFileSync('tests/benchmark/benchmark.html', 'utf8');
    const js = readFileSync('tests/benchmark/benchmark.js', 'utf8');

    expect(html).toContain('data-benchmark-showroom');
    expect(html).toContain('data-fps-indicator');
    expect(html).toContain('144 FPS');
    expect(html).toContain('1000 Sprite');
    expect(html).toContain('1 Draw Call');
    expect(js).toContain('spriteCloud');
    expect(js).toContain('updateShowroomIndicators');
    expect(js).toContain('window.__OMNICORE_BENCHMARK_RESULT__');
    expect(js).toContain('showroom');
  });

  it('publishes the roadmap as a visible community feedback board', () => {
    const roadmapMarkdown = readFileSync('website/roadmap.md', 'utf8');
    const roadmapHtml = readFileSync('website/roadmap.html', 'utf8');
    const homepage = readFileSync('website/index.html', 'utf8');

    expect(roadmapMarkdown).toContain('已完成');
    expect(roadmapMarkdown).toContain('开发中');
    expect(roadmapMarkdown).toContain('规划中');
    expect(roadmapMarkdown).toContain('社区反馈');
    expect(roadmapHtml).toContain('data-roadmap-board');
    expect(roadmapHtml).toContain('data-roadmap-lane="done"');
    expect(roadmapHtml).toContain('data-roadmap-lane="doing"');
    expect(roadmapHtml).toContain('data-roadmap-lane="planned"');
    expect(roadmapHtml).toContain('GitHub Issues');
    expect(homepage).toContain('/website/roadmap.html');
  });

  it('provides a zero-config browser IDE that runs a real OmniCore green square', () => {
    const playground = readFileSync('website/playground/index.html', 'utf8');

    expect(playground).toContain('data-cloud-ide');
    expect(playground).toContain('data-file-tree');
    expect(playground).toContain('green-square.js');
    expect(playground).toContain('新建 .js 文件');
    expect(playground).toContain('new OmniCore.Game');
    expect(playground).toContain('new OmniCore.Scene');
    expect(playground).toContain('new OmniCore.Sprite');
    expect(playground).toContain('#16a34a');
    expect(playground).toContain('零门槛，点开即写');
  });

  it('publishes migration value, privacy, and sunset assurances for commercial teams', () => {
    const migration = readFileSync('docs/migration/why-omnicore.md', 'utf8');
    const privacy = readFileSync('PRIVACY.md', 'utf8');
    const sunset = readFileSync('docs/maintenance/sunset-policy.md', 'utf8');

    expect(migration).toContain('Phaser 300KB');
    expect(migration).toContain('OmniCore 33KB');
    expect(migration).toContain('WebGPU 144FPS');
    expect(migration).toContain('WebGL 白屏');
    expect(migration).toContain('OmniCore 无感降级');
    expect(migration).toContain('为什么值得迁移');
    expect(privacy).toContain('默认不收集任何数据');
    expect(privacy).toContain('telemetry: true');
    expect(privacy).toContain('版本号');
    expect(privacy).toContain('报错类型');
    expect(privacy).toContain('如何关闭');
    expect(sunset).toContain('如果在 LTS.md 承诺的长期支持期限结束后，引擎停止维护');
    expect(sunset).toContain('开放所有未发布的迁移工具脚本');
    expect(sunset).toContain('最后一版完全可用的离线包下载');
    expect(sunset).toContain('永久持有引擎');
  });
});
