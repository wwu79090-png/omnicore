#!/usr/bin/env node
/* eslint-disable no-bitwise, no-console */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BENCHMARK = path.join('tests', 'benchmark', 'benchmark.html');
const DEFAULT_OUTPUT = path.join('assets', 'branding', 'perf-demo.gif');
const DEFAULT_DURATION_MS = 5000;
const DEFAULT_FPS = 8;
const DEFAULT_CAPTURE_WIDTH = 480;
const DEFAULT_SPRITE_COUNT = 1000;
const DEFAULT_TARGET_FPS = 144;

export function buildPerfGifConfig(argv = [], cwd = process.cwd()) {
  return {
    benchmarkPath: path.resolve(cwd, readOption(argv, ['--benchmark', '--input'], DEFAULT_BENCHMARK)),
    outputPath: path.resolve(cwd, readOption(argv, ['--out', '--output'], DEFAULT_OUTPUT)),
    durationMs: readNumberOption(argv, ['--duration', '--duration-ms'], DEFAULT_DURATION_MS),
    fps: readNumberOption(argv, ['--fps'], DEFAULT_FPS),
    captureWidth: readNumberOption(argv, ['--width', '--capture-width'], DEFAULT_CAPTURE_WIDTH),
    spriteCount: readNumberOption(argv, ['--sprites', '--sprite-count'], DEFAULT_SPRITE_COUNT),
    targetFps: readNumberOption(argv, ['--target-fps'], DEFAULT_TARGET_FPS),
    viewport: {
      width: readNumberOption(argv, ['--viewport-width'], 1280),
      height: readNumberOption(argv, ['--viewport-height'], 720)
    }
  };
}

export function createStressLoopSource({ spriteCount = DEFAULT_SPRITE_COUNT, targetFps = DEFAULT_TARGET_FPS } = {}) {
  return `(() => {
    const canvas = document.querySelector("#bench");
    if (!canvas) throw new Error("OmniCore benchmark canvas #bench not found.");
    if (window.__OMNICORE_PERF_GIF_LOOP__?.stop) window.__OMNICORE_PERF_GIF_LOOP__.stop();
    const context = canvas.getContext("2d");
    const settings = { spriteCount: ${Math.max(1, Math.floor(spriteCount))}, targetFps: ${Math.max(1, Math.floor(targetFps))} };
    const sprites = Array.from({ length: settings.spriteCount }, (_, index) => ({
      x: (index * 17) % canvas.width,
      y: (index * 31) % canvas.height,
      vx: 1.2 + (index % 13) * 0.11,
      vy: ((index % 17) - 8) * 0.08,
      hue: (index * 37) % 360,
      size: 2 + (index % 5) * 0.55
    }));
    const fpsLabel = document.querySelector("[data-fps-indicator] strong");
    const fpsText = "${Math.max(1, Math.floor(targetFps))} FPS";
    if (fpsLabel) fpsLabel.textContent = fpsText;
    let frame = 0;
    let animationFrame = 0;
    function render() {
      frame += 1;
      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#06111f");
      gradient.addColorStop(1, "#0f2d46");
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (let ring = 0; ring < 10; ring += 1) {
        context.beginPath();
        context.arc(canvas.width * 0.5, canvas.height * 0.5, 34 + ring * 46 + Math.sin(frame / 8) * 5, 0, Math.PI * 2);
        context.strokeStyle = "rgba(56, 189, 248, " + Math.max(0.025, 0.16 - ring * 0.012) + ")";
        context.stroke();
      }
      for (const sprite of sprites) {
        sprite.x = (sprite.x + sprite.vx + canvas.width) % canvas.width;
        sprite.y = (sprite.y + sprite.vy + canvas.height) % canvas.height;
        context.fillStyle = "hsl(" + sprite.hue + " 92% 66%)";
        context.fillRect(sprite.x, sprite.y, sprite.size, sprite.size);
      }
      animationFrame = requestAnimationFrame(render);
    }
    render();
    window.__OMNICORE_PERF_GIF_LOOP__ = {
      spriteCount: settings.spriteCount,
      targetFps: settings.targetFps,
      stop() {
        cancelAnimationFrame(animationFrame);
      }
    };
  })();`;
}

export async function generatePerfGif(argv = process.argv.slice(2)) {
  const config = buildPerfGifConfig(argv);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  let server = null;
  try {
    server = await createBenchmarkServer(config.benchmarkPath);
    const page = await browser.newPage({ viewport: config.viewport });
    await page.goto(new URL(path.basename(config.benchmarkPath), server.url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#bench', { timeout: 5000 });
    await page.addScriptTag({ content: createStressLoopSource(config) });
    await page.waitForFunction(
      (count) => window.__OMNICORE_PERF_GIF_LOOP__?.spriteCount === count,
      config.spriteCount,
      { timeout: 5000 }
    );

    const frames = await captureBenchmarkFrames(page, config);
    encodeGif(frames, config.outputPath);
    console.log(`[OmniCore] performance GIF written to ${config.outputPath}`);
    return config.outputPath;
  } finally {
    await server?.close?.();
    await browser.close();
  }
}

export function createBenchmarkServer(benchmarkPath) {
  const rootDir = path.dirname(path.resolve(benchmarkPath));
  const rootWithSeparator = `${rootDir}${path.sep}`;
  const server = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(requestUrl.pathname);
      const relativePath = pathname === '/' ? path.basename(benchmarkPath) : pathname.slice(1);
      const filePath = path.resolve(rootDir, relativePath);
      if (filePath !== rootDir && !filePath.startsWith(rootWithSeparator)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'content-type': contentTypeFor(filePath),
        'cache-control': 'no-store'
      });
      response.end(readFileSync(filePath));
    } catch (error) {
      response.writeHead(500);
      response.end(String(error?.message || error));
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close((error) => (error ? closeReject(error) : closeResolve()));
        })
      });
    });
  });
}

async function captureBenchmarkFrames(page, config) {
  const intervalMs = 1000 / Math.max(1, config.fps);
  const frameCount = Math.max(1, Math.round(config.durationMs / intervalMs));
  const frames = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    if (frame > 0) await page.waitForTimeout(intervalMs);
    const captured = await page.evaluate(({ captureWidth }) => {
      const source = document.querySelector('#bench');
      const scale = captureWidth / source.width;
      const width = Math.max(1, Math.round(captureWidth));
      const height = Math.max(1, Math.round(source.height * scale));
      const scratch = document.createElement('canvas');
      scratch.width = width;
      scratch.height = height;
      const context = scratch.getContext('2d', { willReadFrequently: true });
      context.drawImage(source, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      const indexed = new Uint8Array(width * height);
      for (let index = 0, pixel = 0; index < image.data.length; index += 4, pixel += 1) {
        const red = image.data[index] >> 5;
        const green = image.data[index + 1] >> 5;
        const blue = image.data[index + 2] >> 6;
        indexed[pixel] = (red << 5) | (green << 2) | blue;
      }
      return {
        width,
        height,
        indices: Array.from(indexed)
      };
    }, { captureWidth: config.captureWidth });
    frames.push({
      width: captured.width,
      height: captured.height,
      delayMs: intervalMs,
      indices: Uint8Array.from(captured.indices)
    });
  }
  return frames;
}

export function encodeGif(frames, outputPath) {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error('encodeGif requires at least one frame.');
  }
  const bytes = createGifBytes(frames);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(bytes));
  return outputPath;
}

function createGifBytes(frames) {
  const [{ width, height }] = frames;
  const bytes = [];
  writeAscii(bytes, 'GIF89a');
  writeShort(bytes, width);
  writeShort(bytes, height);
  bytes.push(0xf7, 0x00, 0x00);
  writeGlobalPalette(bytes);
  writeLoopExtension(bytes);

  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) {
      throw new Error('All GIF frames must use the same dimensions.');
    }
    writeGraphicControlExtension(bytes, frame.delayMs);
    bytes.push(0x2c);
    writeShort(bytes, 0);
    writeShort(bytes, 0);
    writeShort(bytes, width);
    writeShort(bytes, height);
    bytes.push(0x00);
    bytes.push(0x08);
    writeSubBlocks(bytes, lzwEncode(frame.indices || quantizeRgba(frame.rgba), 8));
  }

  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}

function writeGlobalPalette(bytes) {
  for (let red = 0; red < 8; red += 1) {
    for (let green = 0; green < 8; green += 1) {
      for (let blue = 0; blue < 4; blue += 1) {
        bytes.push(
          Math.round((red / 7) * 255),
          Math.round((green / 7) * 255),
          Math.round((blue / 3) * 255)
        );
      }
    }
  }
}

function quantizeRgba(rgba) {
  const pixels = new Uint8Array(rgba.length / 4);
  for (let index = 0, pixel = 0; index < rgba.length; index += 4, pixel += 1) {
    const red = rgba[index] >> 5;
    const green = rgba[index + 1] >> 5;
    const blue = rgba[index + 2] >> 6;
    pixels[pixel] = (red << 5) | (green << 2) | blue;
  }
  return pixels;
}

function lzwEncode(indices, minCodeSize = 8) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const codeSize = minCodeSize + 1;
  const maxCodesBeforeClear = 250;
  let bitBuffer = 0;
  let bitCount = 0;
  const output = [];

  const writeCode = (code) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  writeCode(clearCode);
  let codesSinceClear = 0;
  for (let index = 0; index < indices.length; index += 1) {
    writeCode(indices[index]);
    codesSinceClear += 1;
    if (codesSinceClear >= maxCodesBeforeClear && index < indices.length - 1) {
      writeCode(clearCode);
      codesSinceClear = 0;
    }
  }
  writeCode(endCode);
  if (bitCount > 0) output.push(bitBuffer & 0xff);
  return Uint8Array.from(output);
}

function writeGraphicControlExtension(bytes, delayMs = 80) {
  bytes.push(0x21, 0xf9, 0x04, 0x00);
  writeShort(bytes, Math.max(1, Math.round(delayMs / 10)));
  bytes.push(0x00, 0x00);
}

function writeLoopExtension(bytes) {
  bytes.push(0x21, 0xff, 0x0b);
  writeAscii(bytes, 'NETSCAPE2.0');
  bytes.push(0x03, 0x01);
  writeShort(bytes, 0);
  bytes.push(0x00);
}

function writeSubBlocks(bytes, data) {
  for (let offset = 0; offset < data.length; offset += 255) {
    const chunk = data.subarray(offset, offset + 255);
    bytes.push(chunk.length, ...chunk);
  }
  bytes.push(0x00);
}

function writeAscii(bytes, value) {
  for (let index = 0; index < value.length; index += 1) bytes.push(value.charCodeAt(index));
}

function writeShort(bytes, value) {
  bytes.push(value & 0xff, (value >> 8) & 0xff);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function readOption(argv, names, fallback) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    for (const name of names) {
      if (arg === name) return argv[index + 1] || fallback;
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
    }
  }
  return fallback;
}

function readNumberOption(argv, names, fallback) {
  const value = Number(readOption(argv, names, fallback));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isMain(metaUrl = import.meta.url) {
  return Boolean(process.argv[1] && fileURLToPath(metaUrl) === path.resolve(process.argv[1]));
}

if (isMain()) {
  generatePerfGif().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
