import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseBuildGameDemoArgs,
  runBuildGameDemo
} from '../scripts/build-game-demo.js';
import { resolvePackageCommand } from '../scripts/lib/run-command.js';

describe('build-game-demo local preview script', () => {
  let tmpRoot = null;

  afterEach(() => {
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
    tmpRoot = null;
  });

  it('requires exactly one target project path argument', () => {
    expect(() => parseBuildGameDemoArgs([])).toThrow('必须传入一个目标游戏项目路径');
    expect(() => parseBuildGameDemoArgs(['one', 'two'])).toThrow('仅接收一个目标游戏项目路径参数');
    expect(parseBuildGameDemoArgs(['C:/game'])).toBe(path.resolve('C:/game'));
  });

  it('runs engine build, copies package, builds target dist, and starts preview', async () => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'omnicore-build-demo-'));
    const targetProject = path.join(tmpRoot, 'game');
    const calls = [];
    const run = vi.fn(async (command, args, options = {}) => {
      calls.push({ command, args, cwd: options.cwd });
      return { ok: true, stdout: '', stderr: '' };
    });
    const copyPackage = vi.fn(async (sourceRoot, targetRoot) => {
      calls.push({ command: 'copy', sourceRoot, targetRoot });
    });
    const startServer = vi.fn(async (distDir) => {
      calls.push({ command: 'serve', distDir });
      return { url: 'http://127.0.0.1:4173/' };
    });

    const result = await runBuildGameDemo({
      targetProject,
      engineRoot: tmpRoot,
      run,
      copyPackage,
      startServer,
      openBrowser: false
    });

    const npmCommand = resolvePackageCommand('npm');
    expect(calls.map((call) => call.command)).toEqual([npmCommand, 'copy', npmCommand, 'serve']);
    expect(calls[0]).toMatchObject({ args: ['run', 'build'], cwd: tmpRoot });
    expect(calls[1].targetRoot).toBe(path.join(targetProject, 'node_modules', 'omnicore'));
    expect(calls[2]).toMatchObject({ args: ['run', 'build'], cwd: targetProject });
    expect(calls[3].distDir).toBe(path.join(targetProject, 'dist'));
    expect(result.url).toBe('http://127.0.0.1:4173/');
  });
});
