import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = '5193';
const env = { ...process.env, CROSS_CURRENCY_REVIEWER_PORT: port, CROSS_CURRENCY_REVIEWER_LAUNCH_MODE: 'detached', CROSS_CURRENCY_REVIEWER_NO_OPEN: '1' };

await runLauncher(['--force-restart', '--no-open']);
const first = await health();
assert.equal(first.appId, 'cross-currency-account-reviewer');
assert.equal(first.runtimeContractVersion, 'cross-currency-account-reviewer/v1');
await runLauncher(['--no-open']);
await runLauncher(['--stop', '--no-open']);
assert.equal(await health(), null);
console.log('Launcher smoke passed: detached start → reuse → stop with versioned health.');

async function runLauncher(args) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/launch-local-app.js', ...args], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject); child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
  if (result.code !== 0) throw new Error(`Launcher failed: ${result.stdout}\n${result.stderr}`);
  return result;
}

function health() {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/api/health`, { timeout: 1000 }, (response) => { let body = ''; response.on('data', (chunk) => { body += chunk; }); response.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } }); });
    request.on('error', () => resolve(null)); request.on('timeout', () => { request.destroy(); resolve(null); });
  });
}
