const RECOMMENDED_MASTER_FIELDS = ['name', 'website', 'phone', 'billingstreet', 'billingcity', 'billingstate', 'billingpostalcode', 'billingcountry', 'ultimate_parent_account__c'];

function quality(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  return Math.min(100, 20 + text.length + (/[A-Za-z]/.test(text) ? 10 : 0));
}

function buildDefaultFields(left, right) {
  const fields = {};
  for (const field of RECOMMENDED_MASTER_FIELDS) {
    const candidates = [left, right].map((record) => ({ sourceId: record.id, score: quality(record[field]) })).filter((candidate) => candidate.score);
    candidates.sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId));
    fields[field] = candidates[0] || { sourceId: '', score: 0 };
  }
  return fields;
}

export function selectRecommendedMaster(left, right) {
  const defaults = buildDefaultFields(left, right);
  return [left, right].sort((a, b) => {
    const acceptedDiff = RECOMMENDED_MASTER_FIELDS.reduce((count, field) => count + (defaults[field].sourceId === b.id ? 1 : 0), 0)
      - RECOMMENDED_MASTER_FIELDS.reduce((count, field) => count + (defaults[field].sourceId === a.id ? 1 : 0), 0);
    if (acceptedDiff !== 0) return acceptedDiff;
    const populatedDiff = RECOMMENDED_MASTER_FIELDS.reduce((count, field) => count + (String(b[field] ?? '').trim() ? 1 : 0), 0)
      - RECOMMENDED_MASTER_FIELDS.reduce((count, field) => count + (String(a[field] ?? '').trim() ? 1 : 0), 0);
    if (populatedDiff !== 0) return populatedDiff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  })[0];
}
