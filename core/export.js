import { selectRecommendedMaster } from './recommended-master.js';
import { legacyScoreSemantics } from './score-semantics.js';

function csvCell(value) { const text = String(value ?? ''); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
export const CSV_CHUNK_TARGET_BYTES = 64 * 1024;
export function toCsvChunks(rows, columns, targetLength = CSV_CHUNK_TARGET_BYTES) {
  const chunks = [];
  let chunk = `${columns.join(',')}\n`;
  for (const row of rows) {
    const line = `${columns.map((column) => csvCell(row[column])).join(',')}\n`;
    if (chunk.length > columns.length && chunk.length + line.length > targetLength) {
      chunks.push(chunk);
      chunk = line;
    } else {
      chunk += line;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
export function toCsv(rows, columns) { return toCsvChunks(rows, columns).join(''); }

const LEDGER_VERSION = 'cross-currency-score-ledger/v2';
const SCORE_SEMANTICS = legacyScoreSemantics({ objectType: 'account', surface: 'cross-currency-reviewer', modelVersion: 'duplicate-reviewer-account-model/2026-07-26-evidence-aware', populationDefinition: 'admitted cross-currency Account candidate pairs' });
const PRESENTATION_VERSION = 'human-review-score-ledger/v1';
const RECOMMENDED_MASTER_FIELDS = [
  ['id', 'recommendedMasterId'], ['name', 'recommendedMasterName'], ['currencyisocode', 'recommendedMasterCurrencyIsoCode'],
  ['website', 'recommendedMasterWebsite'], ['phone', 'recommendedMasterPhone'], ['billingstreet', 'recommendedMasterBillingStreet'],
  ['billingcity', 'recommendedMasterBillingCity'], ['billingstate', 'recommendedMasterBillingState'], ['billingpostalcode', 'recommendedMasterBillingPostalCode'],
  ['billingcountry', 'recommendedMasterBillingCountry'], ['ultimate_parent_account__c', 'recommendedMasterUltimateParentAccount']
];
const LEDGER_COLUMNS = [
  'pairKey', 'leftId', 'leftCurrency', 'rightId', 'rightCurrency', 'score', 'scoreUnrounded', 'weightedRawValue', 'weightedEffectiveValue', 'fieldTreatments', 'band', 'scoreContractVersion', 'scoreSemantics', 'scoreFieldsContractVersion', 'canonicalField', 'precisionField', 'diagnosticFields', 'diagnosticScale', 'surface', 'populationDefinition', 'modelVersion', 'accountNameRelationship', 'accountNameRelationshipReason', 'hierarchyRelationship', 'hierarchyEvidence', 'contradictionCategory', 'contradictionReason', 'exactConfidenceRule', 'intermediateConfidenceRule', 'exactConfidenceEligible', 'intermediateConfidenceEligible', 'fieldScores', 'exactIdentity', 'reasonCodes', 'reasons', 'matchedEvidenceFields',
  'conflictingEvidenceFields', 'blankEvidenceFields',
  ...RECOMMENDED_MASTER_FIELDS.map(([, column]) => column),
  'nameStatus', 'nameLeftRaw', 'nameLeftNormalized', 'nameRightRaw', 'nameRightNormalized',
  'websiteStatus', 'websiteLeftRaw', 'websiteLeftNormalized', 'websiteRightRaw', 'websiteRightNormalized',
  'phoneStatus', 'phoneLeftRaw', 'phoneLeftNormalized', 'phoneRightRaw', 'phoneRightNormalized',
  'billingAddressStatus', 'billingAddressLeftRaw', 'billingAddressLeftNormalized', 'billingAddressRightRaw', 'billingAddressRightNormalized',
  'directParentAccountStatus', 'directParentAccountLeftRaw', 'directParentAccountLeftNormalized', 'directParentAccountRightRaw', 'directParentAccountRightNormalized',
  'ultimateParentAccountStatus', 'ultimateParentAccountLeftRaw', 'ultimateParentAccountLeftNormalized', 'ultimateParentAccountRightRaw', 'ultimateParentAccountRightNormalized'
];
const evidenceColumns = [
  ['name', 'name'], ['website', 'website'], ['phone', 'phone'], ['address', 'billingAddress'], ['parent_name', 'directParentAccount'], ['ultimate_parent_account__c', 'ultimateParentAccount']
];
const rawField = (record, field) => record.__raw?.[field] ?? record[field] ?? '';
const accountAddress = (record) => ['billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry'].map((field) => rawField(record, field)).filter(Boolean).join(', ');
const accountHierarchy = (record) => [rawField(record, 'parent_name'), rawField(record, 'ultimate_parent_account__c')].filter(Boolean).join(' | ');
const ACCOUNT_PRESENTATION_COLUMNS = [
  'recommendedMasterId', 'recommendedMasterName', 'recommendedMasterCurrency', 'recommendedMasterWebsite', 'recommendedMasterPhone', 'recommendedMasterAddress', 'recommendedMasterHierarchy',
  'recommendedSubordinateId', 'recommendedSubordinateName', 'recommendedSubordinateCurrency', 'recommendedSubordinateWebsite', 'recommendedSubordinatePhone', 'recommendedSubordinateAddress', 'recommendedSubordinateHierarchy',
  'score', 'matchSummary', 'reviewReason'
];
const rawEvidence = (record, field) => field === 'address'
  ? ['billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry'].map((key) => rawField(record, key)).filter(Boolean).join(' | ')
  : rawField(record, field);

export function buildScoreLedger(pairs, records, metadata = {}) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const ledgerRecords = pairs.map((pair) => {
    const left = byId.get(pair.leftId) || {};
    const right = byId.get(pair.rightId) || {};
    const recommendedMaster = selectRecommendedMaster(left, right) || {};
    const evidence = pair.evidence.map((item) => ({
      field: item.field,
      label: item.label,
      status: item.status,
      left: { raw: rawEvidence(left, item.field), normalized: item.left || '' },
      right: { raw: rawEvidence(right, item.field), normalized: item.right || '' }
    }));
    return {
      pairKey: [pair.leftId, pair.rightId].sort().join('|'),
      left: { id: pair.leftId, currency: rawField(left, 'currencyisocode') },
      right: { id: pair.rightId, currency: rawField(right, 'currencyisocode') },
      score: Math.round(pair.score),
      scoreUnrounded: pair.score,
      weightedRawValue: pair.rawWeightedScore ?? pair.score,
      weightedEffectiveValue: pair.effectiveWeightedScore ?? pair.score,
      ...SCORE_SEMANTICS,
      fieldTreatments: pair.fieldTreatments || [],
      band: pair.band,
      modelVersion: pair.modelVersion || '',
      accountNameRelationship: pair.accountNameRelationship || '',
      accountNameRelationshipReason: pair.accountNameRelationshipReason || '',
      hierarchyRelationship: pair.hierarchyRelationship || 'none',
      hierarchyEvidence: pair.hierarchyEvidence || {},
      contradictionCategory: pair.contradictionCategory || '',
      contradictionReason: pair.contradictionReason || '',
      exactConfidenceRule: pair.exactConfidenceRule || '',
      intermediateConfidenceRule: pair.intermediateConfidenceRule || '',
      exactConfidenceEligible: Boolean(pair.exactConfidenceEligible),
      intermediateConfidenceEligible: Boolean(pair.intermediateConfidenceEligible),
      recommendedMaster: Object.fromEntries(RECOMMENDED_MASTER_FIELDS.map(([field]) => [field, rawField(recommendedMaster, field)])),
      recommendedMasterRecord: recommendedMaster,
      recommendedMasterId: recommendedMaster.id || '',
      recommendedSubordinate: recommendedMaster.id === left.id ? right : left,
      fieldScores: pair.fieldScores || {},
      exactIdentity: pair.exactIdentity,
      reasonCodes: pair.reasonCodes,
      reasons: pair.reasons,
      evidence,
      matchedEvidenceFields: evidence.filter((item) => item.status === 'matched').map((item) => item.field),
      conflictingEvidenceFields: evidence.filter((item) => item.status === 'conflict').map((item) => item.field),
      blankEvidenceFields: evidence.filter((item) => item.status === 'blank').map((item) => item.field)
    };
  });
  const document = {
    ledgerVersion: LEDGER_VERSION,
    generatedAt: metadata.generatedAt || new Date().toISOString(),
    source: { fileName: metadata.fileName || '', recordCount: records.length, skippedRecordCount: metadata.skippedRows?.length || 0, skippedRows: metadata.skippedRows || [], headers: metadata.headers || [] },
    ...SCORE_SEMANTICS,
    modelVersion: ledgerRecords.find((record) => record.modelVersion)?.modelVersion || SCORE_SEMANTICS.modelVersion,
    candidatePairCount: ledgerRecords.length,
    records: ledgerRecords
  };
  const summary = {
    summaryVersion: 'cross-currency-score-ledger-summary/v1',
    ledgerVersion: LEDGER_VERSION,
    generatedAt: document.generatedAt,
    source: document.source,
    modelVersion: document.modelVersion,
    candidatePairCount: document.candidatePairCount,
    pairColumns: ACCOUNT_PRESENTATION_COLUMNS,
    presentationVersion: PRESENTATION_VERSION,
    evidenceFields: evidenceColumns.map(([field, prefix]) => ({ field, csvPrefix: prefix }))
  };
  const richRows = ledgerRecords.map((item) => {
    const row = { pairKey: item.pairKey, leftId: item.left.id, leftCurrency: item.left.currency, rightId: item.right.id, rightCurrency: item.right.currency, score: item.score, scoreUnrounded: item.scoreUnrounded, weightedRawValue: item.weightedRawValue, weightedEffectiveValue: item.weightedEffectiveValue, fieldTreatments: JSON.stringify(item.fieldTreatments), band: item.band, ...SCORE_SEMANTICS, modelVersion: item.modelVersion, accountNameRelationship: item.accountNameRelationship, accountNameRelationshipReason: item.accountNameRelationshipReason, hierarchyRelationship: item.hierarchyRelationship, hierarchyEvidence: JSON.stringify(item.hierarchyEvidence), contradictionCategory: item.contradictionCategory, contradictionReason: item.contradictionReason, exactConfidenceRule: item.exactConfidenceRule, intermediateConfidenceRule: item.intermediateConfidenceRule, exactConfidenceEligible: item.exactConfidenceEligible, intermediateConfidenceEligible: item.intermediateConfidenceEligible, fieldScores: JSON.stringify(item.fieldScores), exactIdentity: item.exactIdentity, reasonCodes: item.reasonCodes.join(' | '), reasons: item.reasons.join(' | '), matchedEvidenceFields: item.matchedEvidenceFields.join(' | '), conflictingEvidenceFields: item.conflictingEvidenceFields.join(' | '), blankEvidenceFields: item.blankEvidenceFields.join(' | ') };
    RECOMMENDED_MASTER_FIELDS.forEach(([field, column]) => { row[column] = item.recommendedMaster?.[field] || ''; });
    item.evidence.forEach((evidence) => { const prefix = evidenceColumns.find(([field]) => field === evidence.field)?.[1] || evidence.field; row[`${prefix}Status`] = evidence.status; row[`${prefix}LeftRaw`] = evidence.left.raw; row[`${prefix}LeftNormalized`] = evidence.left.normalized; row[`${prefix}RightRaw`] = evidence.right.raw; row[`${prefix}RightNormalized`] = evidence.right.normalized; });
    return row;
  });
  const richColumns = LEDGER_COLUMNS;
  const rows = ledgerRecords.map((item) => {
    const master = item.recommendedMasterRecord;
    const subordinate = item.recommendedSubordinate;
    const statuses = item.evidence.map((evidence) => `${evidence.label}: ${evidence.status}`).join(' | ');
    const reasons = [...item.reasons, item.contradictionReason, item.accountNameRelationshipReason, item.hierarchyRelationship !== 'none' ? `Hierarchy: ${item.hierarchyRelationship}` : ''].filter(Boolean);
    return {
      recommendedMasterId: master.id || '', recommendedMasterName: master.name || '', recommendedMasterCurrency: master.currencyisocode || '', recommendedMasterWebsite: master.website || '', recommendedMasterPhone: master.phone || '', recommendedMasterAddress: accountAddress(master), recommendedMasterHierarchy: accountHierarchy(master),
      recommendedSubordinateId: subordinate.id || '', recommendedSubordinateName: rawField(subordinate, 'name'), recommendedSubordinateCurrency: rawField(subordinate, 'currencyisocode'), recommendedSubordinateWebsite: rawField(subordinate, 'website'), recommendedSubordinatePhone: rawField(subordinate, 'phone'), recommendedSubordinateAddress: accountAddress(subordinate), recommendedSubordinateHierarchy: accountHierarchy(subordinate),
      score: item.score, matchSummary: statuses, reviewReason: [...new Set(reasons)].join(' | ')
    };
  });
  const columns = ACCOUNT_PRESENTATION_COLUMNS;
  return {
    ...document,
    rows,
    columns,
    richRows,
    richColumns,
    get richCsv() { return toCsv(richRows, richColumns); },
    summary,
    get csvChunks() { return toCsvChunks(rows, columns); },
    get csv() { return this.csvChunks.join(''); },
    get json() { return JSON.stringify(document, null, 2); },
    get summaryJson() { return JSON.stringify(summary, null, 2); },
    presentationVersion: PRESENTATION_VERSION,
    version: LEDGER_VERSION
  };
}
