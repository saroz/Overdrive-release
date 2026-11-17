// Local preview server: serves the repository on http://127.0.0.1:8097 with empty JSON for /api/*,
// so pages render offline. Usage: npm run serve, then open
//   http://127.0.0.1:8097/app/src/main/assets/web/local/index.html
//   http://127.0.0.1:8097/web-ui/preview/components.html
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { ROOT } from './build.mjs';

const REPO = normalize(join(ROOT, '..'));
const PORT = Number(process.env.PORT || 8097);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{}');
  }
  const file = normalize(join(REPO, decodeURIComponent(url.pathname)));
  if (!file.startsWith(REPO + sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${REPO} on http://127.0.0.1:${PORT}`));
