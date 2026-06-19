import { describe, expect, it, vi } from 'vitest';
import { createCommandRunner, resolvePackageCommand } from '../scripts/lib/run-command.js';

describe('script command helpers', () => {
  it('runs npm package commands through cmd.exe on Windows without shell=true', async () => {
    const execFileImpl = vi.fn((cmd, args, options, callback) => {
      callback(null, 'ok', '');
    });
    const runCommand = createCommandRunner({ platform: 'win32', cwd: 'C:/repo', execFileImpl });

    const result = await runCommand(resolvePackageCommand('npm', 'win32'), ['audit', '--json']);

    expect(result.ok).toBe(true);
    expect(execFileImpl).toHaveBeenCalledWith(
      'cmd.exe',
      ['/d', '/s', '/c', 'npm.cmd audit --json'],
      expect.not.objectContaining({ shell: true }),
      expect.any(Function)
    );
  });

  it('captures non-zero command output without throwing', async () => {
    const execFileImpl = vi.fn((cmd, args, options, callback) => {
      const error = new Error('failed');
      error.code = 1;
      error.stdout = '{"error":true}';
      error.stderr = 'audit failed';
      callback(error, error.stdout, error.stderr);
    });
    const runCommand = createCommandRunner({ platform: 'linux', cwd: '/repo', execFileImpl });

    await expect(runCommand('npm', ['audit'])).resolves.toEqual({
      ok: false,
      stdout: '{"error":true}',
      stderr: 'audit failed',
      code: 1
    });
  });
});
