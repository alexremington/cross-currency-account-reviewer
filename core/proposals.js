const PARENT_FIELDS = ['name', 'website', 'phone', 'billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry', 'ultimate_parent_account__c'];

function quality(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  return Math.min(100, 20 + text.length + (/[A-Za-z]/.test(text) ? 10 : 0));
}

function buildDefaultFields(left, right) {
  const fields = {};
  for (const field of PARENT_FIELDS) {
    const candidates = [left, right].map((record) => ({ value: String(record[field] ?? '').trim(), sourceId: record.id, score: quality(record[field]) })).filter((candidate) => candidate.value);
    candidates.sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId));
    fields[field] = { selected: candidates[0] || { value: '', sourceId: '', score: 0 }, candidates };
  }
  return fields;
}

export function selectRecommendedMaster(left, right) {
  const defaults = buildDefaultFields(left, right);
  return [left, right].sort((a, b) => {
    const acceptedDiff = PARENT_FIELDS.reduce((count, field) => count + (defaults[field].selected.sourceId === b.id ? 1 : 0), 0)
      - PARENT_FIELDS.reduce((count, field) => count + (defaults[field].selected.sourceId === a.id ? 1 : 0), 0);
    if (acceptedDiff !== 0) return acceptedDiff;
    const populatedDiff = PARENT_FIELDS.reduce((count, field) => count + (String(b[field] ?? '').trim() ? 1 : 0), 0)
      - PARENT_FIELDS.reduce((count, field) => count + (String(a[field] ?? '').trim() ? 1 : 0), 0);
    if (populatedDiff !== 0) return populatedDiff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  })[0];
}

export function buildProposal(left, right, pair, overrides = {}) {
  const fields = {};
  const defaults = buildDefaultFields(left, right);
  for (const field of PARENT_FIELDS) {
    const { selected, candidates } = defaults[field];
    const override = overrides[field];
    if (override && !String(override.reason || '').trim()) throw new Error(`${field} override requires a reason.`);
    fields[field] = { value: override?.value ?? selected.value, sourceId: override ? 'manual-override' : selected.sourceId, defaultValue: selected.value, overridden: Boolean(override), overrideReason: override?.reason || '', candidates };
  }
  return { proposalVersion: 'cross-currency-parent/v1', pairKey: `${pair.leftId}|${pair.rightId}`, sourceAccountIds: [left.id, right.id], recommendedMasterId: selectRecommendedMaster(left, right).id, parentCurrency: overrides.parentCurrency || '', score: pair.score, reasons: pair.reasons, reasonCodes: pair.reasonCodes, fields };
}
