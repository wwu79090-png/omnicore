#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function createAssetWatchServer({
  source = 'source-assets',
  debounceMs = 100,
  converter = defaultConverter,
  changePlanner = null,
  websocket = null
} = {}) {
  const state = {
    source: path.resolve(source),
    debounceMs,
    converter,
    changePlanner,
    websocket,
    pending: new Set(),
    timer: null,
    watcher: null
  };

  return {
    get debounceMs() {
      return state.debounceMs;
    },
    recordChange(file) {
      state.pending.add(normalizePath(file));
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => this.flushPending(), state.debounceMs);
    },
    async flushPending() {
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      const files = [...state.pending];
      state.pending.clear();
      if (!files.length) return { files: [], conversions: [] };
      const conversions = await state.converter(files);
      const changePlan = typeof state.changePlanner === 'function'
        ? await state.changePlanner({ files, conversions, source: state.source })
        : null;
      const payload = {
        type: 'assets:hot-update',
        source: state.source,
        files,
        conversions,
        incremental: true,
        targetMs: 200,
        changedCount: files.length,
        pushedAt: new Date().toISOString()
      };
      if (changePlan) payload.changePlan = changePlan;
      state.websocket?.send?.(JSON.stringify(payload));
      return payload;
    },
    start() {
      fs.mkdirSync(state.source, { recursive: true });
      state.watcher = fs.watch(state.source, { recursive: true }, (_event, file) => {
        if (file) this.recordChange(file);
      });
      return this;
    },
    close() {
      if (state.timer) clearTimeout(state.timer);
      state.watcher?.close?.();
      state.timer = null;
      state.watcher = null;
    }
  };
}

function defaultConverter(files) {
  return files.map((file) => ({
    file,
    output: file
      .replace(/\.(png|jpe?g)$/iu, '.webp')
      .replace(/\.(mp3|wav)$/iu, '.ogg')
      .replace(/\.aseprite$/iu, '.json')
  }));
}

function normalizePath(file) {
  return String(file).replace(/\\/g, '/');
}

function parseArgs(argv) {
  const options = {
    source: 'source-assets',
    debounceMs: 100,
    once: false,
    files: [],
    out: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') {
      index += 1;
      options.source = argv[index];
    } else if (arg === '--debounce') {
      index += 1;
      options.debounceMs = Number(argv[index]);
    } else if (arg === '--once') {
      options.once = true;
    } else if (arg === '--file') {
      index += 1;
      options.files.push(argv[index]);
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    }
  }
  return options;
}

function writeReport(file, payload) {
  if (!file) return;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  const server = createAssetWatchServer({
    source: options.source,
    debounceMs: Number.isFinite(options.debounceMs) && options.debounceMs >= 0 ? options.debounceMs : 100
  });

  if (options.once) {
    for (const file of options.files) server.recordChange(file);
    const report = await server.flushPending();
    writeReport(options.out, report);
    console.log(JSON.stringify(report, null, 2));
    server.close();
  } else {
    server.start();
    console.log(`[OmniCore] watching ${path.resolve(options.source)} for source asset changes`);
    const close = () => {
      server.close();
      process.exit(0);
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  }
}

export default createAssetWatchServer;
