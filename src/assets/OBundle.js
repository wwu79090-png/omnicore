import { createOmniError } from '../core/OmniError.js';

const MAGIC = 'OMNIBUNDLE:1\n';

export class LoadedOBundle {
  constructor(entries = []) {
    this.entries = new Map(entries.map((entry) => [entry.key, decodeEntry(entry)]));
    this.manifest = entries.map(({ key, type, size }) => ({ key, type, size }));
  }

  get(key) {
    return this.entries.get(key);
  }
}

const OBundle = {
  build({ assets = [] } = {}) {
    const entries = assets.map((asset) => encodeEntry(asset));
    return encodeText(`${MAGIC}${JSON.stringify({ entries })}`);
  },

  async load(buffer) {
    const text = decodeText(buffer);
    if (!text.startsWith(MAGIC)) throw createOmniError('OBundle', 'Invalid OmniCore obundle payload.');
    const payload = JSON.parse(text.slice(MAGIC.length));
    return new LoadedOBundle(payload.entries || []);
  }
};

function encodeEntry(asset) {
  const type = asset.type || inferType(asset.key);
  const encoded = type === 'json' ? JSON.stringify(asset.data) : String(asset.data ?? '');
  return {
    key: asset.key,
    type,
    data: encoded,
    size: encoded.length
  };
}

function decodeEntry(entry) {
  if (entry.type === 'json') return JSON.parse(entry.data);
  if (entry.type === 'binary') return base64ToBytes(entry.data);
  return entry.data;
}

function inferType(key = '') {
  return key.endsWith('.json') ? 'json' : 'text';
}

function encodeText(text) {
  return new TextEncoder().encode(text).buffer;
}

function decodeText(buffer) {
  const payload = buffer instanceof ArrayBuffer ? buffer : buffer.buffer || buffer;
  return new TextDecoder().decode(payload);
}

function base64ToBytes(value) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export { OBundle };
export default OBundle;
