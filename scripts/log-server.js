#!/usr/bin/env node
/* eslint-disable no-bitwise */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const port = Number(portArg?.split('=')[1] || process.env.OMNICORE_LOG_PORT || 8787);

const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('OmniCore log server is running. Connect with ws://host:8787\n');
});

server.on('upgrade', (request, socket) => {
  const key = request.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    ''
  ].join('\r\n'));

  const peer = request.socket.remoteAddress || 'device';
  console.log(`[OmniCore] log client connected: ${peer}`);
  socket.on('data', (buffer) => {
    const message = decodeClientFrame(buffer);
    if (!message) return;
    try {
      const payload = JSON.parse(message);
      console.log(`[${payload.at || new Date().toISOString()}] ${payload.level || 'log'}:`, ...payload.args);
    } catch {
      console.log(`[OmniCore] ${message}`);
    }
  });
  socket.on('close', () => console.log(`[OmniCore] log client disconnected: ${peer}`));
});

server.listen(port, () => {
  console.log(`[OmniCore] log server listening on ws://0.0.0.0:${port}`);
});

function decodeClientFrame(buffer) {
  if (buffer.length < 6) return '';
  const opcode = buffer[0] & 0x0f;
  if (opcode === 0x8) return '';
  let offset = 2;
  let length = buffer[1] & 0x7f;
  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }
  const masked = Boolean(buffer[1] & 0x80);
  const mask = masked ? buffer.subarray(offset, offset + 4) : null;
  if (masked) offset += 4;
  const payload = buffer.subarray(offset, offset + length);
  const output = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    output[index] = masked ? payload[index] ^ mask[index % 4] : payload[index];
  }
  return output.toString('utf8');
}
