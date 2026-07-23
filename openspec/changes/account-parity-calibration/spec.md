# Account Parity And Calibration Contract

The Cross Currency scorer MUST expose a versioned continuous Account score, typed evidence statuses, field scores, contradiction metadata, hierarchy/scope relationship, confidence-rule metadata, and deterministic pair ordering.

The parity matrix MUST classify each non-currency difference as `canonical-account`, `cross-currency-adapter`, or `duplicate-reviewer-only`. Currency is eligibility metadata: populated unequal currencies are eligible, equal or blank currencies are excluded, and changing one unequal currency pair to another MUST not change identity scoring.

Calibration sampling MUST accept explicit source export and scored-ledger paths, use a deterministic seed and required strata, record producer/model/adapter versions, and write raw adjudication output only to a caller-selected private path. The committed semantic corpus MUST contain opaque case identifiers, cohort metadata, model outputs, labels, confidence, deciding evidence, and disagreement notes only; it MUST contain no Salesforce IDs, raw values, private paths, or source snapshots.

Calibration reports MUST include required-stratum coverage, score-band and stratum rates, Brier score, calibration error, monotonicity violations, uncertainty/disagreement rates, and score movement when a previous model is supplied.
