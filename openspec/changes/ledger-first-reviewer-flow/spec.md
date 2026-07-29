# Capability Specification

## Ledger-first workflow

The app MUST present Import, Match, and Outputs as the complete primary workflow. Outputs MUST be the final user-facing section in document order. Pair queue and pair decision sections MUST NOT be rendered.

After valid CSV import, the app MUST enable `Match now` and `Match and download full score ledger`. The combined action MUST match the current dataset, publish visible progress, and initiate exactly one `score-ledger.csv` browser download. It MUST be disabled after successful use until another CSV is imported.

## Download behavior

The standalone CSV download MUST work after matching and MUST produce the same ledger content as the combined action. Download failures MUST be surfaced through the visible status/toast path and MUST NOT be silently ignored.

## Preserved ledger contract

The score-ledger v2 JSON/CSV content, summary v1 metadata, pair ordering, evidence fields, score semantics, and deterministic recommended-master fields MUST remain unchanged.

## Removed proposal workflow

The active app MUST NOT expose proposal editing, parent currency selection, parent proposal export, child association export, or review-audit export. Proposal-only modules and tests MAY be removed when they are no longer needed by the preserved ledger implementation.

## Accessibility and responsive behavior

Matching controls MUST expose busy state through visible text, `aria-busy`, and disabled state. The primary content MUST remain readable and scrollable at 320px and 390px widths without horizontal body overflow or clipped controls.
