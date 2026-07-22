import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const APP_ID = 'cross-currency-account-reviewer';
const RUNTIME_CONTRACT_VERSION = 'cross-currency-account-reviewer/v1';
const runtimeId = String(process.env.CROSS_CURRENCY_REVIEWER_RUNTIME_ID || `${Date.now()}-${process.pid}`);
const port = Number(process.env.CROSS_CURRENCY_REVIEWER_PORT || 5190);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
    if (requestPath === '/api/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ok: true, appId: APP_ID, runtimeContractVersion: RUNTIME_CONTRACT_VERSION, pid: process.pid, port, runtimeId }));
      return;
    }
    const relative = requestPath === '/' ? 'public/index.html' : requestPath.replace(/^\/+/, '');
    const target = normalize(join(root, relative));
    if (!target.startsWith(root + sep)) throw new Error('Not found');
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Cross-Currency Account Reviewer: http://127.0.0.1:${port}`));
