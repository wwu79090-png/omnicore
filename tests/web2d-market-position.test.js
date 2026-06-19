import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Web 2D market positioning evidence', () => {
  it('publishes a Web 2D candidate page with concrete engine evidence', () => {
    const markdown = readFileSync('docs/market-positioning/web-2d-engine-candidate.md', 'utf8');
    const html = readFileSync('website/market-positioning/index.html', 'utf8');

    for (const text of [
      'Web 2D',
      'Phaser',
      'Pixi',
      '低代码',
      '微信小游戏',
      'benchmark:ci',
      'quality:gate',
      '插件安全',
      'marketPositioningScorecard'
    ]) {
      expect(markdown).toContain(text);
    }

    expect(html).toContain('data-market-positioning="web-2d"');
    expect(html).toContain('data-score-target="90"');
    expect(html).toContain('Web 2D 引擎候选');
    expect(html).toContain('Phaser 迁移');
    expect(html).toContain('Pixi 上层框架');
    expect(html).toContain('低代码编辑器');
  });
});
