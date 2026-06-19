#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const args = parseArgs(process.argv.slice(2));
const outRoot = path.resolve(args.out || path.join(root, 'dist-desktop'));
const targetPlatform = args.platform || process.platform;
const dryRun = Boolean(args['dry-run']);
const packageConfig = readPackageConfig();
const packageFiles = packageConfig.build?.files || ['dist', 'electron.main.cjs', 'preload.cjs', 'package.json'];
const electronDist = dryRun ? null : path.dirname(require('electron'));

function copyAppFiles(out) {
  fs.mkdirSync(path.join(out, 'resources', 'app'), { recursive: true });
  for (const file of packageFiles) {
    const source = path.join(root, file);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(out, 'resources', 'app', file), { recursive: true });
  }
}

function manifestFor(platform, artifactPath = null) {
  const artifactName = platform === 'darwin'
    ? 'OmniCore Editor.dmg'
    : platform === 'win32'
      ? 'omnicore-editor-win32-x64'
      : 'OmniCore Editor.AppImage';
  const executable = platform === 'darwin'
    ? 'OmniCore Editor.app'
    : platform === 'win32'
      ? 'omnicore-editor.exe'
      : 'OmniCore Editor.AppImage';
  return {
    productName: packageConfig.build?.productName || 'OmniCore Editor',
    appId: packageConfig.build?.appId || 'dev.omnicore.editor',
    platform,
    artifactName,
    executable,
    artifactPath: artifactPath || path.join(outRoot, artifactName),
    files: packageFiles,
    dryRun,
    generatedAt: new Date().toISOString()
  };
}

function writeManifest(manifest) {
  fs.mkdirSync(outRoot, { recursive: true });
  const manifestPath = path.join(outRoot, 'desktop-package-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

function packageWindows() {
  const out = path.join(outRoot, 'omnicore-editor-win32-x64');
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(electronDist, out, { recursive: true });
  const sourceExe = path.join(out, 'electron.exe');
  const targetExe = path.join(out, 'omnicore-editor.exe');
  if (fs.existsSync(sourceExe)) fs.renameSync(sourceExe, targetExe);
  copyAppFiles(out);
  return targetExe;
}

function packageMac() {
  const sourceApp = path.join(electronDist, 'Electron.app');
  const targetApp = path.join(outRoot, 'OmniCore Editor.app');
  fs.rmSync(targetApp, { recursive: true, force: true });
  fs.cpSync(sourceApp, targetApp, { recursive: true });
  copyAppFiles(path.join(targetApp, 'Contents'));
  return targetApp;
}

function packageLinux() {
  const out = path.join(outRoot, 'omnicore-editor-linux-x64');
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(electronDist, out, { recursive: true });
  const sourceBin = path.join(out, 'electron');
  const targetBin = path.join(out, 'omnicore-editor');
  if (fs.existsSync(sourceBin)) fs.renameSync(sourceBin, targetBin);
  copyAppFiles(out);
  const appImage = path.join(outRoot, 'OmniCore Editor.AppImage');
  fs.writeFileSync(appImage, `#!/usr/bin/env sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexec "$DIR/omnicore-editor-linux-x64/omnicore-editor" "$@"\n`, { mode: 0o755 });
  return appImage;
}

const artifact = dryRun
  ? manifestFor(targetPlatform).artifactPath
  : targetPlatform === 'win32'
    ? packageWindows()
    : targetPlatform === 'darwin'
    ? packageMac()
    : packageLinux();

const manifestPath = writeManifest(manifestFor(targetPlatform, artifact));
process.stdout.write(`Packaged OmniCore Editor desktop artifact: ${artifact}\nManifest: ${manifestPath}\n`);

function readPackageConfig() {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}
