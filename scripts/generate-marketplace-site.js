#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PLUGINS = [
  {
    name: 'omni-particles',
    displayName: 'Omni Particles',
    version: '1.0.0',
    developer: 'Particle Studio',
    publisher: 'Particle Studio',
    engineVersion: '>=0.1.0',
    installCommand: 'omni install omni-particles',
    isPaid: true,
    price: '19.00 USD',
    downloads: 4280,
    summary: 'GPU-friendly particles, scene presets, and visual emitters for OmniCore.',
    media: {
      screenshots: ['./omni-particles/screen.png'],
      videos: ['./omni-particles/demo.mp4']
    }
  }
];

export function generateMarketplaceSite({
  outDir = path.join('website', 'marketplace'),
  plugins = DEFAULT_PLUGINS
} = {}) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), renderMarketplaceIndex(plugins), 'utf8');
  for (const plugin of plugins) {
    const slug = slugForPlugin(plugin.name);
    const detailDir = path.join(outDir, slug);
    mkdirSync(detailDir, { recursive: true });
    writeFileSync(path.join(detailDir, 'index.html'), renderPluginDetail(plugin), 'utf8');
  }
  return plugins.map((plugin) => ({
    slug: slugForPlugin(plugin.name),
    detailPage: path.join(outDir, slugForPlugin(plugin.name), 'index.html').replace(/\\/g, '/'),
    installCommand: plugin.installCommand
  }));
}

export function scanMarketplaceSubmission(text = '') {
  const findings = [];
  if (/\beval\s*\(/iu.test(text)) findings.push('malicious dynamic eval');
  if (/\b(curl|wget|iwr|Invoke-WebRequest)\b.*\|\s*(bash|sh|powershell|pwsh|node)/isu.test(text)) {
    findings.push('malicious network shell execution');
  }
  if (/\bchild_process\b/iu.test(text)) findings.push('malicious child_process usage');
  return {
    ok: findings.length === 0,
    findings
  };
}

function renderMarketplaceIndex(plugins) {
  const pluginCards = plugins.map((plugin) => {
    const slug = slugForPlugin(plugin.name);
    return `
      <article class="plugin-card" data-plugin="${slug}">
        <h2>${escapeHtml(plugin.displayName)}</h2>
        <p>${escapeHtml(plugin.summary)}</p>
        <code>${escapeHtml(plugin.installCommand)}</code>
        <dl>
          <dt>发布者</dt><dd>${escapeHtml(plugin.publisher || plugin.developer)}</dd>
          <dt>版本号</dt><dd>${escapeHtml(plugin.version)}</dd>
          <dt>支持引擎版本</dt><dd>${escapeHtml(plugin.engineVersion || '>=0.1.0')}</dd>
          <dt>付费字段</dt><dd>isPaid: ${plugin.isPaid ? 'true' : 'false'}</dd>
          <dt>审核 SLA</dt><dd>提交 Issue 后 5 分钟内生成详情页</dd>
          <dt>下载统计</dt><dd>${plugin.downloads}</dd>
          <dt>自动更新</dt><dd>Marketplace backend compares installed versions and emits omni install update commands.</dd>
        </dl>
        <figure>
          <img alt="截图预览" src="${escapeHtml(plugin.media?.screenshots?.[0] || '')}">
          <figcaption>截图预览</figcaption>
        </figure>
        <figure>
          <video controls src="${escapeHtml(plugin.media?.videos?.[0] || '')}"></video>
          <figcaption>视频预览</figcaption>
        </figure>
        <a href="./${slug}/">查看详情</a>
      </article>`;
  }).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OmniCore Marketplace</title>
</head>
<body>
  <main>
    <h1>OmniCore 开发者变现平台</h1>
    <p>插件市场对接 plugin.json、Git/NPM 安装、自动化恶意代码审核和付费解密交付。</p>
    <label>
      搜索插件
      <input data-marketplace-search type="search" placeholder="搜索粒子、AI、UI、平台适配插件">
    </label>
    <section>${pluginCards}</section>
  </main>
</body>
</html>
`;
}

function renderPluginDetail(plugin) {
  const slug = slugForPlugin(plugin.name);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(plugin.displayName)} - OmniCore Marketplace</title>
</head>
<body>
  <main data-plugin-detail="${slug}">
    <h1>${escapeHtml(plugin.displayName)}</h1>
    <p>${escapeHtml(plugin.summary)}</p>
    <pre><code>${escapeHtml(plugin.installCommand)}</code></pre>
    <dl>
      <dt>版本</dt><dd>${escapeHtml(plugin.version)}</dd>
      <dt>发布者</dt><dd>${escapeHtml(plugin.publisher || plugin.developer)}</dd>
      <dt>支持引擎版本</dt><dd>${escapeHtml(plugin.engineVersion || '>=0.1.0')}</dd>
      <dt>付费</dt><dd>isPaid: ${plugin.isPaid ? 'true' : 'false'} / ${escapeHtml(plugin.price)}</dd>
      <dt>下载统计</dt><dd>${plugin.downloads}</dd>
      <dt>自动更新</dt><dd>安装记录低于 ${escapeHtml(plugin.version)} 时提示重新执行 ${escapeHtml(plugin.installCommand)}</dd>
    </dl>
    <section aria-label="媒体预览">
      <h2>截图预览</h2>
      <img alt="截图预览" src="${escapeHtml(plugin.media?.screenshots?.[0] || '')}">
      <h2>视频预览</h2>
      <video controls src="${escapeHtml(plugin.media?.videos?.[0] || '')}"></video>
    </section>
    <section aria-label="评论区">
      <h2>评论区</h2>
      <p>审核通过的开发者问答、评分和版本反馈会显示在这里。</p>
    </section>
  </main>
</body>
</html>
`;
}

function slugForPlugin(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/^@omnicore\//u, '')
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function run() {
  const args = process.argv.slice(2);
  if (args.includes('--malicious-scan')) {
    const issueBody = process.env.GITHUB_EVENT_PATH && existsSync(process.env.GITHUB_EVENT_PATH)
      ? readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')
      : '';
    const report = scanMarketplaceSubmission(issueBody);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ok) process.exitCode = 1;
    return;
  }
  const generated = generateMarketplaceSite();
  process.stdout.write(`${JSON.stringify({ ok: true, generated }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();
