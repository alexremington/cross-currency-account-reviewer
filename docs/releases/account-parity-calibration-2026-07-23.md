# Account parity calibration release — 2026-07-23

Release note: aligned Cross Currency Account scoring with canonical sparse-name, address, hierarchy/scope, alias, and structured partial-phone semantics, validated by unit, structural, Windows-contract, result-sanity, and Playwright UI smoke checks.

Evidence:

- Cross Currency remains an independent runtime implementation with currency eligibility, proposal, ledger, export, and launcher contracts unchanged.
- Named regressions cover Science!/SCIENCE PO, country-only and sparse address evidence, aliases, hierarchy expansion, partial/genuine/area-only phone evidence, currency invariance, and Contact isolation.
- The production-derived labeled calibration corpus is not present in the checkout, so calibration metrics were not fabricated.

Residual risk: aggregate score-band movement requires the private labeled calibration corpus; launcher smoke could not bootstrap a temporary macOS launchctl domain because the host returned I/O error 5.
