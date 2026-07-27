import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyScoreSemantics, validateScoreSemantics, CALIBRATED_ARTIFACT_VERSION } from '../core/score-semantics.js';
import { buildScoreLedger } from '../core/export.js';

test('named regression: Cross Currency scores declare legacy semantics until calibrated', () => {
  const metadata = legacyScoreSemantics({ objectType: 'account', surface: 'cross-currency-reviewer', modelVersion: 'duplicate-reviewer-account-model/2026-07-26-evidence-aware', populationDefinition: 'cross-currency candidates' });
  assert.equal(validateScoreSemantics(metadata).valid, true);
  assert.equal(validateScoreSemantics({ ...metadata, scoreSemantics: 'calibrated-match-probability' }, { allowLegacy: false }).valid, false);
  assert.equal(CALIBRATED_ARTIFACT_VERSION, 'cross-currency-score-ledger/v6');
});

test('named regression: Cross Currency ledger carries shared score semantics metadata', () => {
  const result = buildScoreLedger([{ leftId: 'A', rightId: 'B', score: 82, operationalScore: 82, evidence: [], reasonCodes: [], reasons: [], fieldScores: [] }], [{ id: 'A', currencyisocode: 'USD' }, { id: 'B', currencyisocode: 'EUR' }]);
  assert.equal(result.scoreSemantics, 'legacy-heuristic-score');
  assert.equal(result.rows[0].scoreContractVersion, 'match-probability/v1');
  assert.equal(result.rows[0].surface, 'cross-currency-reviewer');
});
