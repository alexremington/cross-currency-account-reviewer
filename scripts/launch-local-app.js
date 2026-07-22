#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const PROJECT_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SERVER_SCRIPT = path.join(PROJECT_DIR, 'server', 'server.js');
const APP_ID = 'cross-currency-account-reviewer';
const RUNTIME_CONTRACT_VERSION = 'cross-currency-account-reviewer/v1';
const LABEL = 'com.cross-currency-account-reviewer.server';
const useLaunchAgent = process.platform === 'darwin' && process.env.CROSS_CURRENCY_REVIEWER_LAUNCH_MODE !== 'detached';
const port = Number(process.env.CROSS_CURRENCY_REVIEWER_PORT || 5190);
const url = `http://127.0.0.1:${port}`;
const stateDir = process.env.CROSS_CURRENCY_REVIEWER_STATE_DIR || defaultStateDir();
const statePath = path.join(stateDir, 'runtime.json');
const logDir = path.join(stateDir, 'logs');
const outLog = path.join(logDir, 'server.out.log');
const errLog = path.join(logDir, 'server.err.log');
const plistPath = path.join(stateDir, `${LABEL}.plist`);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const forceRestart = args.has('--force-restart');
  const noOpen = args.has('--no-open');
  if (args.has('--stop')) {
    await stopRuntime();
    console.log(`${APP_ID} stopped.`);
    return;
  }
  if (![...args].every((arg) => ['--force-restart', '--no-open'].includes(arg))) throw new Error(`Unknown launcher option. Use --force-restart, --no-open, or --stop.`);
  await mkdir(logDir, { recursive: true });
  const current = await health();
  if (current && isCurrentRuntime(current) && !forceRestart) {
    console.log(`${APP_ID} is already running at ${url}`);
    if (!noOpen) await openUrl(url);
    return;
  }
  if (useLaunchAgent) await ensureLaunchAgent({ forceRestart, current });
  else await ensureDetachedRuntime({ forceRestart, current });
  const ready = await waitForHealth();
  if (!ready) throw new Error(`${APP_ID} did not become ready. Check ${outLog} and ${errLog}.`);
  console.log(`${APP_ID} is running at ${url}`);
  if (!noOpen) await openUrl(url);
}

function defaultStateDir() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Cross-Currency Account Reviewer');
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Cross-Currency Account Reviewer');
  return path.join(os.tmpdir(), 'cross-currency-account-reviewer');
}

function isCurrentRuntime(value) {
  return value?.ok === true && value.appId === APP_ID && value.runtimeContractVersion === RUNTIME_CONTRACT_VERSION && Number(value.port) === port;
}

async function health() { return requestJson(`${url}/api/health`).catch(() => null); }

function requestJson(target) {
  return new Promise((resolve, reject) => {
    const request = http.get(target, { timeout: 1000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    request.on('timeout', () => request.destroy(new Error('request timed out')));
    request.on('error', reject);
  });
}

async function ensureLaunchAgent({ forceRestart, current }) {
  if (current && !isCurrentRuntime(current) && !forceRestart) throw incompatiblePortError(current);
  await bootoutLaunchAgent();
  if (await portListening() && (!current || current.appId !== APP_ID)) throw incompatiblePortError(current);
  const runtimeId = randomUUID();
  await writeFile(statePath, JSON.stringify({ appId: APP_ID, runtimeContractVersion: RUNTIME_CONTRACT_VERSION, runtimeId, mode: 'launchd', pid: null, port, projectDir: PROJECT_DIR }, null, 2));
  await writeFile(plistPath, launchAgentPlist(runtimeId));
  await execFile('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, plistPath]);
}

async function ensureDetachedRuntime({ forceRestart, current }) {
  if (current && !isCurrentRuntime(current)) {
    if (!forceRestart) throw incompatiblePortError(current);
    await stopRuntime();
  } else if (current && forceRestart) {
    await stopRuntime();
  }
  if (await portListening()) {
    const afterStop = await health();
    if (afterStop) throw incompatiblePortError(afterStop);
    throw new Error(`Port ${port} is already in use by an unknown local process. Stop it or set CROSS_CURRENCY_REVIEWER_PORT.`);
  }
  const runtimeId = randomUUID();
  const outFd = openSync(outLog, 'a');
  const errFd = openSync(errLog, 'a');
  const child = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: PROJECT_DIR,
    env: { ...process.env, CROSS_CURRENCY_REVIEWER_PORT: String(port), CROSS_CURRENCY_REVIEWER_RUNTIME_ID: runtimeId },
    detached: true,
    stdio: ['ignore', outFd, errFd],
    windowsHide: true
  });
  closeSync(outFd);
  closeSync(errFd);
  await writeFile(statePath, JSON.stringify({ appId: APP_ID, runtimeContractVersion: RUNTIME_CONTRACT_VERSION, runtimeId, mode: 'detached', pid: child.pid, port, projectDir: PROJECT_DIR }, null, 2));
  child.unref();
}

async function stopRuntime() {
  if (useLaunchAgent) await bootoutLaunchAgent();
  const saved = await readJson(statePath);
  const current = await health();
  if (saved?.runtimeId && current?.runtimeId === saved.runtimeId && Number(current.pid) > 0) await terminatePid(Number(current.pid));
}

async function readJson(filePath) {
  try { return JSON.parse(await readFile(filePath, 'utf8')); } catch { return null; }
}

async function bootoutLaunchAgent() {
  try { await execFile('/bin/launchctl', ['bootout', `gui/${process.getuid()}/${LABEL}`]); } catch { /* already stopped */ }
}

async function terminatePid(pid) {
  if (process.platform === 'win32') {
    try { await execFile('taskkill', ['/PID', String(pid), '/T', '/F']); } catch { /* already stopped */ }
    return;
  }
  try { process.kill(pid, 'SIGTERM'); } catch { /* already stopped */ }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isAlive(pid)) return;
    await delay(100);
  }
  try { process.kill(pid, 'SIGKILL'); } catch { /* already stopped */ }
}

function isAlive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }

async function waitForHealth() { for (let attempt = 0; attempt < 120; attempt += 1) { const value = await health(); if (isCurrentRuntime(value)) return value; await delay(250); } return null; }

async function portListening() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(400);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

async function openUrl(target) {
  if (process.env.CROSS_CURRENCY_REVIEWER_NO_OPEN === '1') return;
  if (process.platform === 'darwin') await execFile('/usr/bin/open', [target]);
  else if (process.platform === 'win32') await execFile('cmd.exe', ['/c', 'start', '', target]);
  else await execFile('xdg-open', [target]);
}

function launchAgentPlist(runtimeId) {
  const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${LABEL}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(SERVER_SCRIPT)}</string></array>
<key>WorkingDirectory</key><string>${xml(PROJECT_DIR)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>EnvironmentVariables</key><dict>
<key>CROSS_CURRENCY_REVIEWER_PORT</key><string>${port}</string>
<key>CROSS_CURRENCY_REVIEWER_RUNTIME_ID</key><string>${xml(runtimeId)}</string>
</dict>
<key>StandardOutPath</key><string>${xml(outLog)}</string>
<key>StandardErrorPath</key><string>${xml(errLog)}</string>
</dict></plist>
`;
}

function incompatiblePortError(value) { return new Error(`Port ${port} is occupied by an incompatible or unknown process${value?.appId ? ` (${value.appId}, ${value.runtimeContractVersion || 'unknown contract'})` : ''}. Stop it or choose another port.`); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
