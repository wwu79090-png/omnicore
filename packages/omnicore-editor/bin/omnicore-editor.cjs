#!/usr/bin/env node
const path = require('node:path');
const { spawn } = require('node:child_process');

const editorRoot = path.resolve(__dirname, '..');
const electron = process.env.ELECTRON_BINARY || require('electron');
const child = spawn(electron, [editorRoot, ...process.argv.slice(2)], {
  cwd: editorRoot,
  stdio: 'inherit',
  windowsHide: false
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code || 0);
});
