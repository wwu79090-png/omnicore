import path from 'node:path';

export function createViteDevServerCommand({
  root = process.cwd(),
  host = '127.0.0.1',
  port = 5173
} = {}) {
  return {
    command: process.execPath,
    args: [
      path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--host',
      String(host),
      '--port',
      String(port),
      '--strictPort'
    ]
  };
}

export default createViteDevServerCommand;
