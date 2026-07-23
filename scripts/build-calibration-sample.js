import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { canonicalHeader } from '../core/csv.js';
import { scorePair } from '../core/scoring.js';
import { ACCOUNT_MODEL_VERSION } from '../core/account-model.js';

const CALIBRATION_VERSION = 'cross-currency-account-calibration/v1';
const DEFAULT_QUOTAS = {
  exactSameLevelIdentity: 20,
  validTypedVariation: 20,
  addressGeographyDisagreement: 20,
  hierarchyScopeVariation: 20,
  sparseRecords: 20,
  invalidTypedValues: 20,
  contradictionHeavy: 20,
  scoreBandControls: 20,
  randomControls: 20
};

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}
function requiredArg(name) { const value = arg(name); if (!value) throw new Error(`Missing --${name}.`); return value; }
function hash(value) { return createHash('sha256').update(String(value)).digest('hex').slice(0, 20); }
function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function random(seed) {
  let state = hash(seed).split('').reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7) || 7;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; };
}
function parseJson(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { throw new Error(`Invalid JSON: ${value}`); } }
function tryJson(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function value(row, ...keys) { for (const key of keys) { const found = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase()); if (found && row[found] !== '') return row[found]; } return ''; }
async function* csvObjects(path, project = (row) => row) {
  const stream = createReadStream(path, { encoding: 'utf8' });
  let headers = null; let row = []; let cell = ''; let quoted = false; let previousWasCr = false;
  const emit = function* emitRecord() {
    if (!row.some((value) => value !== '')) return;
    if (!headers) { headers = row.map(canonicalHeader); return; }
    yield project(Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? '').trim()])));
  };
  for await (const chunk of stream) {
    for (let index = 0; index < chunk.length; index += 1) {
      const ch = chunk[index];
      if (quoted) {
        if (ch === '"' && chunk[index + 1] === '"') { cell += '"'; index += 1; }
        else if (ch === '"') quoted = false;
        else cell += ch;
        continue;
      }
      if (ch === '"' && cell === '') { quoted = true; continue; }
      if (ch === ',') { row.push(cell); cell = ''; previousWasCr = false; continue; }
      if (ch === '\n' || ch === '\r') {
        if (ch === '\n' && previousWasCr) { previousWasCr = false; continue; }
        row.push(cell); cell = ''; previousWasCr = ch === '\r';
        for (const record of emit()) yield record;
        row = [];
        continue;
      }
      previousWasCr = false; cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); for (const record of emit()) yield record; }
}
function compactSource(row) { return { id: value(row, 'id'), name: value(row, 'name'), website: value(row, 'website'), phone: value(row, 'phone'), billingstreet: value(row, 'billingstreet'), billingcity: value(row, 'billingcity'), billingstate: value(row, 'billingstate'), billingpostalcode: value(row, 'billingpostalcode'), billingcountry: value(row, 'billingcountry'), ultimate_parent_account__c: value(row, 'ultimate_parent_account__c') }; }
function compactLedger(row) { const aliases = { leftId: ['leftId', 'leftRecordId', 'left_record_id'], rightId: ['rightId', 'rightRecordId', 'right_record_id'], score: ['score', 'pairScore', 'pair_score'], band: ['band', 'lane'], lane: ['lane', 'band'], exactIdentity: ['exactIdentity', 'exact_identity'], exactConfidenceRule: ['exactConfidenceRule', 'exact_confidence_rule'], exactConfidenceStatus: ['exactConfidenceStatus', 'exact_confidence_status'], modelVersion: ['modelVersion', 'model_version'], nameStatus: ['nameStatus', 'name_status'], websiteStatus: ['websiteStatus', 'website_status'], phoneStatus: ['phoneStatus', 'phone_status'], billingAddressStatus: ['billingAddressStatus', 'billing_address_status'], ultimateParentAccountStatus: ['ultimateParentAccountStatus', 'ultimate_parent_account_status'], fieldScores: ['fieldScores', 'field_score_summary'], evidenceFields: ['evidenceFields', 'evidence'], reasonCodes: ['reasonCodes', 'reasons'], accountNameRelationship: ['accountNameRelationship', 'account_name_relationship'], contradictionCategory: ['contradictionCategory', 'contradiction_category'] }; const result = {}; for (const [key, keys] of Object.entries(aliases)) result[key.toLowerCase()] = value(row, ...keys); return result; }
function parseFieldScoreSummary(valueText) { return Object.fromEntries(String(valueText || '').split(';').map((entry) => entry.split(':')).filter(([key, score]) => key && Number.isFinite(Number(score))).map(([key, score]) => [key, Number(score)])); }
function semanticEvidenceStatuses(left, right, ledger, fieldScores) {
  const matched = new Set(String(value(ledger, 'evidenceFields', 'evidencefields')).split(';').map((item) => item.trim()).filter(Boolean));
  const sourceStatus = (field, evidenceName) => {
    if (matched.has(evidenceName)) return 'matched';
    const leftValue = normalize(left[field]); const rightValue = normalize(right[field]);
    if (!leftValue || !rightValue) return 'blank';
    return Number(fieldScores[field] ?? 0) >= 0.9 ? 'matched' : 'conflict';
  };
  return { name: sourceStatus('name', 'company_name'), website: sourceStatus('website', 'website'), phone: sourceStatus('phone', 'phone'), billingAddress: matched.has('address') ? 'matched' : (['billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry'].some((field) => has(left, right, field)) ? 'conflict' : 'blank'), ultimateParentAccount: sourceStatus('ultimate_parent_account__c', 'ultimate_parent') };
}
function normalize(value) { return String(value ?? '').trim().toLowerCase(); }
function has(left, right, field) { return normalize(left[field]) && normalize(right[field]); }
function same(left, right, field) { return has(left, right, field) && normalize(left[field]) === normalize(right[field]); }
function pairRows(sourceRows, ledgerRow) {
  const byId = new Map(sourceRows.map((row) => [String(value(row, 'id')), row]));
  return [byId.get(String(value(ledgerRow, 'leftId', 'leftid', 'leftRecordId', 'left_record_id'))), byId.get(String(value(ledgerRow, 'rightId', 'rightid', 'rightRecordId', 'right_record_id')))];
}
function classify(left, right, ledger) {
  const fields = ['website', 'phone', 'billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry'];
  const comparable = fields.filter((field) => has(left, right, field));
  const conflicts = comparable.filter((field) => !same(left, right, field));
  const invalid = fields.filter((field) => ['0', 'n/a', 'na', 'none', 'unknown', 'no website found'].includes(normalize(left[field])) || ['0', 'n/a', 'na', 'none', 'unknown', 'no website found'].includes(normalize(right[field])));
  const name = normalize(left.name) === normalize(right.name);
  const nameTokens = new Set(`${left.name || ''} ${right.name || ''}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const hierarchy = [...nameTokens].some((token) => ['branch', 'chapter', 'division', 'east', 'west', 'north', 'south', 'regional'].includes(token));
  const sparse = comparable.length <= 1;
  const score = Number(value(ledger, 'score', 'operationalScore', 'operationalscore', 'pairScore', 'pair_score') || 0);
  const contradictionHeavy = conflicts.length >= 2 || score < 60;
  const stratum = name && conflicts.length === 0 ? 'exactSameLevelIdentity'
    : invalid.length ? 'invalidTypedValues'
      : hierarchy ? 'hierarchyScopeVariation'
        : conflicts.some((field) => field.startsWith('billing')) ? 'addressGeographyDisagreement'
          : conflicts.length ? 'contradictionHeavy'
            : sparse ? 'sparseRecords'
              : score >= 90 || score < 70 ? 'scoreBandControls' : 'validTypedVariation';
  return { stratum, comparableFieldCount: comparable.length, conflictFields: conflicts, invalidFields: invalid, nameExact: name, hierarchySignal: hierarchy, contradictionHeavy, score };
}
function semanticCase(left, right, ledger, features, seed, index) {
  const pairKey = [value(ledger, 'leftId', 'leftid'), value(ledger, 'rightId', 'rightid')].map(String).sort().join('|');
  const caseId = `case-${hash(`${seed}|${pairKey}`)}`;
  return {
    caseId, stratum: features.stratum, score: features.score, band: String(value(ledger, 'band')), lane: String(value(ledger, 'lane', 'band')),
    exactIdentity: String(value(ledger, 'exactIdentity', 'exactidentity')).toLowerCase() === 'true', modelVersion: String(value(ledger, 'modelVersion', 'modelversion') || ACCOUNT_MODEL_VERSION),
    evidenceStatuses: semanticEvidenceStatuses(left, right, ledger, parseFieldScoreSummary(value(ledger, 'fieldScores', 'fieldscores'))),
    fieldScores: { ...parseFieldScoreSummary(value(ledger, 'fieldScores', 'fieldscores')), ...tryJson(value(ledger, 'fieldScores', 'fieldscores'), {}) }, evidenceFields: String(value(ledger, 'evidenceFields', 'evidencefields')).split(';').map((item) => item.trim()).filter(Boolean), reasonCodes: String(value(ledger, 'reasonCodes', 'reasoncodes')).split(' | ').filter(Boolean),
    exactConfidenceRule: String(value(ledger, 'exactConfidenceRule', 'exactconfidencerule')), exactConfidenceStatus: String(value(ledger, 'exactConfidenceStatus', 'exactconfidencestatus')),
    accountNameRelationship: String(value(ledger, 'accountNameRelationship', 'accountnamerelationship')), contradictionCategory: String(value(ledger, 'contradictionCategory', 'contradictioncategory')),
    comparableFieldCount: features.comparableFieldCount, conflictFields: features.conflictFields, invalidFields: features.invalidFields,
    label: '', reviewerConfidence: '', decidingEvidence: [], disagreementNotes: '', selectionIndex: index
  };
}

const sourcePath = resolve(requiredArg('source'));
const ledgerPath = resolve(requiredArg('ledger'));
const rawOut = resolve(arg('raw-out', '/private/tmp/cross-currency-calibration/raw-sample.json'));
const sanitizedOut = resolve(arg('sanitized-out', 'data/calibration/account-calibration-corpus.json'));
const seed = arg('seed', 'cross-currency-account-reviewer');
const quotas = { ...DEFAULT_QUOTAS, ...parseJson(arg('quotas'), {}) };
const rng = random(seed);
const buckets = new Map(Object.keys(DEFAULT_QUOTAS).map((key) => [key, []]));
const seen = Object.fromEntries(Object.keys(DEFAULT_QUOTAS).map((key) => [key, 0]));
function offer(stratum, candidate, quota) {
  const limit = Math.max(0, number(quota, 0)); if (!limit) return;
  seen[stratum] += 1; const bucket = buckets.get(stratum); if (bucket.length < limit) { bucket.push(candidate); return; }
  const replacement = Math.floor(rng() * seen[stratum]); if (replacement < limit) bucket[replacement] = candidate;
}
let candidateCount = 0;
const sourceById = new Map();
for await (const sourceRow of csvObjects(sourcePath, compactSource)) sourceById.set(String(sourceRow.id), sourceRow);
let index = 0;
for await (const ledger of csvObjects(ledgerPath, compactLedger)) {
  const left = sourceById.get(String(value(ledger, 'leftId', 'leftid', 'leftRecordId', 'left_record_id'))); const right = sourceById.get(String(value(ledger, 'rightId', 'rightid', 'rightRecordId', 'right_record_id'))); index += 1;
  if (!left || !right) continue;
  candidateCount += 1; const candidate = { left, right, ledger, features: classify(left, right, ledger), index };
  offer(candidate.features.stratum, candidate, quotas[candidate.features.stratum]); offer('randomControls', candidate, quotas.randomControls);
}
const selected = []; const counts = {};
for (const [stratum] of Object.entries(quotas)) { const take = (buckets.get(stratum) || []).map((candidate) => stratum === 'randomControls' ? { ...candidate, features: { ...candidate.features, stratum } } : candidate); counts[stratum] = take.length; selected.push(...take); }
const rawCases = selected.map((candidate, index) => ({ caseId: `case-${hash(`${seed}|${value(candidate.ledger, 'leftId', 'leftid')}|${value(candidate.ledger, 'rightId', 'rightid')}`)}`, left: candidate.left, right: candidate.right, ledger: candidate.ledger, features: candidate.features, selectionIndex: index }));
const semanticCases = selected.map((candidate, index) => semanticCase(candidate.left, candidate.right, candidate.ledger, candidate.features, seed, index));
const metadata = { calibrationVersion: CALIBRATION_VERSION, generatedAt: new Date().toISOString(), sourceArtifact: sourcePath, ledgerArtifact: ledgerPath, producerVersion: arg('producer-version', ''), modelVersion: ACCOUNT_MODEL_VERSION, adapterVersion: 'cross-currency-policy-adapter/v1', seed, quotas, selectionCounts: counts, candidateCount, selectedCount: selected.length };
await mkdir(dirname(rawOut), { recursive: true }); await mkdir(dirname(sanitizedOut), { recursive: true });
await writeFile(rawOut, JSON.stringify({ metadata, cases: rawCases }, null, 2));
await writeFile(sanitizedOut, JSON.stringify({ ...metadata, sourceArtifact: 'private', ledgerArtifact: 'private', cases: semanticCases }, null, 2));
console.log(JSON.stringify({ metadata, rawOut, sanitizedOut }, null, 2));
