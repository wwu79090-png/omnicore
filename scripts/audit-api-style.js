#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');
const SCRIPT_PATH = path.resolve(process.argv[1] || 'scripts/audit-api-style.js');
const REPORT_PATH = path.join(ROOT, 'docs', 'release-notes', 'api-style-polish.md');
const DEFAULT_GENERATED_AT = '2026-06-20T00:00:00.000Z';
const PUBLIC_NAMESPACE_EXPORTS = new Set([
  'Addons',
  'Backend',
  'Bus',
  'Core',
  'DB',
  'Easing',
  'Font',
  'Geom',
  'GlobalHook',
  'GameplayTags',
  'License',
  'Pool',
  'Physics',
  'Plugin',
  'Query',
  'RendererContract',
  'Shape',
  'Task',
  'Transform2D'
]);

function resolveGeneratedAt() {
  if (process.env.OMNICORE_GENERATED_AT) return process.env.OMNICORE_GENERATED_AT;
  if (process.env.SOURCE_DATE_EPOCH) {
    const epoch = Number(process.env.SOURCE_DATE_EPOCH);
    if (Number.isFinite(epoch)) return new Date(epoch * 1000).toISOString();
  }
  return DEFAULT_GENERATED_AT;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (/\.(js|mjs)$/u.test(entry.name)) files.push(file);
  }
  return files;
}

function isPascalCase(name) {
  return /^[A-Z][A-Za-z0-9]*$/u.test(name);
}

function isCamelCase(name) {
  return /^[a-z][A-Za-z0-9]*$/u.test(name);
}

function isUpperSnakeCase(name) {
  return /^[A-Z][A-Z0-9_]*$/u.test(name);
}

function auditSource(relative, source) {
  const findings = [];
  for (const match of source.matchAll(/\bexport\s+class\s+([A-Za-z_$][\w$]*)/gu)) {
    if (!isPascalCase(match[1])) findings.push(`${relative}: exported class "${match[1]}" must be PascalCase`);
  }

  for (const match of source.matchAll(/\bexport\s+const\s+([A-Za-z_$][\w$]*)/gu)) {
    const name = match[1];
    if (!isUpperSnakeCase(name) && !PUBLIC_NAMESPACE_EXPORTS.has(name)) {
      findings.push(`${relative}: exported constant "${name}" must be UPPER_SNAKE_CASE or documented namespace`);
    }
  }

  for (const match of source.matchAll(/^\s{2}(?:async\s+)?(?:static\s+)?([A-Za-z_$][\w$]*)\s*\(/gmu)) {
    const name = match[1];
    if (name !== 'constructor' && !name.startsWith('_') && !isCamelCase(name)) {
      findings.push(`${relative}: public method "${name}" must be camelCase`);
    }
  }

  return findings;
}

async function mtimeMs(file) {
  return (await stat(file).catch(() => null))?.mtimeMs || 0;
}

async function reportIsFresh(reportPath, inputs) {
  const reportTime = await mtimeMs(reportPath);
  if (reportTime <= 0) return false;
  const newestInput = Math.max(...await Promise.all(inputs.map(mtimeMs)));
  return reportTime >= newestInput;
}

async function main() {
  const files = await walk(SRC_ROOT);
  if (await reportIsFresh(REPORT_PATH, [SCRIPT_PATH, ...files])) {
    console.log('API style audit passed');
    return;
  }

  const findings = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    findings.push(...auditSource(path.relative(ROOT, file).replaceAll(path.sep, '/'), source));
  }

  const report = [
    '# API Style Polish Report',
    '',
    `Generated: ${resolveGeneratedAt()}`,
    '',
    '## Naming Rules',
    '',
    '- Classes: PascalCase',
    '- Methods: camelCase',
    '- Constants: UPPER_SNAKE_CASE',
    '- Public namespace objects retained for compatibility: Addons, Backend, Core, DB, Easing, Font, GameplayTags, Geom, GlobalHook, License, Physics, Plugin, Pool, Query, RendererContract, Shape, Task, Transform2D',
    '',
    '## Findings',
    '',
    findings.length ? findings.map((item) => `- ${item}`).join('\n') : 'No naming changes required.'
  ].join('\n');

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${report}\n`);

  if (findings.length) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('API style audit passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
