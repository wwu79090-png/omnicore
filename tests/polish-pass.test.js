import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, DEFAULT_RENDERER_BACKEND } from '../src/config/defaults.js';
import { OmniError, formatOmniMessage, toOmniError } from '../src/core/OmniError.js';
import { normalizeConfig } from '../src/core/Bootstrap.js';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

function runNodeScript(script, args = []) {
  return execFileSync(process.execPath, [path.resolve(script), ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

function listJsFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return listJsFiles(absolute);
    return entry.isFile() && absolute.endsWith('.js') ? [absolute] : [];
  });
}

describe('OmniCore polish pass quality gates', () => {
  it('exposes docs and audit scripts for style, API docs, and asset conventions', () => {
    expect(packageJson.scripts.docs).toBe('node scripts/docs.js');
    expect(packageJson.scripts['audit:api']).toBe('node scripts/audit-api-style.js');
    expect(packageJson.scripts['audit:asset-conventions']).toBe('node scripts/audit-asset-conventions.js');
  });

  it('centralizes runtime defaults through src/config/defaults.js', () => {
    expect(DEFAULT_GAME_CONFIG).toEqual(expect.objectContaining({
      width: 800,
      height: 600,
      renderer: DEFAULT_RENDERER_BACKEND,
      platform: 'web',
      debug: false,
      autoResize: true,
      autoStart: true,
      autoAttach: true
    }));
    expect(normalizeConfig({ width: 320 })).toEqual(expect.objectContaining({
      width: 320,
      height: DEFAULT_GAME_CONFIG.height,
      renderer: DEFAULT_GAME_CONFIG.renderer
    }));
  });

  it('formats user-facing errors and console messages consistently', () => {
    expect(formatOmniMessage('Renderer', 'WebGL 不可用，已降级至 Canvas 2D。'))
      .toBe('[OmniCore] [Renderer] WebGL 不可用，已降级至 Canvas 2D。');

    const error = toOmniError(new Error('Failed to load resource'), {
      module: 'Loader',
      message: '资源路径不存在：assets/sprites/player.png'
    });

    expect(error).toBeInstanceOf(OmniError);
    expect(error.message).toBe('[OmniCore] [Loader] 资源路径不存在：assets/sprites/player.png');
    expect(error.cause.message).toBe('Failed to load resource');
  });

  it('keeps source exceptions routed through OmniError wrappers', () => {
    const allowedNativeErrorSites = new Set([
      path.normalize('src/core/Logger.js')
    ]);
    const offenders = listJsFiles(path.resolve('src'))
      .filter((file) => !allowedNativeErrorSites.has(path.normalize(path.relative(process.cwd(), file))))
      .filter((file) => /\bthrow\s+new\s+(?:Error|TypeError|RangeError)\b|\bnew\s+Error\s*\(/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('keeps generated API docs free of unknown types', () => {
    runNodeScript('scripts/docs.js');
    const apiDocs = readFileSync('docs/api.md', 'utf8');

    expect(apiDocs).toContain('src/core/Bootstrap.js');
    expect(apiDocs).toContain('src/microkernel/Kernel.js');
    expect(apiDocs).not.toMatch(/\bunknown\b/i);
  });

  it('passes API naming and asset convention audits', () => {
    const apiAudit = runNodeScript('scripts/audit-api-style.js');
    const assetAudit = runNodeScript('scripts/audit-asset-conventions.js');

    expect(apiAudit).toContain('API style audit passed');
    expect(assetAudit).toContain('Asset convention audit passed');
  }, 60000);

  it('uses normalized asset directories and consistent launcher delegation', () => {
    expect(existsSync('assets/sprites/default/default-tilesheet.svg')).toBe(true);
    expect(existsSync('assets/default')).toBe(false);
    expect(existsSync('assets/branding/logo-highres.png')).toBe(true);

    expect(readFileSync('OmniCore_Dev_Launcher.bat', 'utf8')).toContain('node launcher.js --open');
    expect(readFileSync('OmniCore_Dev_Launcher.command', 'utf8')).toContain('node launcher.js --open');
    expect(readFileSync('launcher.js', 'utf8')).toContain('ensureDependencies');
  });
});
