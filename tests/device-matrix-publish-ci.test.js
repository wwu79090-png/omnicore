import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('real-device matrix benchmark, publish guidance, and screenshot CI', () => {
  it('declares low-end Playwright simulation with CPU throttling and GPU limitation in npm run benchmark', () => {
    const script = readFileSync('scripts/benchmark.js', 'utf8');

    expect(script).toContain('runLowEndDeviceMatrix');
    expect(script).toContain('Emulation.setCPUThrottlingRate');
    expect(script).toContain('iPhone 12');
    expect(script).toContain('low-end-android');
    expect(script).toContain('performanceExpectations');
  });

  it('prints WeChat mini-game preview steps from publish:local', () => {
    const output = execFileSync(process.execPath, ['scripts/publish-local.js', '--once'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120000
    });

    expect(output).toContain('微信开发者工具');
    expect(output).toContain('生成二维码');
    expect(output).toContain('导入小游戏项目');
    expect(output).toContain('/__omnicore/telemetry');
    expect(output).toContain('远程设备遥测');
  });

  it('ships screenshot comparison automation with a 5 percent CI threshold', () => {
    const workflow = readFileSync('.github/workflows/pr-quality.yml', 'utf8');
    const script = readFileSync('scripts/compare-screenshots.js', 'utf8');
    const e2eSpec = readFileSync('tests/e2e/game-smoke.spec.js', 'utf8');
    const screenshotCompareCommand = workflow
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('- run: node scripts/compare-screenshots.js'));

    expect(workflow).toContain('scripts/compare-screenshots.js');
    expect(screenshotCompareCommand).toContain('--threshold 0.05');
    expect(screenshotCompareCommand).not.toContain('--threshold 0.001');
    expect(script).toContain('diffRatio');
    expect(script).toContain('threshold');
    expect(e2eSpec).toContain("page.on('console'");
    expect(e2eSpec).toContain('errorsAndWarnings');
    expect(e2eSpec).toContain('editor-current-');
    expect(e2eSpec).toContain('.json');
    expect(existsSync('tests/e2e/__screenshots__/editor-baseline.png')).toBe(true);
  });

  it('ships a dedicated 2.5D production certification workflow with bundle preview evidence', () => {
    const workflow = readFileSync('.github/workflows/25d-production.yml', 'utf8');

    expect(workflow).toContain('name: 2.5D Production Certification');
    expect(workflow).toContain('npm run certify:25d -- --bundle examples/25d-editor-deploy-loop.production-bundle.json');
    expect(workflow).toContain('npm run capture:25d -- --bundle examples/25d-editor-deploy-loop.production-bundle.json');
    expect(workflow).toContain('npx playwright install --with-deps chromium');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('docs/release-notes/25d-production-certification.json');
    expect(workflow).toContain('docs/release-notes/25d-preview-screenshot-evidence.json');
    expect(existsSync('examples/25d-editor-deploy-loop.production-bundle.json')).toBe(true);
  });
});
