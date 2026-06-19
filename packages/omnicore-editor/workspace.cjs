const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const WORKSPACE_DIRS = ['assets', 'src', 'scenes'];
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const SCRIPT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-desktop']);

function scanWorkspaceDirectory(rootPath) {
  const root = path.resolve(rootPath || process.cwd());
  const name = path.basename(root);
  const directories = WORKSPACE_DIRS
    .map((directoryName) => {
      const absolutePath = path.join(root, directoryName);
      return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()
        ? { name: directoryName, path: directoryName }
        : null;
    })
    .filter(Boolean);
  const files = directories.flatMap((directory) => walkDirectory(path.join(root, directory.name), root));
  return {
    root,
    name,
    directories,
    assets: files.filter((entry) => entry.path.startsWith('assets/')),
    sourceFiles: files.filter((entry) => entry.path.startsWith('src/')),
    scenes: files.filter((entry) => entry.path.startsWith('scenes/')),
    scannedAt: new Date().toISOString()
  };
}

function writeDockLayout({ root, layout } = {}) {
  const target = workspaceFile(root, 'layout.json');
  writeJson(target, {
    version: 1,
    savedAt: new Date().toISOString(),
    layout
  });
  return { ok: true, path: target };
}

function readDockLayout({ root } = {}) {
  const target = workspaceFile(root, 'layout.json');
  const data = readJson(target);
  return data ? { ok: true, path: target, layout: data.layout || data } : { ok: false, path: target, layout: null };
}

function writeAutoSave({ root, snapshot } = {}) {
  const target = workspaceFile(root, path.join('autosave', 'latest.json'));
  writeJson(target, {
    version: 1,
    savedAt: new Date().toISOString(),
    snapshot
  });
  markSession(root, false);
  return { ok: true, path: target };
}

function readPendingRecovery({ root } = {}) {
  const target = workspaceFile(root, path.join('autosave', 'latest.json'));
  const session = readJson(workspaceFile(root, 'session.json')) || {};
  const data = readJson(target);
  if (!data || session.normalExit === true) return { exists: false, path: target, snapshot: null };
  return {
    exists: true,
    path: target,
    savedAt: data.savedAt || null,
    snapshot: data.snapshot || data
  };
}

function clearAutoSave({ root } = {}) {
  const target = workspaceFile(root, path.join('autosave', 'latest.json'));
  if (fs.existsSync(target)) fs.rmSync(target, { force: true });
  markSession(root, true);
  return { ok: true, path: target };
}

function markSession(root, normalExit) {
  const target = workspaceFile(root, 'session.json');
  writeJson(target, {
    normalExit: Boolean(normalExit),
    updatedAt: new Date().toISOString()
  });
  return { ok: true, path: target };
}

function workspaceFile(root, relativePath) {
  const base = root ? path.resolve(root, '.omnicore-editor') : path.join(process.cwd(), '.omnicore-editor');
  const target = path.resolve(base, relativePath);
  if (!isInside(base, target)) throw new Error('Editor metadata path escapes workspace root.');
  return target;
}

function walkDirectory(directory, root) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    const relativePath = slash(path.relative(root, absolutePath));
    if (entry.isDirectory()) {
      output.push(...walkDirectory(absolutePath, root));
      continue;
    }
    if (!entry.isFile()) continue;
    output.push(describeWorkspaceFile(relativePath, absolutePath));
  }
  return output.sort((left, right) => left.path.localeCompare(right.path));
}

function describeWorkspaceFile(relativePath, absolutePath) {
  const extension = path.extname(relativePath).toLowerCase();
  const entry = {
    path: relativePath,
    name: path.basename(relativePath),
    type: inferType(relativePath, extension),
    size: fs.statSync(absolutePath).size
  };
  if (entry.type === 'prefab' || entry.type === 'scene') {
    const data = readJson(absolutePath);
    if (data) entry.data = data;
  }
  return entry;
}

function inferType(relativePath, extension) {
  if (relativePath.startsWith('assets/prefabs/') && extension === '.json') return 'prefab';
  if (relativePath.startsWith('scenes/') && extension === '.json') return 'scene';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (SCRIPT_EXTENSIONS.has(extension)) return 'script';
  if (extension === '.json') return 'json';
  return 'file';
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function workspaceHash(root) {
  return crypto.createHash('sha1').update(path.resolve(root || process.cwd())).digest('hex').slice(0, 12);
}

module.exports = {
  scanWorkspaceDirectory,
  writeDockLayout,
  readDockLayout,
  writeAutoSave,
  readPendingRecovery,
  clearAutoSave,
  markSession,
  workspaceHash
};
