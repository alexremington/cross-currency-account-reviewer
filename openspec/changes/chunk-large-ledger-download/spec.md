# Capability Specification

## Large CSV export

The score-ledger CSV MUST preserve the existing header, row order, escaping, values, and trailing newline. The implementation MUST NOT require the complete CSV to exist as one JavaScript string before download.

CSV export MUST expose bounded chunks suitable for direct Blob construction. Each generated chunk MUST be no larger than the documented chunk bound, except an individual CSV row that itself exceeds that bound.

## Lazy formats

Building a score ledger MUST NOT eagerly stringify the full structured JSON document when only CSV output is requested. Existing JSON output MUST remain available on demand with the same `cross-currency-score-ledger/v2` contract.

## Regression

Tests MUST prove chunked CSV reconstruction equals the legacy small-ledger CSV output and that the browser smoke path downloads the expected CSV after matching.
