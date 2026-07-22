import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, normalizeWebsite } from '../core/csv.js';
import { generatePairs, scorePair } from '../core/scoring.js';
import { buildProposal } from '../core/proposals.js';
import { buildExports } from '../core/export.js';

const fixture = `Id,Name,CurrencyIsoCode,Website,Phone,BillingStreet\nA,Acme Media,USD,https://acme.example.com,2125550100,1 Main\nB,Acme Media,EUR,https://www.acme.example.com,2125550100,1 Main`;

test('named regression: exact normalized cross-currency identity scores 100', () => {
  const parsed = parseCsv(fixture); const pairs = generatePairs(parsed.rows);
  assert.equal(pairs.length, 1); assert.equal(pairs[0].score, 100); assert.equal(pairs[0].reasonCodes[0], 'exact-cross-currency-identity');
});

test('named regression: same-currency pair cannot enter exact cross-currency lane', () => {
  const parsed = parseCsv(fixture.replace('B,Acme Media,EUR', 'B,Acme Media,USD')); const pair = scorePair(parsed.rows[0], parsed.rows[1]);
  assert.equal(pair.currenciesDiffer, false); assert.notEqual(pair.score, 100); assert.equal(pair.band, 'low-confidence');
  assert.equal(generatePairs(parsed.rows).length, 0);
});

test('named regression: conflicting evidence prevents 100', () => {
  const parsed = parseCsv(fixture.replace('https://www.acme.example.com', 'https://other.example.com')); const pair = scorePair(parsed.rows[0], parsed.rows[1]);
  assert.notEqual(pair.score, 100); assert.ok(pair.reasonCodes.includes('conflicting-evidence'));
});

test('CSV handles BOM, CRLF, and quoted commas', () => {
  const parsed = parseCsv('\uFEFFId,Name,CurrencyIsoCode,BillingStreet\r\nA,"Acme, Inc.",USD,"1 Main, Suite 2"\r\n');
  assert.equal(parsed.errors.length, 0); assert.equal(parsed.rows[0].name, 'Acme, Inc.'); assert.equal(parsed.rows[0].billingstreet, '1 Main, Suite 2'); assert.equal(normalizeWebsite('https://www.Example.com/path'), 'example com');
});

test('named regression: Unicode identity is retained for matching', () => {
  const parsed = parseCsv('Id,Name,CurrencyIsoCode,Website\nA,株式会社サンプル,USD,https://sample.example\nB,株式会社サンプル,EUR,https://sample.example');
  assert.equal(generatePairs(parsed.rows)[0].score, 100);
});

test('named regression: core rejects reasonless overrides', () => {
  const parsed = parseCsv(fixture); const pair = generatePairs(parsed.rows)[0];
  assert.throws(() => buildProposal(parsed.rows[0], parsed.rows[1], pair, { website: { value: 'changed', reason: '' } }), /requires a reason/);
});

test('proposal preserves source provenance and exports reconcile', () => {
  const parsed = parseCsv(fixture); const pair = generatePairs(parsed.rows)[0]; const proposal = buildProposal(parsed.rows[0], parsed.rows[1], pair, { parentCurrency: 'USD' });
  assert.equal(proposal.fields.name.sourceId, 'A'); assert.equal(proposal.parentCurrency, 'USD');
  const result = buildExports([{ pair, proposal }]); assert.match(result.parentCsv, /sourceAccountIds/); assert.match(result.associationCsv, /A/); assert.equal(result.audit.length, 1); assert.match(result.auditJson, /"records"/);
});
