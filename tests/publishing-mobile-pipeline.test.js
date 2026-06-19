import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const roots = [];

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

describe('publishing and mobile pipeline', () => {
  it('generates iOS Swift and Android Kotlin WebView shell projects', async () => {
    const { generateMobileShells } = await import(pathToFileURL(path.resolve('scripts/generate-mobile-shells.js')).href);
    const root = mkdtempSync(path.join(tmpdir(), 'omnicore-mobile-shells-'));
    roots.push(root);

    const result = generateMobileShells({ root, appName: 'OmniDemo', webDist: 'dist' });

    expect(existsSync(result.ios.appSwift)).toBe(true);
    expect(readFileSync(result.ios.appSwift, 'utf8')).toContain('WKWebView');
    expect(readFileSync(result.ios.appSwift, 'utf8')).toContain('dist/index.html');
    expect(existsSync(result.android.mainActivity)).toBe(true);
    expect(readFileSync(result.android.mainActivity, 'utf8')).toContain('WebView');
    expect(readFileSync(result.android.mainActivity, 'utf8')).toContain('file:///android_asset/index.html');
  });

  it('documents Steam and Itch.io publishing steps for Windows and Linux', () => {
    const markdown = readFileSync('docs/publishing/steam-itch.md', 'utf8');
    const html = readFileSync('website/publishing/steam-itch.html', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(markdown).toContain('Steam Windows');
    expect(markdown).toContain('Steam Linux');
    expect(markdown).toContain('Itch.io Windows');
    expect(markdown).toContain('Itch.io Linux');
    expect(html).toContain('Steam/Itch.io 发布教程');
    expect(packageJson.scripts['build:mobile']).toBe('node scripts/generate-mobile-shells.js');
  });
});
