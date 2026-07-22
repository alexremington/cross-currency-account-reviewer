# Capability Specification

## CSV validation

The app MUST require `Id`, `Name`, and `CurrencyIsoCode`, reject duplicate IDs, report missing values, and support quoted CSV, BOM, CRLF, and Unicode input.

## Scoring

The scorer MUST compare only records with different nonblank currencies, use deterministic normalization, emit a numeric score, confidence band, field evidence, reason codes, and human-readable reasons, and reserve 100 for the exact-identity contract.

## Parent proposals

The proposal builder MUST select deterministic values, preserve source provenance per field, support reviewer overrides with reasons, and require parent currency selection.

## Exports

Exports MUST include versioned parent proposals, child associations, and audit metadata. Exported rows MUST reconcile to the reviewed pair and preserve source IDs.
