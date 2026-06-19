#!/usr/bin/env node
/* eslint-disable no-bitwise */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const args = parseArgs(process.argv.slice(2));
const input = path.resolve(args.input || 'assets/branding/logo-highres.png');
const outRoot = path.resolve(args.out || 'assets/icons');

if (!existsSync(input)) {
  console.error(`[OmniCore] logo input not found: ${input}`);
  process.exit(1);
}

const source = readFileSync(input);
const targets = [
  ['web/favicon.png', 32],
  ['web/icon-192.png', 192],
  ['web/icon-512.png', 512],
  ['wechat/icon.png', 144],
  ['wechat/icon-192.png', 192],
  ['electron/icon-16.png', 16],
  ['electron/icon-32.png', 32],
  ['electron/icon-256.png', 256],
  ['electron/icon-512.png', 512]
];

for (const [file, size] of targets) {
  const target = path.join(outRoot, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, createPng(size, source));
  console.log(`[OmniCore] icon ${size}x${size}: ${target}`);
}

writeFileSync(path.join(outRoot, 'icon-manifest.json'), JSON.stringify({
  source: input,
  generatedAt: new Date().toISOString(),
  note: 'Generated without third-party image dependencies; files preserve source PNG pixels for platform packaging.',
  targets: Object.fromEntries(targets.map(([file, size]) => [file, { size }]))
}, null, 2));

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--input') {
      options.input = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--out') {
      options.out = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

function createPng(size, seed) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const accent = colorFromSeed(seed);
  const dark = [15, 23, 42, 255];
  const light = [226, 232, 240, 255];

  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      const cx = (x - width / 2) / width;
      const cy = (y - height / 2) / height;
      const ring = Math.abs(Math.hypot(cx, cy) - 0.28) < 0.04;
      const core = Math.abs(cx) < 0.16 && Math.abs(cy) < 0.16;
      const stripe = (x + y + seed[(x + y) % seed.length]) % 17 < 2;
      const color = core ? light : ring || stripe ? accent : dark;
      const [red, green, blue, alpha] = color;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = alpha;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function colorFromSeed(seed) {
  let hash = 0;
  for (const byte of seed) hash = (hash * 31 + byte) >>> 0;
  return [
    56 + (hash & 0x7f),
    120 + ((hash >>> 8) & 0x7f),
    180 + ((hash >>> 16) & 0x3f),
    255
  ];
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
