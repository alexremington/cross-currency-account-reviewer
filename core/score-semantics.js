export const SCORE_CONTRACT_VERSION = 'match-probability/v1';
export const LEGACY_HEURISTIC_SCORE_SEMANTICS = 'legacy-heuristic-score';
export const CALIBRATED_MATCH_PROBABILITY_SEMANTICS = 'calibrated-match-probability';
export const CALIBRATED_ARTIFACT_VERSION = 'cross-currency-score-ledger/v6';

export function legacyScoreSemantics({ objectType, surface, modelVersion, populationDefinition }) {
  return { scoreContractVersion: SCORE_CONTRACT_VERSION, scoreSemantics: LEGACY_HEURISTIC_SCORE_SEMANTICS, objectType, surface, populationDefinition, modelVersion };
}

export function validateScoreSemantics(metadata, { allowLegacy = true } = {}) {
  const errors = [];
  const value = metadata || {};
  const semantics = String(value.scoreSemantics || '');
  if (value.scoreContractVersion !== SCORE_CONTRACT_VERSION) errors.push(`scoreContractVersion must be ${SCORE_CONTRACT_VERSION}`);
  if (![LEGACY_HEURISTIC_SCORE_SEMANTICS, CALIBRATED_MATCH_PROBABILITY_SEMANTICS].includes(semantics)) errors.push('scoreSemantics is unsupported');
  if (!allowLegacy && semantics === LEGACY_HEURISTIC_SCORE_SEMANTICS) errors.push('legacy heuristic score is not permitted');
  for (const field of ['objectType', 'surface', 'populationDefinition', 'modelVersion']) if (!String(value[field] || '').trim()) errors.push(`${field} is required`);
  if (semantics === CALIBRATED_MATCH_PROBABILITY_SEMANTICS) {
    const probability = Number(value.probability); const percent = Number(value.probabilityPercent);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) errors.push('probability must be bounded');
    if (!Number.isFinite(percent) || percent < 0 || percent > 100 || Math.abs(probability * 100 - percent) > 0.000001) errors.push('probabilityPercent must agree with probability');
    if (!String(value.calibrationVersion || '').trim()) errors.push('calibrationVersion is required');
    if (!Number.isInteger(Number(value.labelCount)) || Number(value.labelCount) < 1) errors.push('labelCount is required');
  }
  return { valid: errors.length === 0, errors };
}
