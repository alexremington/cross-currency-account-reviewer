import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/accounts.csv', import.meta.url));
const port = 5195;
let playwright;
try { playwright = await import('playwright'); } catch { try { playwright = await import('/Users/aremington/codex-workspace/apps/.shared-playwright/node_modules/playwright/index.js'); } catch { console.log('Playwright smoke skipped: install Playwright to run browser validation.'); process.exit(0); } }
playwright = playwright.default || playwright;
const server = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, CROSS_CURRENCY_REVIEWER_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server readiness timeout')), 10000); server.stdout.on('data', (chunk) => { if (String(chunk).includes(`127.0.0.1:${port}`)) { clearTimeout(timer); resolve(); } }); server.stderr.on('data', (chunk) => { if (String(chunk).includes('EADDRINUSE')) { clearTimeout(timer); reject(new Error(`UI smoke port ${port} is already in use.`)); } }); server.on('error', reject); });
  const browser = await playwright.chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });
  const exampleDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download example CSV template' }).click();
  const example = await exampleDownload;
  if (example.suggestedFilename() !== 'account-upload-example.csv') throw new Error(`Unexpected example filename: ${example.suggestedFilename()}`);
  const exampleStream = await example.createReadStream();
  if (!exampleStream) throw new Error('Example CSV download did not produce a readable file.');
  let exampleText = '';
  for await (const chunk of exampleStream) exampleText += chunk;
  if (!exampleText.includes('CurrencyIsoCode') || !exampleText.includes('Ultimate_Parent_Account__c')) throw new Error('Named regression: example CSV template is missing required upload headers.');
  await page.locator('#csv-input').setInputFiles(fixture); if (!(await page.getByText('LastModifiedDate', { exact: true }).count())) throw new Error('Missing complete field guide.'); if (!(await page.getByText(/Skipped 1 row with unavailable Account Name/).count())) throw new Error('Named regression: unavailable Account Name row was not reported as a non-blocking skip.'); if (await page.getByRole('button', { name: 'Match now' }).isDisabled()) throw new Error('Named regression: unavailable Account Name row incorrectly blocked matching.'); await page.getByRole('button', { name: 'Match now' }).click();
  if (!(await page.getByText('Complete ledger ready: 2 scored candidate pairs.').count())) throw new Error('Missing ledger readiness summary.');
  const ledgerDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download score ledger CSV' }).click(); const ledger = await ledgerDownload;
  if (ledger.suggestedFilename() !== 'score-ledger.csv') throw new Error(`Unexpected ledger filename: ${ledger.suggestedFilename()}`); if (await ledger.failure()) throw new Error(`Ledger download failed: ${await ledger.failure()}`); const ledgerStream = await ledger.createReadStream(); if (!ledgerStream) throw new Error('Ledger download did not produce a readable file.'); let ledgerText = ''; for await (const chunk of ledgerStream) ledgerText += chunk; if (!ledgerText.includes('pairKey') || !ledgerText.includes('001EUR|001USD') || !ledgerText.includes('recommendedMasterId') || !ledgerText.includes('recommendedMasterCurrencyIsoCode')) throw new Error('Ledger download is missing the expected pair or recommended-master columns.');
  const summaryDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download summary JSON' }).click(); const summary = await summaryDownload; if (summary.suggestedFilename() !== 'score-ledger-summary.json') throw new Error(`Unexpected summary filename: ${summary.suggestedFilename()}`); const summaryStream = await summary.createReadStream(); let summaryText = ''; for await (const chunk of summaryStream) summaryText += chunk; if (!summaryText.includes('pairColumns') || !summaryText.includes('candidatePairCount')) throw new Error('Summary JSON is missing metadata or column definitions.');
  await page.locator('.queue-item').first().click();
  await page.locator('[data-override="website"]').check(); await page.locator('[data-reason="website"]').fill('Confirmed by reviewer'); await page.getByRole('button', { name: 'Save proposal changes' }).click(); await page.locator('#parent-currency').selectOption('USD');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export reviewed proposal' }).click(); await (await download).path();
  const text = await page.locator('.decision-score').textContent(); if (!text.includes('100')) throw new Error(`Expected visible 100 score, got ${text}`);
  for (const width of [390, 320]) { await page.setViewportSize({ width, height: 1000 }); const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth); if (overflow) throw new Error(`Unexpected body overflow at ${width}px.`); if (await page.locator('[aria-label="Website value"]').count() !== 1) throw new Error(`Missing accessible proposal field label at ${width}px.`); }
  await browser.close(); console.log('Playwright smoke passed: import → Match now → ledger download → inspect → override → save → proposal export.');
} finally { server.kill('SIGTERM'); }
