// Tiny static server for local runs: node serve.mjs [port]. ES modules do not load from file://.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url)), port = Number(process.argv[2]) || 8097;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
createServer(async (q, s) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { s.writeHead(403); return s.end('no'); }
  try { const b = await readFile(file); s.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(b); }
  catch { s.writeHead(404); s.end('not found'); }
}).listen(port, () => console.log('Principals on http://localhost:' + port + '/admin.html?local=1'));
