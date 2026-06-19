#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

export function migrateSource({ source, file = '', from = '1.x', to = '2.x' } = {}) {
  const changes = [];
  let output = source;
  output = replace(output, 'OmniCore.Backend.use(', 'OmniCore.Backend.switch(', 'Backend.use -> Backend.switch', changes, 'OmniCore.Backend.use');
  output = replace(output, 'game.scene.currentScene', 'game.store.get("currentScene")', 'scene.currentScene -> store currentScene', changes, 'game.scene.currentScene');
  output = replace(output, 'new OmniCore.Game(', 'OmniCore.createGame(', 'OmniCore.Game -> OmniCore.createGame', changes, 'OmniCore.Game');
  output = replace(output, 'OmniCore.Entity.create(', 'OmniCore.createEntity(', 'Entity.create -> createEntity', changes, 'OmniCore.Entity.create');
  output = replace(output, 'Entity.create(', 'Entity.createEntity(', 'Entity.create -> Entity.createEntity', changes, 'Entity.create');
  output = replace(output, 'Store.set(', 'Store.setValue(', 'Store.set -> Store.setValue', changes, 'Store.set');
  output = replace(output, '.store.set(', '.store.setValue(', 'Store#set -> Store#setValue', changes, 'Store#set');
  output = replace(output, 'store.set(', 'store.setValue(', 'Store#set -> Store#setValue', changes, 'Store#set');
  return { file, from, to, output, changes };
}

export function migrateProject({
  root = process.cwd(),
  write = false,
  report = null,
  from = '1.x',
  to = '2.x'
} = {}) {
  const files = walkFiles(path.resolve(root));
  const results = files.map((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const result = migrateSource({ source, file, from, to });
    if (write && result.output !== source) fs.writeFileSync(file, result.output, 'utf8');
    return result;
  }).filter((result) => result.changes.length > 0);
  const summary = summarizeChanges(results);
  if (report) {
    fs.mkdirSync(path.dirname(path.resolve(report)), { recursive: true });
    fs.writeFileSync(report, renderMarkdownReport({ root, from, to, results, summary }), 'utf8');
  }
  return { root, from, to, files: results, summary };
}

function replace(source, needle, replacement, label, changes, api = needle) {
  if (!source.includes(needle)) return source;
  const count = source.split(needle).length - 1;
  changes.push({ api, label, from: needle, to: replacement, count });
  return source.split(needle).join(replacement);
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return DEFAULT_EXTENSIONS.has(path.extname(root)) ? [root] : [];
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    output.push(...walkFiles(path.join(root, entry.name)));
  }
  return output;
}

function summarizeChanges(results) {
  const summary = new Map();
  for (const result of results) {
    for (const change of result.changes) {
      const current = summary.get(change.api) || { api: change.api, count: 0, replacement: change.to };
      current.count += change.count || 1;
      summary.set(change.api, current);
    }
  }
  return [...summary.values()];
}

function renderMarkdownReport({ root, from, to, results, summary }) {
  const rows = summary.length
    ? summary.map((item) => `| \`${item.api}\` | ${item.count} | \`${item.replacement}\` |`).join('\n')
    : '| 无 | 0 | 无 |';
  const files = results.length
    ? results.map((item) => `- ${path.relative(root, item.file) || item.file}: ${item.changes.length} rule(s)`).join('\n')
    : '- No files changed';
  return [
    '# OmniCore Migration Report',
    '',
    `From: ${from}`,
    `To: ${to}`,
    '',
    '| Deprecated API | Count | Replacement |',
    '| --- | ---: | --- |',
    rows,
    '',
    '## Files',
    '',
    files,
    ''
  ].join('\n');
}

function parseArgs(argv) {
  const options = { root: process.cwd(), write: false, report: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      index += 1;
      options.root = argv[index];
    } else if (arg === '--write') {
      options.write = true;
    } else if (arg === '--report') {
      index += 1;
      options.report = argv[index];
    } else if (arg === '--from') {
      index += 1;
      options.from = argv[index];
    } else if (arg === '--to') {
      index += 1;
      options.to = argv[index];
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const result = migrateProject(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    files: result.files.length,
    changes: result.summary.reduce((total, item) => total + item.count, 0),
    summary: result.summary
  }, null, 2));
}

export default migrateSource;
