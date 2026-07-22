function csvCell(value) { const text = String(value ?? ''); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
export function toCsv(rows, columns) { return [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n') + '\n'; }

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
