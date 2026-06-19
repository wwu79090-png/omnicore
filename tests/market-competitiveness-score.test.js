import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('OmniCore market competitiveness proof', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('scores real-market proof dimensions at 90 or above', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-market-score-'));
    const out = path.join(temp, 'quality-report.json');

    execFileSync(process.execPath, ['scripts/generate-quality-report.js', '--out', out], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const report = JSON.parse(readFileSync(out, 'utf8'));

    expect(report.marketCompetitiveness).toMatchObject({
      target: 90,
      allAboveTarget: true,
      excluded: expect.arrayContaining(['full-3d'])
    });
    expect(report.marketCompetitiveness.overallScore).toBeGreaterThanOrEqual(90);
    expect(report.marketCompetitiveness.dimensions).toMatchObject({
      adoptionProof: expect.objectContaining({ score: expect.any(Number), missing: [] }),
      editorMaturity: expect.objectContaining({ score: expect.any(Number), missing: [] }),
      ecosystemReach: expect.objectContaining({ score: expect.any(Number), missing: [] }),
      platformProof: expect.objectContaining({ score: expect.any(Number), missing: [] }),
      productionTrust: expect.objectContaining({ score: expect.any(Number), missing: [] })
    });
    for (const dimension of Object.values(report.marketCompetitiveness.dimensions)) {
      expect(dimension.score).toBeGreaterThanOrEqual(90);
    }
  });

  it('ships three case-study cards with publish evidence and concrete engine usage', () => {
    const html = readFileSync('website/case-studies.html', 'utf8');
    const markdown = readFileSync('website/case-studies.md', 'utf8');

    expect(html.match(/data-case-study="/g)).toHaveLength(3);
    expect(html).toContain('data-publish-evidence="wechat"');
    expect(html).toContain('data-publish-evidence="web"');
    expect(html).toContain('data-publish-evidence="desktop"');
    expect(html).toContain('可运行模板');
    expect(html).toContain('性能门禁');
    expect(markdown.match(/^## /gm)).toHaveLength(3);
    expect(markdown).toContain('发布证据');
    expect(markdown).toContain('质量门禁');
  });
});
