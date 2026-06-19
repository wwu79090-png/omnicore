#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const args = new Set(process.argv.slice(2));
const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const model = process.env.OLLAMA_MODEL || 'codellama';

async function changedJsFiles() {
  const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--cached']);
  const staged = stdout
    .split(/\r?\n/)
    .filter((file) => file && /\.(m?js)$/.test(file) && !file.startsWith('node_modules/'));
  if (staged.length) return staged;
  const fallback = await execFileAsync('git', ['diff', '--name-only']);
  return fallback.stdout
    .split(/\r?\n/)
    .filter((file) => file && /\.(m?js)$/.test(file) && !file.startsWith('node_modules/'));
}

async function reviewFile(file) {
  const source = await readFile(file, 'utf8');
  const prompt = [
    'Review this OmniCore JavaScript change for defects, lifecycle leaks, migration risks, and security issues.',
    'Return concise findings with severity and file-specific suggestions.',
    `File: ${file}`,
    source.slice(0, 12000)
  ].join('\n\n');

  if (args.has('--dry-run')) {
    return `DRY RUN: would review ${file} with ${model} at ${ollamaUrl}`;
  }

  const response = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  if (!response.ok) throw new Error(`Ollama request failed: HTTP ${response.status}`);
  const body = await response.json();
  return body.response || JSON.stringify(body);
}

async function main() {
  const files = await changedJsFiles();
  if (!files.length) {
    console.log('No changed JavaScript files to review.');
    return;
  }

  for (const file of files) {
    console.log(`\n## ${file}`);
    console.log(await reviewFile(file));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
