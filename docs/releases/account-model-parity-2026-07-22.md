# Account model parity release

Release note: updated Cross-Currency Account Reviewer to use the pinned Duplicate Reviewer Account model for cross-currency identity scoring, validated by named model regressions, `npm run check`, `npm run check:windows`, and Playwright smoke.

Currency difference remains an eligibility requirement and is not scored as identity evidence. The model version is recorded in score-ledger JSON, summary JSON, and CSV output.
