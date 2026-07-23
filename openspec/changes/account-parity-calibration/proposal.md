# Account Parity And Dynamic Cross-Currency Calibration

## Goal

Keep the Cross Currency Account scorer semantically aligned with the pinned Duplicate Reviewer Account model while keeping currency eligibility and proposal/export behavior local to this app.

## Scope

- Document the parity matrix and disposition of model differences.
- Add deterministic, production-artifact-driven calibration sampling with private raw output and privacy-safe semantic output.
- Preserve continuous Account scores, typed invalid-vs-blank semantics, unequal-currency eligibility, and existing ledger/proposal/export contracts.
- Keep Contact behavior and Duplicate Reviewer operational workflows out of this repository.

## Non-goals

No runtime import of Duplicate Reviewer, no Salesforce IDs or raw production values in committed fixtures, and no merge-queue or Contact behavior.
