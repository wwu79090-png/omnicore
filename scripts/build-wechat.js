#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FOUR_MB = 4 * 1024 * 1024;
const DEFAULT_IGNORED = new Set(['.git', 'node_modules', 'coverage']);
const DEFAULT_IGNORED_FILE_PATTERNS = [
  /^quality-report(?:[-\w]*)?\.json$/iu,
  /^production-ready(?:[-\w]*)?\.json$/iu,
  /^engine-improvements(?:[-\w]*)?\.json$/iu,
  /^engine-doctor(?:[-\w]*)?\.json$/iu,
  /^.*-check\.json$/iu
];

function parseArgs(argv) {
  const options = {
    source: path.resolve('dist'),
    out: path.resolve('dist', 'wechat'),
    debug: false,
    appid: 'touristappid',
    limitBytes: FOUR_MB
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--debug') {
      options.debug = true;
      continue;
    }
    if (arg === '--source') {
      index += 1;
      options.source = path.resolve(argv[index]);
    } else if (arg === '--out') {
      index += 1;
      options.out = path.resolve(argv[index]);
    } else if (arg === '--appid') {
      index += 1;
      options.appid = argv[index];
    } else if (arg === '--limit-bytes') {
      index += 1;
      options.limitBytes = Number(argv[index]);
    }
  }
  return options;
}

export default function buildWechatPackage(options = {}) {
  const config = {
    source: path.resolve(options.source || 'dist'),
    out: path.resolve(options.out || path.join('dist', 'wechat')),
    debug: Boolean(options.debug),
    appid: options.appid || 'touristappid',
    limitBytes: Number(options.limitBytes || FOUR_MB)
  };
  if (!fs.existsSync(config.source)) {
    throw new Error(`WeChat source directory not found: ${config.source}`);
  }

  fs.rmSync(config.out, { recursive: true, force: true });
  fs.mkdirSync(config.out, { recursive: true });
  copyDirectory(config.source, config.out);
  writeJson(path.join(config.out, 'project.config.json'), {
    appid: config.appid,
    projectname: 'omnicore-wechat-game',
    compileType: 'game',
    miniprogramRoot: './'
  });
  writeJson(path.join(config.out, 'game.json'), {
    deviceOrientation: 'portrait',
    showStatusBar: false,
    networkTimeout: {
      request: 10000,
      connectSocket: 10000,
      uploadFile: 10000,
      downloadFile: 10000
    }
  });
  ensureGameEntry(config.out);
  if (config.debug) installDebugProxy(config.out);

  const files = collectFiles(config.out);
  const directories = collectDirectories(config.out);
  const bytes = files.reduce((total, file) => total + file.bytes, 0);
  const largestFiles = files
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 8)
    .map((file) => ({
      file: path.relative(config.out, file.file).replace(/\\/g, '/'),
      bytes: file.bytes
    }));
  const largestDirectories = directories
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 8)
    .map((entry) => ({
      directory: path.relative(config.out, entry.directory).replace(/\\/g, '/') || '.',
      bytes: entry.bytes
    }));
  const pass = bytes <= config.limitBytes;
  const report = {
    target: 'wechat',
    outDir: config.out,
    bytes,
    limitBytes: config.limitBytes,
    limit: '4MB',
    debug: config.debug,
    largestFiles,
    largestDirectories,
    pass
  };
  writeJson(path.join(config.out, 'wechat-build-report.json'), report);
  if (!pass) {
    throw new Error([
      `WeChat package size ${bytes} bytes exceeds 4MB red line (${config.limitBytes} bytes).`,
      'Largest files:',
      formatSizeEntries(largestFiles, 'file'),
      'Largest directories:',
      formatSizeEntries(largestDirectories, 'directory')
    ].join('\n'));
  }
  return report;
}

function copyDirectory(source, out) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (DEFAULT_IGNORED.has(entry.name)) continue;
    if (entry.isFile() && DEFAULT_IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))) continue;
    const from = path.join(source, entry.name);
    const to = path.join(out, entry.name);
    if (path.resolve(from) === path.resolve(out)) continue;
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyDirectory(from, to);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

function ensureGameEntry(out) {
  const gameJs = path.join(out, 'game.js');
  if (!fs.existsSync(gameJs)) {
    fs.writeFileSync(gameJs, 'console.log("[OmniCore] WeChat game entry ready");\n', 'utf8');
  }
}

function installDebugProxy(out) {
  const proxyFile = path.join(out, 'omnicore-debug-proxy.js');
  fs.writeFileSync(proxyFile, DEBUG_PROXY_SOURCE, 'utf8');
  const gameJs = path.join(out, 'game.js');
  const gameSource = fs.readFileSync(gameJs, 'utf8');
  if (!gameSource.includes('omnicore-debug-proxy.js')) {
    fs.appendFileSync(gameJs, '\n;try { require("./omnicore-debug-proxy.js"); } catch (error) { console.warn("[OmniCore] debug proxy load failed", error); }\n', 'utf8');
  }
}

function collectFiles(dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...collectFiles(fullPath));
    else if (entry.isFile()) output.push({ file: fullPath, bytes: fs.statSync(fullPath).size });
  }
  return output;
}

function collectDirectories(root, dir = root) {
  let bytes = 0;
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const childEntries = collectDirectories(root, fullPath);
      output.push(...childEntries);
      bytes += childEntries.find((item) => item.directory === fullPath)?.bytes || 0;
    } else if (entry.isFile()) {
      bytes += fs.statSync(fullPath).size;
    }
  }
  output.push({ directory: dir, bytes });
  return output;
}

function formatSizeEntries(entries, key) {
  return entries.length
    ? entries.map((entry) => `- ${entry[key]}: ${entry.bytes} bytes`).join('\n')
    : '- none';
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

const DEBUG_PROXY_SOURCE = `;(function installOmniCoreWechatDebugProxy(global) {
  var DEFAULT_KEYS = ['player.x', 'player.hp'];

  function readPath(source, key) {
    if (!source) return undefined;
    if (typeof source.get === 'function') {
      var direct = source.get(key);
      if (direct !== undefined) return direct;
    }
    return String(key).split('.').reduce(function read(object, segment) {
      return object == null ? undefined : object[segment];
    }, source);
  }

  function collect(store, keys) {
    return keys.reduce(function build(snapshot, key) {
      snapshot[key] = readPath(store, key);
      return snapshot;
    }, {});
  }

  function install(options) {
    options = options || {};
    var game = options.game || global.__OMNICORE_GAME__;
    var store = options.store || (game && game.store) || global.__OMNICORE_STORE__;
    var keys = options.keys || DEFAULT_KEYS;
    var logger = options.logger || console;
    var intervalMs = options.intervalMs || 1000;

    function print(reason) {
      (logger.info || console.info).call(logger, '[OmniCore WeChat Debug]', reason || 'runtime-state', collect(store, keys));
    }

    print('attached');
    var timer = setInterval(function tick() { print('tick'); }, intervalMs);
    return {
      keys: keys,
      print: print,
      stop: function stop() { clearInterval(timer); }
    };
  }

  global.__OMNICORE_DEBUG_PROXY__ = { install: install, keys: DEFAULT_KEYS };
  if (global.__OMNICORE_AUTO_DEBUG_PROXY__ !== false) {
    global.__OMNICORE_DEBUG_SESSION__ = install({});
  }
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis);
`;

if (isCli()) {
  try {
    const report = buildWechatPackage(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(`[OmniCore] WeChat build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
