import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, normalizeWebsite } from '../core/csv.js';
import { generatePairs, scorePair } from '../core/scoring.js';
import { ACCOUNT_MODEL_VERSION } from '../core/account-model.js';
import { buildProposal } from '../core/proposals.js';
import { buildExports, buildScoreLedger } from '../core/export.js';
import parityFixtures from './fixtures/account-model-parity.json' with { type: 'json' };

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

test('named regression: pinned Account model metadata and lanes are emitted', () => {
  const parsed = parseCsv(fixture);
  const pair = scorePair(parsed.rows[0], parsed.rows[1]);
  assert.equal(pair.modelVersion, ACCOUNT_MODEL_VERSION);
  assert.equal(pair.lane, 'exact-confidence');
  assert.equal(pair.exactConfidenceRule, 'exact-name-website-address-phone');
  assert.equal(pair.accountNameRelationship, 'same-level-exact');
  assert.equal(pair.operationalScore, 100);
  assert.ok(pair.fieldScores.name === 1 && pair.fieldScores.website === 1);
});

test('named regression: currency eligibility does not add identity confidence', () => {
  const usdEur = scorePair(parseCsv(fixture).rows[0], parseCsv(fixture).rows[1]);
  const gbpCad = scorePair(parseCsv(fixture.replace('USD', 'GBP').replace('EUR', 'CAD')).rows[0], parseCsv(fixture.replace('USD', 'GBP').replace('EUR', 'CAD')).rows[1]);
  assert.equal(usdEur.score, gbpCad.score);
  assert.equal(usdEur.operationalScore, gbpCad.operationalScore);
  assert.equal(usdEur.reasonCodes.includes('currency-differs'), true);
});

test('named parity fixtures: mature Account lanes and contradiction metadata remain stable', () => {
  for (const fixtureCase of parityFixtures) {
    const pair = scorePair(fixtureCase.left, fixtureCase.right);
    assert.equal(pair.lane, fixtureCase.expected.lane, fixtureCase.name);
    assert.equal(pair.accountNameRelationship, fixtureCase.expected.relationship, fixtureCase.name);
    if (fixtureCase.expected.operationalScore != null) assert.equal(pair.operationalScore, fixtureCase.expected.operationalScore, fixtureCase.name);
    if (fixtureCase.expected.hasConflict) assert.ok(pair.reasonCodes.includes('conflicting-evidence'), fixtureCase.name);
  }
});

test('named regression: candidate generation reports and enforces a production safety budget', () => {
  const rows = Array.from({ length: 1200 }, (_, index) => ({
    id: `BUDGET-${index}`,
    name: 'Shared Account',
    currencyisocode: index % 2 ? 'EUR' : 'USD',
    website: '', phone: '', billingstreet: '', billingcity: '', billingstate: '', billingpostalcode: '', billingcountry: '', ultimate_parent_account__c: ''
  }));
  const pairs = generatePairs(rows);
  assert.equal(pairs.length, 250000);
  assert.equal(pairs.candidateStats.candidateCapHit, true);
});

test('named regression: placeholder account names cannot create high-confidence matches', () => {
  const left = { id: 'PLACEHOLDER-USD', name: '---', currencyisocode: 'USD', billingcountry: 'United States' };
  const right = { id: 'PLACEHOLDER-EUR', name: '---', currencyisocode: 'EUR', billingcountry: 'United States' };
  const pair = scorePair(left, right);
  assert.equal(pair.score, 0);
  assert.equal(pair.operationalScore, 0);
  assert.equal(pair.accountNameRelationship, 'missing-name');
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

test('named regression: full score ledger reconciles every scored pair and preserves evidence', () => {
  const parsed = parseCsv('Id,Name,CurrencyIsoCode,Website,Phone,BillingStreet,LastModifiedDate\nA,Acme Media,USD,https://acme.example.com,2125550100,1 Main,2025-01-01\nB,Acme Media,EUR,https://www.acme.example.com,2125550100,1 Main,2025-01-02');
  const pairs = generatePairs(parsed.rows); const result = buildScoreLedger(pairs, parsed.rows, { fileName: 'accounts.csv', headers: parsed.headers, generatedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(result.records.length, pairs.length); assert.equal(result.records[0].score, 100); assert.equal(result.records[0].evidence.length, 5); assert.ok(result.records[0].evidence.some((item) => item.field === 'address' && item.status === 'matched'));
  assert.match(result.csv, /pairKey/); assert.doesNotMatch(result.csv, /2025-01-01/); assert.match(result.json, /cross-currency-score-ledger\/v1/); assert.equal(result.source.recordCount, 2); assert.equal(result.summary.candidatePairCount, 1);
});

test('named regression: ledger preserves source cells and complete zero-pair schema', () => {
  const parsed = parseCsv('Id,Name,CurrencyIsoCode,Website\nA," Acme Media ",USD," https://acme.example.com "\nB,Other Media,USD,https://other.example.com');
  const empty = buildScoreLedger([], parsed.rows, { fileName: 'accounts.csv', headers: parsed.headers, generatedAt: '2026-01-01T00:00:00.000Z' });
  assert.match(empty.csv, /nameLeftRaw/); assert.match(empty.csv, /billingAddressRightNormalized/); assert.match(empty.csv, /ultimateParentAccountStatus/); assert.doesNotMatch(empty.csv, /sourceRecordCount|leftSourceRow|leftNameRaw|rightNameRaw/);
  const cross = parseCsv('Id,Name,CurrencyIsoCode,Website\nB,Acme Media,EUR,https://www.acme.example.com\nA," Acme Media ",USD," https://acme.example.com "');
  const ledger = buildScoreLedger(generatePairs(cross.rows), cross.rows, { fileName: 'accounts.csv' });
  assert.equal(ledger.records[0].pairKey, 'A|B'); assert.equal(ledger.records[0].left.id, 'A'); assert.equal(ledger.records[0].evidence.find((item) => item.field === 'name').left.raw, ' Acme Media '); assert.match(ledger.summaryJson, /pairColumns/);
});

test('named regression: invalid typed Account values are auditable and unavailable', () => {
  const left = { id: 'INVALID-WEBSITE', name: 'Renaissance Schools', currencyisocode: 'USD', website: '2125550100', phone: '2125550100', billingstreet: '1 Main', billingcity: 'New York', billingstate: 'NY', billingpostalcode: '10001', billingcountry: 'US' };
  const right = { id: 'VALID-WEBSITE', name: 'Renaissance Schools', currencyisocode: 'EUR', website: 'rencharters.org', phone: '2125550100', billingstreet: '1 Main', billingcity: 'New York', billingstate: 'NY', billingpostalcode: '10001', billingcountry: 'US' };
  const pair = scorePair(left, right);
  const website = pair.evidence.find((item) => item.field === 'website');
  assert.equal(website.status, 'invalid');
  assert.equal(website.leftRaw, '2125550100');
  assert.match(website.leftInvalidReason, /phone-like/);
  assert.ok(pair.reasons.includes('Website ignored as invalid'));
  assert.equal(pair.exactConfidenceRule, 'exact-name-address-phone');
});

test('named regression: valid unequal Website remains a conflict while Renaissance bundle promotes', () => {
  const left = { id: 'REN-USD', name: 'Renaissance Schools', currencyisocode: 'USD', website: 'rencharters.org', phone: '2125550100', billingstreet: '1 Main', billingcity: 'New York', billingstate: 'NY', billingpostalcode: '10001', billingcountry: 'US', ultimate_parent_account__c: 'Renaissance Schools' };
  const right = { ...left, id: 'REN-EUR', currencyisocode: 'EUR', website: 'renaissancecharter.org' };
  const pair = scorePair(left, right);
  assert.equal(pair.exactConfidenceRule, 'exact-name-address-phone');
  assert.equal(pair.operationalScore, 96);
  assert.equal(pair.evidence.find((item) => item.field === 'website').status, 'conflict');
  assert.ok(pair.reasonCodes.includes('conflicting-evidence'));
});
