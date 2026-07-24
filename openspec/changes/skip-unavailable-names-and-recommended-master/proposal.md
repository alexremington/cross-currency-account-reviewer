# Skip Unavailable Account Names And Export Recommended Masters

## Goal

Allow Salesforce Account exports with unavailable Account Name values to continue through matching, and make the deterministic recommended master record available in score-ledger outputs.

## Scope

- Skip rows whose Account Name is empty or matches the existing unavailable-value rules.
- Keep all other CSV/header/ID/currency validation blocking.
- Report skipped rows non-blockingly with count, source row, ID, and reason.
- Add Duplicate Reviewer-style recommended-master record columns to the score ledger CSV and JSON.
- Preserve existing pair scoring, proposal values, and Cross Currency eligibility semantics.

## Decisions

- The existing `normalizeComparableInput()` sentinel policy defines unavailable names.
- A recommended master is the pair record that supplies the most deterministic proposed field values, then the most populated display fields, then the lexicographically lowest ID.
- Skipped rows are excluded from matching and scored-pair source records but remain in import/ledger metadata for auditability.
