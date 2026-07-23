import { normalizeAddress, normalizePhone, normalizeText, normalizeWebsite } from './csv.js';

// Pinned from Duplicate Reviewer Account model: recalibrate-account-scoring-model
// plus account-three-lane-score-distribution and account-hierarchy-aware-top-lane.
export const ACCOUNT_MODEL_VERSION = 'duplicate-reviewer-account-model/2026-07-22-continuous-score';
export const MAX_CROSS_CURRENCY_CANDIDATE_PAIRS = 250000;

const FIELD_WEIGHTS = {
  accountCurrency: 28,
  name: 22,
  ultimateParentAccount: 15,
  website: 14,
  billingStreet: 12,
  billingPostalCode: 3,
  billingCity: 2,
  phone: 2,
  billingState: 1,
  billingCountry: 1
};

const POSITIVE_FACTORS = {
  accountCurrency: 0.15,
  billingCountry: 0.2,
  billingState: 0.25,
  billingCity: 0.45,
  phone: 0.45,
  ultimateParentAccount: 0.35,
  website: 0.45,
  billingPostalCode: 0.75,
  billingStreet: 0.85
};

const CONTRADICTION_SEVERITY = {
  accountCurrency: 1,
  name: 1,
  ultimateParentAccount: 1,
  website: 1,
  billingStreet: 0.75,
  billingPostalCode: 0.35,
  billingCity: 0.25,
  phone: 0.2,
  billingState: 0.15,
  billingCountry: 0.15
};

const HIERARCHY_TOKENS = new Set([
  'branch', 'chapter', 'department', 'division', 'east', 'global', 'international',
  'local', 'national', 'north', 'regional', 'south', 'unit', 'west'
]);

const SCOPE_TOKENS = new Set(['foundation', 'fund', 'holding', 'holdings', 'llc', 'ltd', 'plc', 'trust']);
const PLACEHOLDER_VALUES = new Set(['-', '--', '---', 'n a', 'na', 'none', 'null', 'unknown', 'not available']);

const EXACT_RULE_SCORES = {
  'exact-name-website-address-phone': 100,
  'exact-name-website-address-ultimate-parent-evidence': 99,
  'exact-name-website-address': 98,
  'exact-name-website-phone': 97,
  'exact-name-address-phone': 96,
  'exact-name-website-ultimate-parent-evidence': 96,
  'exact-name-address-ultimate-parent-evidence': 95,
  'exact-name-website': 95,
  'exact-name-address': 95,
  'exact-name-phone': 95
};

const INTERMEDIATE_RULE_SCORES = {
  'near-name-website-address': 94,
  'near-name-website-phone': 93,
  'exact-name-only': 90
};

function clamp(value) { return Math.max(0, Math.min(100, Math.round(value))); }
function tokens(value) { return normalizeText(value).split(' ').filter(Boolean); }
function tokenSet(value) { return new Set(tokens(value)); }
function meaningful(value) {
  const normalized = normalizeText(value);
  return Boolean(normalized && !PLACEHOLDER_VALUES.has(normalized));
}
function overlap(left, right) {
  if (!left.length || !right.length) return 0;
  const a = new Set(left); const b = new Set(right);
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

function similarity(left, right) {
  if (!meaningful(left) || !meaningful(right)) return null;
  const a = normalizeText(left); const b = normalizeText(right);
  if (a === b) return 1;
  const tokenScore = overlap(a.split(' '), b.split(' '));
  const compactA = a.replaceAll(' ', ''); const compactB = b.replaceAll(' ', '');
  const prefix = compactA.startsWith(compactB) || compactB.startsWith(compactA) ? 0.96 : 0;
  const edit = normalizedEditSimilarity(compactA, compactB);
  return Math.max(tokenScore, prefix, edit);
}

function normalizedEditSimilarity(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length, 1);
}

function exactValue(left, right) {
  if (!meaningful(left) || !meaningful(right)) return null;
  return normalizeText(left) === normalizeText(right) ? 1 : 0;
}

function websiteScore(left, right) {
  if (!meaningful(left) || !meaningful(right)) return null;
  return normalizeWebsite(left) === normalizeWebsite(right) ? 1 : similarity(left, right);
}

function phoneScore(left, right) {
  if (!left || !right) return null;
  const a = normalizePhone(left); const b = normalizePhone(right);
  if (!a || !b) return null;
  return a === b || a.endsWith(b) || b.endsWith(a) ? 1 : 0;
}

function validateWebsite(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { status: 'blank', value: '', raw: '', reason: '' };
  if (/^(?:0|n\/a|na|none|null|unknown|no website found|not available)$/i.test(value)) return { status: 'invalid', value: '', raw: value, reason: 'website is a sentinel or unavailable value' };
  if (/[\s@]/.test(value) || /^\+?[\d().\s-]{7,}$/.test(value)) return { status: 'invalid', value: '', raw: value, reason: 'website-like value is phone-like or email-like' };
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (hostname === '0.0.0.0' || !hostname.includes('.') || !/^[a-z0-9.-]+$/i.test(hostname) || hostname.startsWith('.') || hostname.endsWith('.')) return { status: 'invalid', value: '', raw: value, reason: 'website has no valid hostname' };
    return { status: 'valid', value: hostname, raw: value, reason: '' };
  } catch {
    return { status: 'invalid', value: '', raw: value, reason: 'website is not a valid URL or hostname' };
  }
}

function validatePhone(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { status: 'blank', value: '', raw: '', reason: '' };
  if (/[a-z@/]/i.test(value)) return { status: 'invalid', value: '', raw: value, reason: 'phone contains letters, email syntax, or URL syntax' };
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || /[^\d\s().+\-extx]/i.test(value)) return { status: 'invalid', value: '', raw: value, reason: 'phone has invalid digit length or characters' };
  return { status: 'valid', value: normalizePhone(value), raw: value, reason: '' };
}

function addressScore(left, right) {
  const score = similarity(left, right);
  return score == null ? null : score;
}

function accountNameRelationship(nameScore, left, right) {
  if (!meaningful(left.name) || !meaningful(right.name)) return { kind: 'missing-name', reason: 'Missing usable account name.' };
  const leftTokens = tokenSet(left.name); const rightTokens = tokenSet(right.name);
  if (nameScore === 1) return { kind: 'same-level-exact', reason: 'Exact normalized account name.' };
  const shorter = leftTokens.size <= rightTokens.size ? leftTokens : rightTokens;
  const longer = leftTokens.size <= rightTokens.size ? rightTokens : leftTokens;
  const extra = [...longer].filter((item) => !shorter.has(item));
  if (nameScore >= 0.95 && extra.some((item) => HIERARCHY_TOKENS.has(item))) {
    return { kind: 'hierarchy-expansion', reason: `Hierarchy-bearing name expansion: ${extra.join(', ')}.` };
  }
  if (nameScore >= 0.95) return { kind: 'same-level-equivalent', reason: 'Near-exact same-level account names.' };
  if (extra.some((item) => SCOPE_TOKENS.has(item))) return { kind: 'scope-divergence', reason: 'Account names indicate different organizational scope.' };
  return { kind: 'unknown-near-name', reason: '' };
}

function adapt(record) {
  const websiteEvidence = validateWebsite(record.website);
  const phoneEvidence = validatePhone(record.phone);
  return {
    ...record,
    name: record.name || '',
    rawWebsite: String(record.website ?? ''),
    rawPhone: String(record.phone ?? ''),
    website: websiteEvidence.status === 'valid' ? websiteEvidence.value : '',
    phone: phoneEvidence.status === 'valid' ? phoneEvidence.value : '',
    websiteEvidence,
    phoneEvidence,
    billingStreet: record.billingstreet || '',
    billingCity: record.billingcity || '',
    billingState: record.billingstate || '',
    billingPostalCode: record.billingpostalcode || '',
    billingCountry: record.billingcountry || '',
    accountCurrency: record.currencyisocode || '',
    ultimateParentAccount: record.ultimate_parent_account__c || ''
  };
}

function fieldScores(left, right) {
  return {
    name: similarity(left.name, right.name),
    website: websiteScore(left.website, right.website),
    phone: phoneScore(left.phone, right.phone),
    billingStreet: addressScore(left.billingStreet, right.billingStreet),
    billingCity: similarity(left.billingCity, right.billingCity),
    billingState: exactValue(left.billingState, right.billingState),
    billingPostalCode: exactValue(left.billingPostalCode, right.billingPostalCode),
    billingCountry: exactValue(left.billingCountry, right.billingCountry),
    accountCurrency: exactValue(left.accountCurrency, right.accountCurrency),
    ultimateParentAccount: similarity(left.ultimateParentAccount, right.ultimateParentAccount)
  };
}

function billingAddressScore(scores) {
  const fields = ['billingStreet', 'billingCity', 'billingState', 'billingPostalCode', 'billingCountry'];
  const values = fields.map((field) => scores[field]).filter((value) => value != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function weightedScore(scores, left, right) {
  if (scores.name == null) return { value: 0, discounted: false, nameRelationship: accountNameRelationship(scores.name, left, right) };
  const entries = Object.entries(FIELD_WEIGHTS).filter(([field]) => scores[field] != null);
  if (!entries.length) return { value: 0, discounted: false };
  let numerator = 0; let denominator = 0; let discounted = false;
  for (const [field, weight] of entries) {
    const factor = field === 'name' ? 1 : (scores[field] >= 1 ? 1 : POSITIVE_FACTORS[field] || 1);
    if (factor < 1) discounted = true;
    numerator += scores[field] * weight * factor;
    denominator += weight * factor;
  }
  let value = denominator ? (numerator / denominator) * 100 : 0;
  const conflicts = Object.entries(scores).filter(([field, score]) => score != null && score < 0.9 && field !== 'accountCurrency');
  for (const [field] of conflicts) value -= 12 * (CONTRADICTION_SEVERITY[field] || 0.15);
  const nameRelationship = accountNameRelationship(scores.name || 0, left, right);
  if (nameRelationship.kind === 'hierarchy-expansion') value = Math.min(value, 83);
  if (nameRelationship.kind === 'scope-divergence') value = Math.min(value, 78);
  const hasCorroboration = [scores.website, scores.phone, billingAddressScore(scores), scores.ultimateParentAccount].some((score) => score != null && score >= 0.9);
  if ((scores.name || 0) >= 0.95 && !hasCorroboration) value = Math.min(value, 89);
  return { value: clamp(value), discounted, nameRelationship };
}

function exactRule(scores, relationship) {
  if (!['same-level-exact', 'same-level-equivalent'].includes(relationship.kind) || scores.name !== 1) return '';
  const address = billingAddressScore(scores) >= 0.9;
  const websiteConflictAllowed = scores.website != null && scores.website < 0.9 && address && scores.phone === 1;
  if (Object.entries(scores).some(([field, score]) => field !== 'accountCurrency' && field !== 'name' && score != null && score < 0.9 && !(field === 'website' && websiteConflictAllowed))) return '';
  if (scores.website === 1 && address && scores.phone === 1) return 'exact-name-website-address-phone';
  if (scores.website === 1 && address && scores.ultimateParentAccount === 1) return 'exact-name-website-address-ultimate-parent-evidence';
  if (scores.website === 1 && address) return 'exact-name-website-address';
  if (scores.website === 1 && scores.phone === 1) return 'exact-name-website-phone';
  if (address && scores.phone === 1) return 'exact-name-address-phone';
  if (scores.website === 1 && scores.ultimateParentAccount === 1) return 'exact-name-website-ultimate-parent-evidence';
  if (address && scores.ultimateParentAccount === 1) return 'exact-name-address-ultimate-parent-evidence';
  if (scores.website === 1) return 'exact-name-website';
  if (address) return 'exact-name-address';
  if (scores.phone === 1) return 'exact-name-phone';
  return '';
}

function intermediateRule(scores, relationship) {
  if (Object.entries(scores).some(([field, score]) => field !== 'accountCurrency' && field !== 'name' && score != null && score < 0.9)) return '';
  const address = billingAddressScore(scores) >= 0.82;
  if (scores.name === 1) return 'exact-name-only';
  if (relationship.kind === 'same-level-equivalent' && scores.name >= 0.95 && scores.website === 1 && address) return 'near-name-website-address';
  if (relationship.kind === 'same-level-equivalent' && scores.name >= 0.95 && scores.website === 1 && scores.phone === 1) return 'near-name-website-phone';
  return '';
}

function evidence(left, right, scores) {
  const values = [
    ['name', 'Account Name', left.name, right.name, scores.name],
    ['website', 'Website', left.rawWebsite, right.rawWebsite, scores.website, left.websiteEvidence, right.websiteEvidence],
    ['phone', 'Phone', left.rawPhone, right.rawPhone, scores.phone, left.phoneEvidence, right.phoneEvidence],
    ['address', 'Billing address', normalizeAddress(left), normalizeAddress(right), billingAddressScore(scores)],
    ['ultimate_parent_account__c', 'Ultimate Parent Account', left.ultimate_parent_account__c, right.ultimate_parent_account__c, scores.ultimateParentAccount]
  ];
  return values.map(([field, label, rawLeft, rawRight, score, leftEvidence, rightEvidence]) => ({
    field, label, left: normalizeText(rawLeft), right: normalizeText(rawRight),
    status: leftEvidence || rightEvidence
      ? (leftEvidence.status === 'invalid' || rightEvidence.status === 'invalid' ? 'invalid' : leftEvidence.status !== 'valid' || rightEvidence.status !== 'valid' ? 'blank' : score === 1 ? 'matched' : 'conflict')
      : (!rawLeft || !rawRight ? 'blank' : score >= 0.9 ? 'matched' : 'conflict'),
    score, leftRaw: String(rawLeft ?? ''), rightRaw: String(rawRight ?? ''),
    leftInvalidReason: leftEvidence?.reason || '', rightInvalidReason: rightEvidence?.reason || ''
  }));
}

export function scoreCrossCurrencyPair(leftRecord, rightRecord) {
  const left = adapt(leftRecord); const right = adapt(rightRecord);
  const currencyLeft = String(left.accountCurrency).toUpperCase();
  const currencyRight = String(right.accountCurrency).toUpperCase();
  const currenciesDiffer = Boolean(currencyLeft && currencyRight && currencyLeft !== currencyRight);
  if (!currenciesDiffer) {
    return {
      leftId: left.id, rightId: right.id, score: 0, value: 0, operationalScore: 0,
      band: 'low-confidence', lane: 'low-confidence', exactIdentity: false,
      currenciesDiffer: false, currencyLeft, currencyRight, modelVersion: ACCOUNT_MODEL_VERSION,
      fieldScores: {}, accountNameRelationship: 'not-cross-currency', accountNameRelationshipReason: '',
      exactConfidenceRule: '', intermediateConfidenceRule: '', exactConfidenceEligible: false,
      intermediateConfidenceEligible: false, sharedTaxonomy: { relationship: 'not-cross-currency', promoted: false },
      evidence: [], reasonCodes: ['currency-not-cross-currency'], reasons: ['Pair is not in the cross-currency lane.']
    };
  }

  const scores = fieldScores(left, right);
  // Currency is eligibility-only in this adapter. Do not let its exact-value
  // score influence the identity model for this dedicated lane.
  scores.accountCurrency = null;
  const weighted = weightedScore(scores, left, right);
  const relationship = weighted.nameRelationship || accountNameRelationship(scores.name || 0, left, right);
  const exactConfidenceRule = exactRule(scores, relationship);
  const intermediateConfidenceRule = exactConfidenceRule ? '' : intermediateRule(scores, relationship);
  const lane = exactConfidenceRule ? 'exact-confidence' : intermediateConfidenceRule ? 'intermediate-confidence' : 'weighted-review';
  const canonicalScore = weighted.value;
  const exactIdentity = Boolean(exactConfidenceRule);
  const hasConflict = Object.entries(scores).some(([field, score]) => field !== 'accountCurrency' && score != null && score < 0.9);
  const contradictionCategory = hasConflict ? 'field-conflict' : '';
  const reasons = [];
  if (scores.name === 1) reasons.push('Exact account name');
  else if ((scores.name || 0) >= 0.88) reasons.push('Near-exact account name');
  if (scores.website === 1) reasons.push('Exact website');
  if (scores.phone === 1) reasons.push('Exact phone');
  if (billingAddressScore(scores) >= 0.9) reasons.push('Aligned billing address');
  if (scores.ultimateParentAccount === 1) reasons.push('Matching ultimate parent account');
  if (relationship.reason) reasons.push(relationship.reason);
  if (weighted.discounted) reasons.push('Common shared fields discounted');
  if (relationship.kind === 'scope-divergence') reasons.push('Different account scope');
  if (relationship.kind === 'hierarchy-expansion') reasons.push('Different branch or department under parent');
  if (lane === 'weighted-review') reasons.push('Missing exact-confidence corroboration bundle');
  if (left.websiteEvidence.status === 'invalid' || right.websiteEvidence.status === 'invalid') reasons.push('Website ignored as invalid');
  if (left.phoneEvidence.status === 'invalid' || right.phoneEvidence.status === 'invalid') reasons.push('Phone ignored as invalid');
  reasons.push(`Cross-currency eligibility: ${currencyLeft} vs ${currencyRight}`);
  return {
    leftId: left.id, rightId: right.id, score: canonicalScore, value: canonicalScore, operationalScore: canonicalScore,
    band: lane, lane, exactIdentity, currenciesDiffer, currencyLeft, currencyRight,
    modelVersion: ACCOUNT_MODEL_VERSION, fieldScores: scores, accountNameRelationship: relationship.kind,
    accountNameRelationshipReason: relationship.reason, contradictionCategory, contradictionReason: hasConflict ? 'One or more comparable identity fields conflict.' : '', exactConfidenceRule, intermediateConfidenceRule,
    exactConfidenceEligible: Boolean(exactConfidenceRule), intermediateConfidenceEligible: Boolean(intermediateConfidenceRule),
    sharedTaxonomy: { relationship: relationship.kind, promoted: lane !== 'weighted-review' },
    evidence: evidence(left, right, scores), reasonCodes: [
      exactIdentity ? 'exact-cross-currency-identity' : lane === 'intermediate-confidence' ? 'intermediate-cross-currency-match' : 'weighted-cross-currency-review',
      relationship.kind, 'currency-differs', ...(hasConflict ? ['conflicting-evidence'] : [])
    ], reasons
  };
}

function blockingKeys(record) {
  const name = normalizeText(record.name);
  const websiteEvidence = validateWebsite(record.website);
  const phoneEvidence = validatePhone(record.phone);
  const website = websiteEvidence.status === 'valid' ? websiteEvidence.value : '';
  const phone = phoneEvidence.status === 'valid' ? phoneEvidence.value : '';
  const address = normalizeAddress(record);
  const parent = normalizeText(record.ultimate_parent_account__c);
  const addressParts = [record.billingstreet, record.billingcity, record.billingstate, record.billingpostalcode].filter(meaningful);
  return [
    meaningful(record.name) && `name:${name.split(' ').slice(0, 3).join(' ')}`,
    meaningful(record.name) && `name-prefix:${name.slice(0, 12)}`,
    meaningful(website) && `website:${website}`,
    phone.length >= 7 && `phone:${phone.slice(-7)}`,
    address && addressParts.length > 0 && `address:${address.slice(0, 24)}`,
    meaningful(parent) && `parent:${parent}`
  ].filter(Boolean);
}

export function generateCrossCurrencyPairs(records) {
  const blocks = new Map();
  records.forEach((record, index) => blockingKeys(record).forEach((key) => {
    if (!blocks.has(key)) blocks.set(key, new Set());
    blocks.get(key).add(index);
  }));
  const keys = new Set();
  let candidateCapHit = false;
  for (const indexes of blocks.values()) {
    const values = [...indexes];
    for (let i = 0; i < values.length; i += 1) for (let j = i + 1; j < values.length; j += 1) {
      const left = records[values[i]]; const right = records[values[j]];
      const currenciesDiffer = left.currencyisocode && right.currencyisocode && String(left.currencyisocode).toUpperCase() !== String(right.currencyisocode).toUpperCase();
      if (currenciesDiffer) {
        if (keys.size >= MAX_CROSS_CURRENCY_CANDIDATE_PAIRS) {
          candidateCapHit = true;
          break;
        }
        keys.add([values[i], values[j]].sort((a, b) => a - b).join('|'));
        if (keys.size >= MAX_CROSS_CURRENCY_CANDIDATE_PAIRS) {
          candidateCapHit = true;
          break;
        }
      }
    }
    if (candidateCapHit) break;
  }
  const pairs = [...keys].map((key) => {
    const [leftIndex, rightIndex] = key.split('|').map(Number);
    const [left, right] = [records[leftIndex], records[rightIndex]].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return scoreCrossCurrencyPair(left, right);
  }).filter(Boolean).sort((a, b) => b.operationalScore - a.operationalScore || b.score - a.score || `${a.leftId}|${a.rightId}`.localeCompare(`${b.leftId}|${b.rightId}`));
  pairs.candidateStats = {
    candidatePairs: pairs.length,
    candidateCap: MAX_CROSS_CURRENCY_CANDIDATE_PAIRS,
    candidateCapHit
  };
  return pairs;
}
