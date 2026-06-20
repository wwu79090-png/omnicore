import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const GENERATED_FILES = [
  'docs/api.md',
  'docs/api/index.html',
  'docs/api/manifest.json',
  'docs/release-notes/api-style-polish.md',
  'docs/release-notes/deprecated-audit-latest.md',
  'docs/security/dependency-forensics-latest.md',
  'docs/security/dependency-forensics-lock.json'
];

function runScript(script, args = []) {
  execFileSync(process.execPath, [path.resolve(script), ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

function readGeneratedFiles() {
  return Object.fromEntries(GENERATED_FILES.map((file) => [file, readFileSync(file, 'utf8')]));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('reproducible report generation', () => {
  it('keeps generated verification reports stable across repeated runs', async () => {
    runScript('scripts/docs.js');
    runScript('scripts/generate-api-docs.js', ['--out', 'docs/api']);
    runScript('scripts/audit-api-style.js');
    runScript('scripts/audit-deprecated.js');
    runScript('scripts/dependency-forensics.js');
    const first = readGeneratedFiles();

    await delay(5);

    runScript('scripts/docs.js');
    runScript('scripts/generate-api-docs.js', ['--out', 'docs/api']);
    runScript('scripts/audit-api-style.js');
    runScript('scripts/audit-deprecated.js');
    runScript('scripts/dependency-forensics.js');

    expect(readGeneratedFiles()).toEqual(first);
  }, 120000);
});
