function csvCell(value) { const text = String(value ?? ''); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
export function toCsv(rows, columns) { return [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n') + '\n'; }

const LEDGER_VERSION = 'cross-currency-score-ledger/v1';
const LEDGER_COLUMNS = [
  'pairKey', 'leftId', 'leftCurrency', 'rightId', 'rightCurrency', 'score', 'operationalScore', 'band', 'modelVersion', 'accountNameRelationship', 'accountNameRelationshipReason', 'contradictionCategory', 'contradictionReason', 'exactConfidenceRule', 'intermediateConfidenceRule', 'exactConfidenceEligible', 'intermediateConfidenceEligible', 'fieldScores', 'exactIdentity', 'reasonCodes', 'reasons', 'matchedEvidenceFields',
  'conflictingEvidenceFields', 'blankEvidenceFields',
  'nameStatus', 'nameLeftRaw', 'nameLeftNormalized', 'nameRightRaw', 'nameRightNormalized',
  'websiteStatus', 'websiteLeftRaw', 'websiteLeftNormalized', 'websiteRightRaw', 'websiteRightNormalized',
  'phoneStatus', 'phoneLeftRaw', 'phoneLeftNormalized', 'phoneRightRaw', 'phoneRightNormalized',
  'billingAddressStatus', 'billingAddressLeftRaw', 'billingAddressLeftNormalized', 'billingAddressRightRaw', 'billingAddressRightNormalized',
  'ultimateParentAccountStatus', 'ultimateParentAccountLeftRaw', 'ultimateParentAccountLeftNormalized', 'ultimateParentAccountRightRaw', 'ultimateParentAccountRightNormalized'
];
const evidenceColumns = [
  ['name', 'name'], ['website', 'website'], ['phone', 'phone'], ['address', 'billingAddress'], ['ultimate_parent_account__c', 'ultimateParentAccount']
];
const rawField = (record, field) => record.__raw?.[field] ?? record[field] ?? '';
const rawEvidence = (record, field) => field === 'address'
  ? ['billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry'].map((key) => rawField(record, key)).filter(Boolean).join(' | ')
  : rawField(record, field);

export function buildScoreLedger(pairs, records, metadata = {}) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const ledgerRecords = pairs.map((pair) => {
    const left = byId.get(pair.leftId) || {};
    const right = byId.get(pair.rightId) || {};
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
      score: pair.score,
      operationalScore: pair.operationalScore,
      band: pair.band,
      modelVersion: pair.modelVersion || '',
      accountNameRelationship: pair.accountNameRelationship || '',
      accountNameRelationshipReason: pair.accountNameRelationshipReason || '',
      contradictionCategory: pair.contradictionCategory || '',
      contradictionReason: pair.contradictionReason || '',
      exactConfidenceRule: pair.exactConfidenceRule || '',
      intermediateConfidenceRule: pair.intermediateConfidenceRule || '',
      exactConfidenceEligible: Boolean(pair.exactConfidenceEligible),
      intermediateConfidenceEligible: Boolean(pair.intermediateConfidenceEligible),
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
    source: { fileName: metadata.fileName || '', recordCount: records.length, headers: metadata.headers || [] },
    modelVersion: ledgerRecords.find((record) => record.modelVersion)?.modelVersion || '',
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
    pairColumns: LEDGER_COLUMNS,
    evidenceFields: evidenceColumns.map(([field, prefix]) => ({ field, csvPrefix: prefix }))
  };
  const rows = ledgerRecords.map((item) => {
    const row = {
      pairKey: item.pairKey, leftId: item.left.id, leftCurrency: item.left.currency, rightId: item.right.id, rightCurrency: item.right.currency,
      score: item.score, operationalScore: item.operationalScore, band: item.band, modelVersion: item.modelVersion,
      accountNameRelationship: item.accountNameRelationship, accountNameRelationshipReason: item.accountNameRelationshipReason,
      contradictionCategory: item.contradictionCategory, contradictionReason: item.contradictionReason,
      exactConfidenceRule: item.exactConfidenceRule, intermediateConfidenceRule: item.intermediateConfidenceRule,
      exactConfidenceEligible: item.exactConfidenceEligible, intermediateConfidenceEligible: item.intermediateConfidenceEligible,
      fieldScores: JSON.stringify(item.fieldScores), exactIdentity: item.exactIdentity,
      reasonCodes: item.reasonCodes.join(' | '), reasons: item.reasons.join(' | '), matchedEvidenceFields: item.matchedEvidenceFields.join(' | '),
      conflictingEvidenceFields: item.conflictingEvidenceFields.join(' | '), blankEvidenceFields: item.blankEvidenceFields.join(' | ')
    };
    item.evidence.forEach((evidence) => {
      const prefix = evidenceColumns.find(([field]) => field === evidence.field)?.[1] || evidence.field;
      row[`${prefix}Status`] = evidence.status;
      row[`${prefix}LeftRaw`] = evidence.left.raw; row[`${prefix}LeftNormalized`] = evidence.left.normalized;
      row[`${prefix}RightRaw`] = evidence.right.raw; row[`${prefix}RightNormalized`] = evidence.right.normalized;
    });
    return row;
  });
  const columns = LEDGER_COLUMNS;
  return { ...document, rows, columns, summary, csv: toCsv(rows, columns), json: JSON.stringify(document, null, 2), summaryJson: JSON.stringify(summary, null, 2), version: LEDGER_VERSION };
}

export function buildExports(reviewed) {
  const parents = reviewed.map((item) => {
    const row = { proposalVersion: item.proposal.proposalVersion, pairKey: item.proposal.pairKey, sourceAccountIds: item.proposal.sourceAccountIds.join(';'), parentCurrency: item.proposal.parentCurrency, score: item.proposal.score, reasons: item.proposal.reasons.join(' | ') };
    for (const [field, detail] of Object.entries(item.proposal.fields)) { row[field] = detail.value; row[`${field}Source`] = detail.sourceId; row[`${field}Overridden`] = detail.overridden ? 'true' : 'false'; }
    return row;
  });
  const associations = reviewed.flatMap((item) => item.proposal.sourceAccountIds.map((childId) => ({ proposalVersion: item.proposal.proposalVersion, pairKey: item.proposal.pairKey, parentProposalKey: item.proposal.pairKey, childAccountId: childId, score: item.proposal.score })));
  const audit = reviewed.map((item) => ({ exportedAt: new Date().toISOString(), pair: item.pair, proposal: item.proposal }));
  return { parents, associations, audit, parentCsv: toCsv(parents, Object.keys(parents[0] || { proposalVersion: '' })), associationCsv: toCsv(associations, ['proposalVersion', 'pairKey', 'parentProposalKey', 'childAccountId', 'score']), auditJson: JSON.stringify({ auditVersion: 'cross-currency-review-audit/v1', records: audit }, null, 2) };
}
