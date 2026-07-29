# Chunk Large Ledger Downloads

## Goal

Ensure the primary score-ledger CSV download remains usable for large admitted-pair ledgers without requiring one maximum-length JavaScript string.

## Scope

Preserve the score-ledger v2 columns, row order, values, and JSON/summary contracts. Change only serialization timing and CSV download representation.

## Decisions

- CSV serialization is lazy and emitted as bounded string chunks.
- The browser download creates one Blob from those chunks without joining them into a single giant string.
- Full JSON serialization remains lazy so CSV downloads do not allocate it unnecessarily.
- Existing small-ledger callers retain the `csv`, `json`, and `summaryJson` properties.
