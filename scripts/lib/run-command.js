import { execFile } from 'node:child_process';

const DEFAULT_MAX_BUFFER = 1024 * 1024 * 8;

function toText(value) {
  if (value == null) return '';
  return Buffer.isBuffer(value) ? value.toString() : String(value);
}

export function resolvePackageCommand(command, platform = process.platform) {
  return platform === 'win32' ? `${command}.cmd` : command;
}

export function createCommandRunner({
  platform = process.platform,
  cwd = process.cwd(),
  execFileImpl = execFile,
  maxBuffer = DEFAULT_MAX_BUFFER
} = {}) {
  return async function run(cmd, args = [], options = {}) {
    return new Promise((resolve) => {
      const commandSpec = platform === 'win32'
        ? {
          cmd: 'cmd.exe',
          args: ['/d', '/s', '/c', [cmd, ...args].map(quoteCmdArg).join(' ')]
        }
        : { cmd, args };
      const execOptions = {
        cwd,
        maxBuffer,
        ...options
      };

      const complete = (error, stdout = '', stderr = '') => {
        const out = toText(stdout || error?.stdout);
        const err = toText(stderr || error?.stderr || error?.message);

        if (error) {
          resolve({
            ok: false,
            stdout: out,
            stderr: err,
            code: error.code ?? error.exitCode ?? error.status ?? 1
          });
          return;
        }

        resolve({ ok: true, stdout: out, stderr: err });
      };

      try {
        execFileImpl(commandSpec.cmd, commandSpec.args, execOptions, complete);
      } catch (error) {
        complete(error);
      }
    });
  };
}

export const runCommand = createCommandRunner();

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[\s"&|<>^]/u.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}
