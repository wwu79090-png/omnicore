#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEPRECATED_APIS } from '../src/core/Deprecation.js';

const DEFAULT_IGNORED = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const DEFAULT_EXTENSIONS = new Set(['.js', '.mjs', '.html']);
const DEFAULT_GENERATED_AT = '2026-06-20T00:00:00.000Z';
const README_START = '<!-- OMNICORE_DEPRECATED_API_TABLE:start -->';
const README_END = '<!-- OMNICORE_DEPRECATED_API_TABLE:end -->';

function resolveGeneratedAt() {
  if (process.env.OMNICORE_GENERATED_AT) return process.env.OMNICORE_GENERATED_AT;
  if (process.env.SOURCE_DATE_EPOCH) {
    const epoch = Number(process.env.SOURCE_DATE_EPOCH);
    if (Number.isFinite(epoch)) return new Date(epoch * 1000).toISOString();
  }
  return DEFAULT_GENERATED_AT;
}

export async function auditDeprecatedApis({
  root = process.cwd(),
  srcDir = path.join(root, 'src'),
  scanDirs = [srcDir],
  ignored = DEFAULT_IGNORED,
  extensions = DEFAULT_EXTENSIONS
} = {}) {
  const includeRegistry = path.resolve(root) === path.resolve(process.cwd());
  const definitions = dedupeDefinitions([
    ...(includeRegistry ? DEPRECATED_APIS.map((entry) => ({
      api: entry.api,
      pattern: entry.pattern,
      replacement: entry.replacement,
      removeIn: entry.removeIn,
      since: entry.since,
      source: 'registry'
    })) : []),
    ...(await scanJsDocDeprecatedDefinitions({ root, srcDir, ignored, extensions }))
  ]);
  const files = [];
  for (const dir of scanDirs) files.push(...await walk(dir, { ignored, extensions }));
  const scanRecords = files.map((file) => createScanRecord(root, file));
  const entries = definitions.map((definition) => ({
    ...definition,
    locations: findCallSites({ scanRecords, definition }),
  })).map((entry) => ({
    ...entry,
    callCount: entry.locations.length
  })).filter((entry) => entry.callCount > 0);

  return {
    generatedAt: resolveGeneratedAt(),
    entries
  };
}

export async function scanJsDocDeprecatedDefinitions({
  root = process.cwd(),
  srcDir = path.join(root, 'src'),
  ignored = DEFAULT_IGNORED,
  extensions = DEFAULT_EXTENSIONS
} = {}) {
  const jsExtensions = new Set([...extensions].filter((extension) => ['.js', '.mjs'].includes(extension)));
  const files = await walk(srcDir, { ignored, extensions: jsExtensions });
  const definitions = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    definitions.push(...parseDeprecatedJsDoc(content, path.relative(root, file)));
  }
  return definitions;
}

export function parseDeprecatedJsDoc(content, file = '') {
  const definitions = [];
  const pattern = /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  let match = pattern.exec(content);
  while (match) {
    const [, jsdoc, name] = match;
    if (/@deprecated\b/.test(jsdoc)) {
      const api = extractTag(jsdoc, 'api') || name;
      definitions.push({
        api,
        pattern: extractTag(jsdoc, 'pattern') || defaultPattern(api, name),
        replacement: extractTag(jsdoc, 'replacement') || extractReplacementFromDeprecated(jsdoc) || '未指定',
        removeIn: extractTag(jsdoc, 'removeIn') || extractTag(jsdoc, 'remove-in') || '未指定',
        since: extractTag(jsdoc, 'since') || '未指定',
        source: 'jsdoc',
        definedIn: file
      });
    }
    match = pattern.exec(content);
  }
  return definitions;
}

export async function writeDeprecatedReport({ reportPath, audit }) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, renderDeprecatedReport(audit));
}

export function renderDeprecatedReport({ generatedAt, entries }) {
  const lines = [
    '# Deprecated API Audit',
    '',
    `Generated: ${generatedAt}`,
    '',
    entries.length ? '| API | Calls | Replacement | Remove In | Locations |' : 'No deprecated APIs found.',
    entries.length ? '| --- | ---: | --- | --- | --- |' : ''
  ].filter(Boolean);

  entries.forEach((entry) => {
    const locations = entry.locations.length
      ? entry.locations.map((location) => `${location.file}:${location.line}`).join('<br>')
      : '无调用';
    lines.push(`| \`${entry.api}\` | ${entry.callCount} | \`${entry.replacement}\` | ${entry.removeIn} | ${locations} |`);
  });

  return `${lines.join('\n')}\n`;
}

export async function updateReadmeDeprecatedPlan({
  readmePath = path.join(process.cwd(), 'README.md'),
  entries = []
} = {}) {
  let readme = await readFile(readmePath, 'utf8');
  const section = renderReadmeDeprecatedPlan(entries);
  const startIndex = readme.indexOf(README_START);
  const endIndex = readme.indexOf(README_END);

  if (startIndex >= 0 && endIndex > startIndex) {
    readme = `${readme.slice(0, startIndex)}${section}${readme.slice(endIndex + README_END.length)}`;
  } else {
    readme = `${readme.trimEnd()}\n\n${section}\n`;
  }

  await writeFile(readmePath, readme);
}

export function renderReadmeDeprecatedPlan(entries = []) {
  const lines = [
    README_START,
    '## 废弃API迁移计划表',
    '',
    '| 废弃 API | 调用次数 | 替代方案 | 预计移除版本 | 迁移状态 |',
    '| --- | ---: | --- | --- | --- |'
  ];

  if (!entries.length) {
    lines.push('| 无 | 0 | 无 | 无 | 当前未发现废弃 API |');
  } else {
    entries.forEach((entry) => {
      const status = entry.callCount > 0 ? '需要迁移' : '可按版本计划移除';
      lines.push(`| \`${entry.api}\` | ${entry.callCount} | \`${entry.replacement}\` | ${entry.removeIn} | ${status} |`);
    });
  }

  lines.push(README_END);
  return lines.join('\n');
}

async function walk(dir, { ignored, extensions }) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath, { ignored, extensions }));
    else if (extensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function createScanRecord(root, file) {
  const content = readFileSync(file, 'utf8');
  return {
    file: path.relative(root, file).replace(/\\/g, '/'),
    isDeprecationRegistry: file.endsWith(path.join('src', 'core', 'Deprecation.js')),
    lines: stripCommentsAndStrings(content).split(/\r?\n/)
  };
}

function findCallSites({ scanRecords, definition }) {
  const locations = [];
  for (const record of scanRecords) {
    if (record.isDeprecationRegistry) continue;
    record.lines.forEach((line, index) => {
      if (!line.includes(definition.pattern)) return;
      if (isDefinitionLine(line, definition.api)) return;
      locations.push({
        file: record.file,
        line: index + 1
      });
    });
  }
  return locations;
}

function dedupeDefinitions(definitions) {
  const byKey = new Map();
  for (const definition of definitions) {
    const key = `${definition.api}\0${definition.pattern}`;
    if (!byKey.has(key)) byKey.set(key, definition);
  }
  return [...byKey.values()];
}

function stripCommentsAndStrings(source) {
  let output = '';
  let state = 'code';
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (state === 'code') {
      if (char === '/' && next === '/') {
        output += '  ';
        index += 1;
        state = 'line-comment';
      } else if (char === '/' && next === '*') {
        output += '  ';
        index += 1;
        state = 'block-comment';
      } else if (char === '"' || char === '\'' || char === '`') {
        output += ' ';
        state = char;
      } else {
        output += char;
      }
    } else if (state === 'line-comment') {
      if (char === '\n') {
        output += '\n';
        state = 'code';
      } else {
        output += ' ';
      }
    } else if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        output += '  ';
        index += 1;
        state = 'code';
      } else {
        output += char === '\n' ? '\n' : ' ';
      }
    } else if (char === '\\') {
      output += ' ';
      if (next) {
        output += next === '\n' ? '\n' : ' ';
        index += 1;
      }
    } else if (char === state) {
      output += ' ';
      state = 'code';
    } else {
      output += char === '\n' ? '\n' : ' ';
    }
  }
  return output;
}

function isDefinitionLine(line, api) {
  const escaped = escapeRegExp(api.replace(/^OmniCore\./, '').split('.').pop());
  return new RegExp(`\\b(function|class|const|let|var)\\s+${escaped}\\b`).test(line);
}

function extractTag(jsdoc, tag) {
  const match = jsdoc.match(new RegExp(`@${escapeRegExp(tag)}\\s+([^\\n\\r*]+)`));
  return match?.[1]?.trim() || '';
}

function extractReplacementFromDeprecated(jsdoc) {
  const match = jsdoc.match(/@deprecated\s+(?:Use|use|请改用)\s+`?([A-Za-z_$][\w$.:]*)`?/);
  return match?.[1] || '';
}

function defaultPattern(api, name) {
  if (api === 'OmniCore.Game') return 'new OmniCore.Game(';
  return `${name}(`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv) {
  const options = {
    reportPath: path.join(process.cwd(), 'docs', 'release-notes', 'deprecated-audit-latest.md'),
    readmePath: path.join(process.cwd(), 'README.md'),
    strict: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--report') {
      index += 1;
      options.reportPath = path.resolve(argv[index]);
    } else if (arg === '--readme') {
      index += 1;
      options.readmePath = path.resolve(argv[index]);
    } else if (arg === '--strict') options.strict = true;
  }
  return options;
}

function mtimeMs(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function outputsAreFresh(outputs, inputs) {
  const outputTimes = outputs.map(mtimeMs);
  if (outputTimes.some((time) => time <= 0)) return false;
  const newestInput = Math.max(...inputs.map(mtimeMs));
  return Math.min(...outputTimes) >= newestInput;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  let skipped = false;
  if (!options.strict) {
    const srcFiles = await walk(path.join(process.cwd(), 'src'), {
      ignored: DEFAULT_IGNORED,
      extensions: DEFAULT_EXTENSIONS
    });
    const inputs = [
      path.resolve(process.argv[1] || 'scripts/audit-deprecated.js'),
      ...srcFiles
    ];
    if (outputsAreFresh([options.reportPath, options.readmePath], inputs)) {
      console.log(`Deprecated API report is current: ${options.reportPath}`);
      skipped = true;
    }
  }
  if (!skipped) {
    const audit = await auditDeprecatedApis();
    await writeDeprecatedReport({ reportPath: options.reportPath, audit });
    await updateReadmeDeprecatedPlan({ readmePath: options.readmePath, entries: audit.entries });
    const totalCalls = audit.entries.reduce((sum, entry) => sum + entry.callCount, 0);
    console.log(`${totalCalls} deprecated API call(s) found. Report: ${options.reportPath}`);
    if (totalCalls && options.strict) process.exitCode = 1;
  }
}
