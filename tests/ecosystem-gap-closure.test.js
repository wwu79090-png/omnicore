import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OmniCore ecosystem gap closure surfaces', () => {
  it('documents the official plugin publishing and monetization path', () => {
    const guide = readFileSync('docs/plugin-publishing-guide.md', 'utf8');
    const plugins = readFileSync('website/plugins/index.html', 'utf8');

    expect(guide).toContain('OmniCore 标准插件');
    expect(guide).toContain('name');
    expect(guide).toContain('version');
    expect(guide).toContain('install(context)');
    expect(guide).toContain('npm pack');
    expect(guide).toContain('build:addon');
    expect(guide).toContain('GitHub Issue');
    expect(guide).toContain('Web 表单');
    expect(guide).toContain('80/20');
    expect(guide).toContain('70/30');

    expect(plugins).toContain('data-plugin-publishing-examples');
    expect(plugins.match(/data-listed-plugin=/g)).toHaveLength(3);
    expect(plugins.match(/npm install @omnicore\/plugin-/g).length).toBeGreaterThanOrEqual(3);
    expect(plugins.match(/<img /g).length).toBeGreaterThanOrEqual(3);
  });

  it('ships payment and ad addon reference plugins under src/addons/examples', () => {
    const payment = readFileSync('src/addons/examples/plugin-payment/index.js', 'utf8');
    const paymentReadme = readFileSync('src/addons/examples/plugin-payment/README.md', 'utf8');
    const ad = readFileSync('src/addons/examples/plugin-ad/index.js', 'utf8');
    const adReadme = readFileSync('src/addons/examples/plugin-ad/README.md', 'utf8');

    expect(payment).toContain('requestPayment');
    expect(payment).toContain('registerProvider');
    expect(payment).toContain('orderId');
    expect(paymentReadme).toContain('完整支付流程');
    expect(ad).toContain('showRewardedVideoAd');
    expect(ad).toContain('createBannerAd');
    expect(ad).toContain('placementId');
    expect(adReadme).toContain('激励视频');
  });

  it('turns case studies into a commercial presentation template with Code Awakener reserved', () => {
    const cases = readFileSync('website/case-studies.html', 'utf8');

    expect(cases).toContain('data-case-template');
    expect(cases).toContain('开发者/团队');
    expect(cases).toContain('引擎版本');
    expect(cases).toContain('Web / 微信 / Electron');
    expect(cases).toContain('data-case-study="code-awakener"');
    expect(cases).toContain('核心玩法');
    expect(cases).toMatch(/Play Now|Download/);
    expect(cases).toContain('提交你的案例');
    expect(cases.match(/data-code-awakener-screenshot/g)).toHaveLength(3);
  });

  it('defines concrete editor capabilities and provides a runnable editor demo scene', () => {
    const features = readFileSync('docs/editor-features.md', 'utf8');
    const demo = readFileSync('examples/editor-demo/scene.json', 'utf8');
    const readme = readFileSync('examples/editor-demo/README.md', 'utf8');

    expect(features).toContain('场景树');
    expect(features).toContain('折叠');
    expect(features).toContain('重命名');
    expect(features).toContain('删除');
    expect(features).toContain('x');
    expect(features).toContain('scale');
    expect(features).toContain('rotation');
    expect(features).toContain('Gizmo');
    expect(features).toContain('平移（W）');
    expect(features).toContain('旋转（E）');
    expect(features).toContain('缩放（R）');
    expect(features).toContain('Tilemap');
    expect(features).toContain('碰撞层可视化');
    expect(features).toContain('运行/暂停/逐帧播放');
    expect(demo).toContain('editor-demo');
    expect(readme).toContain('直接体验编辑流程');
    expect(existsSync('examples/editor-demo/index.html')).toBe(true);
  });

  it('explains offline/private deployment and visual quickstart assets', () => {
    const readme = readFileSync('README.md', 'utf8');
    const offline = readFileSync('docs/offline-deployment.md', 'utf8');
    const quickstart = readFileSync('docs/quickstart-visual.md', 'utf8');
    const video = readFileSync('website/quickstart-video.html', 'utf8');

    expect(readme).toContain('离线运行');
    expect(readme).toContain('OmniCore-v1.0.0-Offline.zip');
    expect(readme).toContain('start.html');
    expect(readme).toContain('USB');
    expect(offline).toContain('企业内部');
    expect(offline).toContain('教育机构');
    expect(offline).toContain('内网服务器');
    expect(offline).toContain('校验');
    expect(quickstart.match(/!\[[^\]]+\]\(assets\/quickstart-/g)).toHaveLength(4);
    expect(video).toContain('60 秒');
    expect(video).toContain('OBS');
    expect(video).toContain('Screen Studio');
    expect(video).toContain('data-quickstart-video');
  });

  it('adds governance promotion rules and the AI-to-engine story', () => {
    const maintainers = readFileSync('MAINTAINERS.md', 'utf8');
    const readme = readFileSync('README.md', 'utf8');
    const story = readFileSync('website/story.html', 'utf8');

    expect(maintainers).toContain('Triage');
    expect(maintainers).toContain('5 个有效的 Bug 复现或文档 PR');
    expect(maintainers).toContain('Committer');
    expect(maintainers).toContain('10 个 PR');
    expect(maintainers).toContain('Maintainer');
    expect(maintainers).toContain('投票通过');
    expect(readme).toContain('贡献与晋升');
    expect(readme).toContain('开发故事');
    expect(readme).toContain('AI 加速 API 设计');
    expect(readme).toContain('测试编写');
    expect(story).toContain('从学生到引擎开发者');
    expect(story).toContain('AI 建议');
    expect(story).toContain('实际代码');
  });
});
