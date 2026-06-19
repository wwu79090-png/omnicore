import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('website plugin marketplace page', () => {
  it('shows installable official plugin cards, screenshots, and a submit link', () => {
    const page = readFileSync('website/plugins/index.html', 'utf8');
    const requiredPlugins = [
      ['A* Pathfinding', 'npm install @omnicore/plugin-ai-pathfinding'],
      ['Cloud Save', 'npm install @omnicore/plugin-save-cloud'],
      ['3D Particles', 'npm install @omnicore/plugin-three-d-particles'],
      ['Localization', 'npm install @omnicore/plugin-localization'],
      ['Camera Shake', 'npm install @omnicore/plugin-camera-shake'],
      ['WeChat Mini Game Monetization', 'npm install @omnicore/plugin-wechat-monetization']
    ];

    for (const [name, install] of requiredPlugins) {
      expect(page).toContain(name);
      expect(page).toContain(install);
    }
    expect(page).toContain('Submit Plugin');
    expect(page).toContain('免费/商用 2D 素材库');
    expect(page).toContain('CC0-1.0');
    expect(page).toContain('starter-pixel-cc0.omni-asset');
    expect(page).toContain('.github/ISSUE_TEMPLATE/plugin_submission.yml');
    expect(page.match(/class="plugin-card"/g)?.length).toBeGreaterThanOrEqual(6);
    expect(page.match(/<img /g)?.length).toBeGreaterThanOrEqual(5);
    expect(existsSync('.github/ISSUE_TEMPLATE/plugin_submission.yml')).toBe(true);
  });
});
