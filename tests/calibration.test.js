import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { parseCsv } from '../core/csv.js';
import { generatePairs } from '../core/scoring.js';
import { buildScoreLedger } from '../core/export.js';

function runNode(script, args) {
  return new Promise((resolve, reject) => { const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = ''; let stderr = ''; child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; }); child.on('error', reject); child.on('close', (code) => code ? reject(new Error(stderr || stdout)) : resolve(stdout)); });
}

test('named regression: dynamic calibration emits private raw and sanitized semantic layers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cross-currency-calibration-'));
  const source = await readFile(new URL('./fixtures/accounts.csv', import.meta.url), 'utf8');
  const parsed = parseCsv(source); const ledger = buildScoreLedger(generatePairs(parsed.rows), parsed.rows, { fileName: 'synthetic-accounts.csv' });
  const sourcePath = join(dir, 'source.csv'); const ledgerPath = join(dir, 'ledger.csv'); const rawPath = join(dir, 'raw.json'); const sanitizedPath = join(dir, 'sanitized.json');
  await writeFile(sourcePath, source); await writeFile(ledgerPath, ledger.csv);
  await runNode('scripts/build-calibration-sample.js', ['--source', sourcePath, '--ledger', ledgerPath, '--raw-out', rawPath, '--sanitized-out', sanitizedPath, '--seed', 'test-seed', '--quotas', JSON.stringify({ exactSameLevelIdentity: 2, randomControls: 2 })]);
  const raw = JSON.parse(await readFile(rawPath, 'utf8')); const sanitizedText = await readFile(sanitizedPath, 'utf8'); const sanitized = JSON.parse(sanitizedText);
  assert.ok(raw.cases.length > 0); assert.ok(raw.cases[0].left.id); assert.ok(sanitized.cases[0].caseId.startsWith('case-'));
  assert.doesNotMatch(sanitizedText, /"left"|"right"|"leftId"|"rightId"|A\|B/);
  assert.equal(sanitized.sourceArtifact, 'private'); assert.equal(sanitized.ledgerArtifact, 'private');
});
