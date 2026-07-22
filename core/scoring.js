import { REVIEW_FIELD_CATALOG, normalizeAddress, normalizePhone, normalizeText, normalizeWebsite } from './csv.js';

const CORROBORATORS = [
  ['website', normalizeWebsite],
  ['phone', normalizePhone],
  ['address', normalizeAddress],
  ['ultimate_parent_account__c', normalizeText]
];

export function comparableEvidence(left, right) {
  const evidence = [{ field: 'name', label: 'Account Name', left: normalizeText(left.name), right: normalizeText(right.name), required: true }];
  for (const [field, normalizer] of CORROBORATORS) {
    const leftValue = field === 'address' ? normalizer(left) : normalizer(left[field]);
    const rightValue = field === 'address' ? normalizer(right) : normalizer(right[field]);
    const catalog = REVIEW_FIELD_CATALOG.find((item) => item.key === field);
    evidence.push({ field, label: catalog?.label || field, left: leftValue, right: rightValue, required: false });
  }
  return evidence;
}

export function scorePair(left, right) {
  const currencyLeft = String(left.currencyisocode || '').toUpperCase();
  const currencyRight = String(right.currencyisocode || '').toUpperCase();
  const evidence = comparableEvidence(left, right).map((item) => ({ ...item, status: !item.left || !item.right ? 'blank' : item.left === item.right ? 'matched' : 'conflict' }));
  const currenciesDiffer = Boolean(currencyLeft && currencyRight && currencyLeft !== currencyRight);
  const name = evidence.find((item) => item.field === 'name');
  const corroborators = evidence.filter((item) => item.field !== 'name');
  const matchedCorroborators = corroborators.filter((item) => item.status === 'matched');
  const conflicts = evidence.filter((item) => item.status === 'conflict');
  const exactIdentity = Boolean(name.left && name.right && name.status === 'matched' && currenciesDiffer && conflicts.length === 0 && matchedCorroborators.length > 0);
  let score = 0;
  if (currenciesDiffer) score += 20;
  if (name.status === 'matched' && name.left) score += 55;
  score += Math.min(25, matchedCorroborators.length * 10);
  if (!currenciesDiffer) score = Math.min(score, 59);
  if (conflicts.length) score = Math.max(0, score - conflicts.length * 15);
  if (!name.left || !name.right) score = Math.min(score, 39);
  if (exactIdentity) score = 100;
  const band = score >= 95 ? 'exact-confidence' : score >= 70 ? 'weighted-review' : 'low-confidence';
  const reasonCodes = [];
  const reasons = [];
  if (exactIdentity) { reasonCodes.push('exact-cross-currency-identity'); reasons.push('Exact normalized identity; currency differs.'); }
  else {
    if (name.status === 'matched' && name.left) { reasonCodes.push('exact-name'); reasons.push('Exact normalized Account Name.'); }
    if (matchedCorroborators.length) { reasonCodes.push('corroborating-evidence'); reasons.push(`${matchedCorroborators.length} corroborating field${matchedCorroborators.length === 1 ? '' : 's'} match.`); }
    if (currenciesDiffer) { reasonCodes.push('currency-differs'); reasons.push(`Currency differs: ${currencyLeft} vs ${currencyRight}.`); }
    else { reasonCodes.push('currency-not-cross-currency'); reasons.push('Pair is not in the cross-currency lane.'); }
    if (conflicts.length) { reasonCodes.push('conflicting-evidence'); reasons.push(`Conflicting evidence: ${conflicts.map((item) => item.label).join(', ')}.`); }
    if (!matchedCorroborators.length) { reasonCodes.push('missing-corroboration'); reasons.push('No corroborating identity field is available.'); }
    if (!name.left || !name.right) { reasonCodes.push('missing-name'); reasons.push('Account Name is missing on one side.'); }
  }
  return { leftId: left.id, rightId: right.id, score, band, currenciesDiffer, currencyLeft, currencyRight, exactIdentity, evidence, reasonCodes, reasons };
}

export function generatePairs(records) {
  const blocks = new Map();
  records.forEach((record) => {
    const key = normalizeText(record.name).slice(0, 32) || `row-${record.__row}`;
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(record);
  });
  const pairs = [];
  for (const block of blocks.values()) for (let i = 0; i < block.length; i += 1) for (let j = i + 1; j < block.length; j += 1) {
    if (!block[i].currencyisocode || !block[j].currencyisocode || block[i].currencyisocode.toUpperCase() === block[j].currencyisocode.toUpperCase()) continue;
    const ordered = [block[i], block[j]].sort((left, right) => String(left.id).localeCompare(String(right.id)));
    pairs.push(scorePair(ordered[0], ordered[1]));
  }
  return pairs.sort((a, b) => b.score - a.score || `${a.leftId}|${a.rightId}`.localeCompare(`${b.leftId}|${b.rightId}`));
}
