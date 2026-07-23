import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseCsv } from '../core/csv.js';
import { generatePairs, scorePair } from '../core/scoring.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const parsed = parseCsv(await readFile(new URL('../tests/fixtures/accounts.csv', import.meta.url), 'utf8'));
if (parsed.errors.length) throw new Error(parsed.errors.join('\n'));
const pairs = generatePairs(parsed.rows);
const exact = pairs.filter((pair) => pair.score === 100);
if (exact.length !== 1 || exact[0].currencyLeft === exact[0].currencyRight) throw new Error(`Sanity failure: expected one exact cross-currency pair, got ${exact.length}.`);
if (pairs.some((pair) => pair.score === 100 && !pair.currenciesDiffer)) throw new Error('Sanity failure: same-currency pair scored 100.');
if (pairs.some((pair) => pair.score === 100 && pair.reasonCodes[0] !== 'exact-cross-currency-identity')) throw new Error('Sanity failure: exact pair lacks semantic reason code.');
if (pairs.some((pair) => pair.score !== pair.operationalScore)) throw new Error('Sanity failure: canonical score diverged from compatibility score.');

const sentinelPair = scorePair(
  { id: 'SANITY-USD', name: 'Sentinel Example', currencyisocode: 'USD', website: '0', phone: '2025550100', billingstreet: '1 Main', billingcity: 'Washington', billingcountry: 'US' },
  { id: 'SANITY-EUR', name: 'Sentinel Example', currencyisocode: 'EUR', website: 'example.org', phone: '2025550100', billingstreet: '1 Main', billingcity: 'Washington', billingcountry: 'US' }
);
const sentinelEvidence = sentinelPair.evidence.find((item) => item.field === 'website');
if (sentinelEvidence?.status !== 'invalid' || sentinelPair.score !== sentinelPair.operationalScore) throw new Error('Sanity failure: sentinel Website was not treated as invalid unavailable evidence.');

const conflictPair = scorePair(
  { id: 'CONFLICT-USD', name: 'Conflict Example', currencyisocode: 'USD', website: 'example.org', phone: '2025550100', billingstreet: '1 Main', billingcity: 'Washington', billingcountry: 'US' },
  { id: 'CONFLICT-EUR', name: 'Conflict Example', currencyisocode: 'EUR', website: 'other-example.org', phone: '2025550100', billingstreet: '1 Main', billingcity: 'Washington', billingcountry: 'US' }
);
if (conflictPair.evidence.find((item) => item.field === 'website')?.status !== 'conflict') throw new Error('Sanity failure: valid unequal Website was not retained as a conflict.');
console.log(`Results sanity passed: ${pairs.length} candidates, ${exact.length} exact cross-currency pair.`);
