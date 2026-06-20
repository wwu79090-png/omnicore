import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path) {
  return readFileSync(path, 'utf8');
}

describe('product homepage and promotion materials', () => {
  it('keeps README focused on demo, online trial, AI-assisted story, and quickstart', () => {
    const readme = read('README.md');

    expect(readme).toContain('./assets/branding/perf-demo.gif');
    expect(readme).toContain('https://omnicore.vercel.app/');
    expect(readme).toContain('https://omnicore.vercel.app/website/playground/');
    expect(readme).toContain('## AI 加速开发');
    expect(readme).toContain('三行画出第一个角色');
    expect(existsSync('assets/branding/perf-demo.gif')).toBe(true);
  });

  it('ships copy-ready Chinese and English community launch posts', () => {
    const zh = read('PROMOTION_ZH.md');
    const en = read('PROMOTION_EN.md');

    expect(zh).toContain('大学生独自肝了 4 个月');
    expect(zh).toContain('AI 辅助');
    expect(zh).toContain('https://github.com/wwu79090-png/omnicore');
    expect(en).toContain('Hacker News');
    expect(en).toContain('Reddit r/gamedev');
    expect(en).toContain('student');
  });

  it('keeps a recordable 30 second video package and 10 minute tutorial', () => {
    const video = read('docs/promotion/video-30s-script.md');
    const recorder = read('website/promo/30s-demo.html');
    const tutorial = read('docs/ten-minute-quickstart.md');

    expect(video).toContain('0-3s');
    expect(video).toContain('27-30s');
    expect(recorder).toContain('renderOmniCorePromoVideo');
    expect(recorder).toContain('assets/branding/perf-demo.gif');
    expect(existsSync('assets/branding/omnicore-30s-demo.webm')).toBe(true);
    expect(statSync('assets/branding/omnicore-30s-demo.webm').size).toBeGreaterThan(500_000);
    expect(tutorial).toContain('const game = await new OmniCore.Game');
    expect(tutorial).toContain('game.scene.register(scene); await game.scene.push');
  });
});
