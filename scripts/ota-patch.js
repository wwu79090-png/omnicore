#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function createPatch({ fromDir, toDir, outFile = 'dist/update.patch' } = {}) {
  const before = snapshotDir(fromDir);
  const after = snapshotDir(toDir);
  const changed = [];
  const added = [];
  const removed = [];

  for (const [file, hash] of Object.entries(after)) {
    if (!before[file]) added.push(file);
    else if (before[file] !== hash) changed.push(file);
  }
  for (const file of Object.keys(before)) {
    if (!after[file]) removed.push(file);
  }
  changed.sort();
  added.sort();
  removed.sort();

  const patch = {
    format: 'OmniCore.OTAPatch',
    version: 1,
    generatedAt: new Date().toISOString(),
    from: path.resolve(fromDir),
    to: path.resolve(toDir),
    changed,
    added,
    removed
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(patch, null, 2)}\n`, 'utf8');
  return {
    ...patch,
    file: outFile
  };
}

function snapshotDir(dir) {
  if (!dir || !fs.existsSync(dir)) return {};
  const result = {};
  for (const file of listFiles(dir)) {
    const relative = path.relative(dir, file).replace(/\\/g, '/');
    result[relative] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  return result;
}

function listFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function parseArgs(argv) {
  const options = {
    fromDir: null,
    toDir: null,
    outFile: 'dist/update.patch'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--from' || arg === '--from-dir') {
      index += 1;
      options.fromDir = argv[index];
    } else if (arg === '--to' || arg === '--to-dir') {
      index += 1;
      options.toDir = argv[index];
    } else if (arg === '--out' || arg === '--output') {
      index += 1;
      options.outFile = argv[index];
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (!options.fromDir || !options.toDir) {
      throw new Error('Usage: node scripts/ota-patch.js --from <oldDir> --to <newDir> [--out dist/update.patch]');
    }
    const patch = createPatch(options);
    console.log(JSON.stringify(patch, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

export default createPatch;
