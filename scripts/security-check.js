#!/usr/bin/env node
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolvePackageCommand, runCommand } from './lib/run-command.js';

const dryRun = process.argv.includes('--dry-run');
const securityDoc = path.join(process.cwd(), 'docs', 'security', 'security.md');
const npmCommand = resolvePackageCommand('npm');
const npxCommand = resolvePackageCommand('npx');

async function packageVersion() {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  return pkg.version || '0.0.0';
}

async function main() {
  const version = await packageVersion();
  const outdated = await runCommand(npxCommand, ['npm-check-updates', '--format', 'group']);
  const auditBefore = await runCommand(npmCommand, ['audit', '--json']);
  const fix = dryRun
    ? { ok: true, stdout: 'dry-run: npm audit fix skipped', stderr: '' }
    : await runCommand(npmCommand, ['audit', 'fix']);
  const auditAfter = await runCommand(npmCommand, ['audit', '--json']);

  const entry = [
    '',
    `## ${new Date().toISOString()} - automated security check`,
    '',
    `- Engine version: ${version}`,
    `- npm-check-updates: ${outdated.ok ? 'completed' : 'completed with warnings'}`,
    `- npm audit before fix: ${auditBefore.ok ? 'no known vulnerabilities' : 'vulnerabilities or audit warnings detected'}`,
    `- npm audit fix: ${fix.ok ? 'completed' : 'failed or no fix available'}${dryRun ? ' (dry-run)' : ''}`,
    `- npm audit after fix: ${auditAfter.ok ? 'no known vulnerabilities' : 'review required'}`,
    '',
    '<details><summary>npm-check-updates output</summary>',
    '',
    '```text',
    (outdated.stdout || outdated.stderr || 'No output').trim(),
    '```',
    '</details>',
    ''
  ].join('\n');

  await appendFile(securityDoc, entry);
  await writeFile(
    path.join(process.cwd(), 'docs', 'security', 'security-check-latest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), outdated, auditBefore, fix, auditAfter }, null, 2)
  );
  console.log(`Security check recorded in ${securityDoc}`);
  if (!dryRun && (!auditAfter.ok || !fix.ok)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { main };
export default main;
