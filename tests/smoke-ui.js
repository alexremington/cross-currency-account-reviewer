import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/accounts.csv', import.meta.url));
let playwright;
try { playwright = await import('playwright'); } catch { try { playwright = await import('/Users/aremington/codex-workspace/apps/.shared-playwright/node_modules/playwright/index.js'); } catch { console.log('Playwright smoke skipped: install Playwright to run browser validation.'); process.exit(0); } }
playwright = playwright.default || playwright;
const server = spawn(process.execPath, ['server/server.js'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server readiness timeout')), 10000); server.stdout.on('data', (chunk) => { if (String(chunk).includes('127.0.0.1:5190')) { clearTimeout(timer); resolve(); } }); server.on('error', reject); });
  const browser = await playwright.chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://127.0.0.1:5190', { waitUntil: 'networkidle' }); await page.locator('#csv-input').setInputFiles(fixture); await page.getByRole('button', { name: 'Match now' }).click(); await page.locator('.queue-item').first().click();
  await page.locator('[data-override="website"]').check(); await page.locator('[data-reason="website"]').fill('Confirmed by reviewer'); await page.getByRole('button', { name: 'Save proposal changes' }).click(); await page.locator('#parent-currency').selectOption('USD');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export reviewed proposal' }).click(); await (await download).path();
  const text = await page.locator('.decision-score').textContent(); if (!text.includes('100')) throw new Error(`Expected visible 100 score, got ${text}`);
  for (const width of [390, 320]) { await page.setViewportSize({ width, height: 1000 }); const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth); if (overflow) throw new Error(`Unexpected body overflow at ${width}px.`); if (await page.locator('[aria-label="website value"]').count() !== 1) throw new Error(`Missing accessible proposal field label at ${width}px.`); }
  await browser.close(); console.log('Playwright smoke passed: import → Match now → inspect → override → save → export.');
} finally { server.kill('SIGTERM'); }
