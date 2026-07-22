# Capability Specification

## Mature Account scoring

The app MUST score eligible cross-currency Account pairs with the pinned Duplicate Reviewer Account model, including fuzzy field similarity, evidence weighting, contradiction handling, hierarchy-aware name relationships, confidence caps, and confidence lanes.

The app MUST require usable `CurrencyIsoCode` values on both records and MUST exclude pairs whose currencies are equal. Unequal currencies MUST make a pair eligible for this lane but MUST NOT add identity-confidence points or create a currency contradiction within this lane.

The scorer MUST retain source IDs and raw values while emitting the visible belief score, operational score when applicable, confidence lane, field scores, reason taxonomy, name-relationship metadata, contradiction metadata, and confidence-rule metadata.

## Model parity

The public port MUST record the Duplicate Reviewer Account-model source version. A parity fixture suite MUST compare non-currency field scores, name relationships, contradiction categories, caps, reason taxonomy, and confidence semantics against the pinned source behavior.

Future Account-model updates MUST be applied through an explicit Cross-Currency sync release with updated parity fixtures and model-version metadata.

## Existing contracts

The existing CSV, proposal, export, launcher, and cross-platform contracts MUST remain valid. `LastModifiedDate` MUST remain excluded from scoring.
