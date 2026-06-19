import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExportPaywall } from '../src/commercial/ExportPaywall.js';

describe('commercial export paywall and online editor assets', () => {
  it('blocks one-click platform export without a commercial license token', () => {
    const paywall = new ExportPaywall({ license: '' });

    expect(paywall.canExport('wechat')).toBe(false);
    expect(() => paywall.assertExport('wechat')).toThrow(/商业版/);
  });

  it('exports platform scaffold files when the license token is present', () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'omnicore-export-'));

    try {
      execFileSync('node', [
        'scripts/export-platform.js',
        '--target',
        'html5',
        '--out',
        outDir,
        '--license',
        'OMNI-PRO-TEST'
      ], { cwd: process.cwd(), stdio: 'pipe' });

      expect(existsSync(path.join(outDir, 'index.html'))).toBe(true);
      expect(existsSync(path.join(outDir, 'export-manifest.json'))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('ships a browser-only scene editor page for editor.omnicore.dev', () => {
    const file = path.resolve('website/editor/index.html');
    const html = readFileSync(file, 'utf8');

    expect(html).toContain('editor.omnicore.dev');
    expect(html).toContain('downloadScene');
    expect(html).toContain('拖拽方块');
  });
});
