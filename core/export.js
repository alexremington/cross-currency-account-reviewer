function csvCell(value) { const text = String(value ?? ''); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
export function toCsv(rows, columns) { return [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n') + '\n'; }

const LEDGER_VERSION = 'cross-currency-score-ledger/v1';
const LEDGER_COLUMNS = [
  'ledgerVersion', 'generatedAt', 'sourceFileName', 'sourceRecordCount', 'candidatePairCount', 'pairKey',
  'leftId', 'leftSourceRow', 'leftNameRaw', 'leftCurrencyRaw', 'rightId', 'rightSourceRow', 'rightNameRaw', 'rightCurrencyRaw',
  'currenciesDiffer', 'score', 'band', 'exactIdentity', 'reasonCodes', 'reasons', 'matchedEvidenceFields',
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
      left: { id: pair.leftId, sourceRow: left.__row ?? null, name: rawField(left, 'name'), currency: rawField(left, 'currencyisocode') },
      right: { id: pair.rightId, sourceRow: right.__row ?? null, name: rawField(right, 'name'), currency: rawField(right, 'currencyisocode') },
      currenciesDiffer: pair.currenciesDiffer,
      score: pair.score,
      band: pair.band,
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
    candidatePairCount: ledgerRecords.length,
    records: ledgerRecords
  };
  const rows = ledgerRecords.map((item) => {
    const row = {
      ledgerVersion: LEDGER_VERSION, generatedAt: document.generatedAt, sourceFileName: document.source.fileName,
      sourceRecordCount: document.source.recordCount, candidatePairCount: document.candidatePairCount, pairKey: item.pairKey,
      leftId: item.left.id, leftSourceRow: item.left.sourceRow, leftNameRaw: item.left.name, leftCurrencyRaw: item.left.currency,
      rightId: item.right.id, rightSourceRow: item.right.sourceRow, rightNameRaw: item.right.name, rightCurrencyRaw: item.right.currency,
      currenciesDiffer: item.currenciesDiffer, score: item.score, band: item.band, exactIdentity: item.exactIdentity,
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
  return { ...document, rows, columns, csv: toCsv(rows, columns), json: JSON.stringify(document, null, 2), version: LEDGER_VERSION };
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
