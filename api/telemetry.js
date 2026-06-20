import { appendFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const DEFAULT_TELEMETRY_FILE = path.join(tmpdir(), 'omnicore-runtime-telemetry.jsonl');

export default async function telemetryHandler(request = {}, response = createResponseShim()) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
  }

  const payload = parseBody(request.body);
  if (!payload || payload.anonymous !== true || typeof payload.schema !== 'string') {
    return sendJson(response, 400, { ok: false, error: 'anonymous_runtime_payload_required' });
  }

  const outFile = process.env.OMNICORE_TELEMETRY_FILE || DEFAULT_TELEMETRY_FILE;
  const record = {
    receivedAt: new Date().toISOString(),
    schema: payload.schema,
    anonymous: true,
    ipHash: hashIp(request.headers?.['x-forwarded-for'] || request.socket?.remoteAddress || ''),
    payload
  };

  await mkdir(path.dirname(outFile), { recursive: true });
  await appendFile(outFile, `${JSON.stringify(record)}\n`, 'utf8');
  return sendJson(response, 202, { ok: true, stored: true });
}

function parseBody(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body !== 'string') return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function hashIp(ip) {
  if (!ip) return null;
  return createHash('sha256').update(String(ip).split(',')[0].trim()).digest('hex').slice(0, 16);
}

function sendJson(response, statusCode, payload) {
  response.setHeader?.('content-type', 'application/json; charset=utf-8');
  if (typeof response.status === 'function' && typeof response.json === 'function') {
    return response.status(statusCode).json(payload);
  }
  response.statusCode = statusCode;
  return response.end?.(JSON.stringify(payload));
}

function createResponseShim() {
  return {
    statusCode: 200,
    body: '',
    setHeader() {},
    end(payload = '') {
      this.body = payload;
      return this;
    }
  };
}
