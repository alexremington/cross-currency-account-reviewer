# Capability Specification

The Outputs section MUST expose exactly two ledger downloads: the lean `score-ledger.csv` and the metadata/column-definition `score-ledger-summary.json`.

The app MUST NOT render or advertise a full-ledger JSON download control. The internal `cross-currency-score-ledger/v2` JSON representation MAY remain available to core callers and MUST retain its existing contract.

The Playwright smoke MUST verify both visible output controls and MUST fail if a full-ledger JSON button is rendered.
