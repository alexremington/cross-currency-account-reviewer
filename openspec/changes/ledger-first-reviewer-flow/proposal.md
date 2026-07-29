# Ledger-First Reviewer Flow

## Goal

Make the full score ledger the primary and simplest Cross-Currency Account Reviewer workflow, with a reliable one-click match-and-download action.

## Scope

This change removes the pair queue, pair decision, proposal editing, parent proposal export, child association export, and review-audit export from the active app flow. CSV import, validation, scoring, full ledger CSV/JSON/summary outputs, and launcher behavior remain in scope.

## Decisions

- `Match now` remains a match-only action.
- `Match and download full score ledger` is available after valid import, runs one fresh match, downloads only `score-ledger.csv`, and is disabled after successful use for that dataset.
- Separate CSV, full JSON, and summary JSON downloads remain available in Outputs.
- The score-ledger v2, summary v1, scoring semantics, and deterministic recommended-master fields remain unchanged.
- The browser download helper must use a document-attached temporary anchor and surface matching or download failures.
