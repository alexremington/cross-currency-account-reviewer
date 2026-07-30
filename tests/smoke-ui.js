import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/accounts.csv', import.meta.url));
const port = 5195;
let playwright;
try { playwright = await import('playwright'); } catch { try { playwright = await import('/Users/aremington/codex-workspace/apps/.shared-playwright/node_modules/playwright/index.js'); } catch { console.log('Playwright smoke skipped: install Playwright to run browser validation.'); process.exit(0); } }
playwright = playwright.default || playwright;
const server = spawn(process.execPath, ['server/server.js'], { cwd: root, env: { ...process.env, CROSS_CURRENCY_REVIEWER_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });

async function readDownload(download, expectedName) {
  if (download.suggestedFilename() !== expectedName) throw new Error(`Unexpected download filename: ${download.suggestedFilename()}`);
  if (await download.failure()) throw new Error(`Download failed: ${await download.failure()}`);
  const stream = await download.createReadStream();
  if (!stream) throw new Error(`${expectedName} did not produce a readable stream.`);
  let text = '';
  for await (const chunk of stream) text += chunk;
  return text;
}

try {
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server readiness timeout')), 10000); server.stdout.on('data', (chunk) => { if (String(chunk).includes(`127.0.0.1:${port}`)) { clearTimeout(timer); resolve(); } }); server.stderr.on('data', (chunk) => { if (String(chunk).includes('EADDRINUSE')) { clearTimeout(timer); reject(new Error(`UI smoke port ${port} is already in use.`)); } }); server.on('error', reject); });
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });

  const exampleDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download example CSV template' }).click();
  const example = await exampleDownload;
  const exampleText = await readDownload(example, 'account-upload-example.csv');
  if (!exampleText.includes('CurrencyIsoCode') || !exampleText.includes('Ultimate_Parent_Account__c')) throw new Error('Example CSV template is missing expected upload headers.');

  await page.locator('#csv-input').setInputFiles(fixture);
  if (!(await page.getByText('LastModifiedDate', { exact: true }).count())) throw new Error('Missing complete field guide.');
  if (!(await page.getByText(/Skipped 1 row with unavailable Account Name/).count())) throw new Error('Unavailable Account Name row was not reported as a non-blocking skip.');
  if (await page.getByRole('button', { name: 'Download full ledger JSON', exact: true }).count()) throw new Error('Named regression: retired full-ledger JSON download is still rendered.');
  if (await page.getByRole('button', { name: 'Match now', exact: true }).isDisabled()) throw new Error('Match now is incorrectly disabled after valid import.');
  if (await page.getByRole('button', { name: 'Match and download full score ledger', exact: true }).isDisabled()) throw new Error('Combined match/download action is incorrectly disabled after valid import.');

  const matchButton = page.getByRole('button', { name: 'Match now', exact: true });
  await matchButton.focus();
  await page.keyboard.press('Enter');
  if (await page.locator('#status-pill').textContent() !== 'Matching…' || await matchButton.getAttribute('aria-busy') !== 'true') throw new Error('Named regression: matching progress was not visible during the real keyboard path.');
  await page.getByText('Complete ledger ready: 2 scored candidate pairs.').waitFor({ state: 'visible' });
  if (await page.locator('#queue, #detail').count()) throw new Error('Named regression: removed pair review sections are still rendered.');

  await page.locator('#csv-input').setInputFiles({ name: 'accounts-second.csv', mimeType: 'text/csv', buffer: await readFile(fixture) });
  const combinedDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Match and download full score ledger', exact: true }).click();
  const combinedCsv = await readDownload(await combinedDownload, 'score-ledger.csv');
  if (!combinedCsv.includes('recommendedMasterId') || !combinedCsv.includes('recommendedSubordinateId') || !combinedCsv.includes('matchSummary') || combinedCsv.includes('fieldScores')) throw new Error('Named regression: combined action did not download the compact score ledger.');
  if (!(await page.getByRole('button', { name: 'Match and download full score ledger', exact: true }).isDisabled())) throw new Error('Combined action remained enabled after successful one-shot use.');
  if (await page.evaluate(() => document.activeElement?.id) !== 'match-button') throw new Error('Named regression: focus was not restored after the combined download.');

  const standaloneDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download score ledger CSV', exact: true }).click();
  const standaloneCsv = await readDownload(await standaloneDownload, 'score-ledger.csv');
  if (standaloneCsv !== combinedCsv) throw new Error('Standalone CSV download does not match the combined ledger.');

  const summaryDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download summary JSON', exact: true }).click();
  const summaryJson = await readDownload(await summaryDownload, 'score-ledger-summary.json');
  if (!summaryJson.includes('pairColumns') || !summaryJson.includes('"candidatePairCount": 2')) throw new Error('Summary JSON is missing metadata or pair count.');

  await page.locator('#csv-input').setInputFiles({ name: 'zero-pairs.csv', mimeType: 'text/csv', buffer: Buffer.from('Id,Name,CurrencyIsoCode\nA,Alpha,USD\nB,Beta,USD\n') });
  const zeroDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Match and download full score ledger', exact: true }).click();
  const zeroCsv = await readDownload(await zeroDownload, 'score-ledger.csv');
  await page.getByText('No scored pairs were found.').waitFor({ state: 'visible' });
  if (!zeroCsv.includes('recommendedMasterId')) throw new Error('Zero-pair combined action did not produce a valid empty ledger.');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    if (overflow) throw new Error(`Unexpected body overflow at ${width}px.`);
    for (const name of ['Match now', 'Match and download full score ledger']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      if (!box || box.x < 0 || box.x + box.width > width) throw new Error(`${name} is clipped at ${width}px.`);
    }
  }

  await browser.close();
  console.log('Playwright smoke passed: import → Match now → combined CSV download → standalone CSV/summary downloads → zero-pair output → responsive layout.');
} finally { server.kill('SIGTERM'); }
