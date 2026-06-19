const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const PORT = 4175;

const type = (file) => {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  return 'application/octet-stream';
};

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  let relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!relativePath) relativePath = 'tests/qa/qa-runtime.html';
  const filePath = path.resolve(ROOT, relativePath);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.statusCode = 404;
    response.end('Not found');
    return;
  }
  response.statusCode = 200;
  response.setHeader('content-type', type(filePath));
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.end(fs.readFileSync(filePath));
});
server.listen(PORT, '127.0.0.1', () => console.log('ready', PORT));
