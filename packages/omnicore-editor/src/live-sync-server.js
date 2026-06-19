import crypto from 'node:crypto';
import http from 'node:http';
import { createLiveSyncMessage } from './live-sync-protocol.js';

export function createLiveSyncServer({ port = 17361, host = '127.0.0.1', onMessage = null } = {}) {
  const clients = new Set();
  const server = http.createServer();
  server.on('upgrade', (request, socket) => {
    const key = request.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }
    const accept = crypto
      .createHash('sha1')
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
    clients.add(socket);
    socket.on('data', (buffer) => {
      const text = decodeFrame(buffer);
      if (!text) return;
      try {
        onMessage?.(JSON.parse(text), socket);
      } catch {
        // Ignore malformed editor traffic.
      }
    });
    socket.on('close', () => clients.delete(socket));
  });

  return {
    listen() {
      server.listen(port, host);
      return this;
    },
    close() {
      for (const client of clients) client.destroy();
      server.close();
    },
    broadcast(type, payload = {}) {
      const frame = encodeFrame(JSON.stringify(createLiveSyncMessage(type, payload, { source: 'runtime' })));
      for (const client of clients) client.write(frame);
    }
  };
}

function decodeFrame(buffer) {
  const length = buffer[1] & 0x7f;
  const maskOffset = length === 126 ? 4 : length === 127 ? 10 : 2;
  const mask = buffer.subarray(maskOffset, maskOffset + 4);
  const data = buffer.subarray(maskOffset + 4, maskOffset + 4 + length);
  return Buffer.from(data.map((byte, index) => byte ^ mask[index % 4])).toString('utf8');
}

function encodeFrame(text) {
  const payload = Buffer.from(text);
  const header = payload.length < 126
    ? Buffer.from([0x81, payload.length])
    : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
  return Buffer.concat([header, payload]);
}

export default createLiveSyncServer;
