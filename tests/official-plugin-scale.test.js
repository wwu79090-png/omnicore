import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('official plugin ecosystem scale', () => {
  it('ships pathfinding, 3D particles, and cloud save as demoable official plugins', () => {
    const plugins = [
      ['AiPathfinding', 'findPath'],
      ['ThreeDParticles', 'spawnBurst3D'],
      ['SaveCloud', 'save']
    ];

    for (const [plugin, marker] of plugins) {
      const root = path.join('examples', 'plugins', plugin);
      expect(existsSync(path.join(root, 'package.json'))).toBe(true);
      expect(existsSync(path.join(root, 'README.md'))).toBe(true);
      expect(existsSync(path.join(root, 'src', 'index.js'))).toBe(true);
      expect(existsSync(path.join(root, 'demo', 'index.html'))).toBe(true);
      expect(readFileSync(path.join(root, 'src', 'index.js'), 'utf8')).toContain(marker);
      expect(readFileSync(path.join(root, 'README.md'), 'utf8')).toContain('Official OmniCore plugin');
      expect(readFileSync(path.join(root, 'demo', 'index.html'), 'utf8')).toContain('data-omnicore-plugin-demo');
    }

    const marketplace = readFileSync('website/plugins/index.html', 'utf8');
    expect(marketplace).toContain('examples/plugins/AiPathfinding/demo/index.html');
    expect(marketplace).toContain('examples/plugins/ThreeDParticles/demo/index.html');
    expect(marketplace).toContain('examples/plugins/SaveCloud/demo/index.html');
    expect(marketplace).toContain('官方插件数量: 15');
  });
});
