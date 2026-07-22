# Capability Specification

## CSV validation

The app MUST require `Id`, `Name`, and `CurrencyIsoCode`, reject duplicate IDs, report missing values, and support quoted CSV, BOM, CRLF, and Unicode input.
The import step MUST provide a downloadable example CSV template that includes the accepted upload headers so reviewers can start from a known-good file shape.

## Scoring

The scorer MUST compare only records with different nonblank currencies, use the pinned mature Account model, emit a visible belief score, operational score, confidence lane, field evidence, reason codes, and human-readable reasons. Currency difference is eligibility context and MUST NOT add identity-confidence points. A score of 100 is reserved for an exact-confidence rule from the pinned Account model.

## Parent proposals

The proposal builder MUST select deterministic values, preserve source provenance per field, support reviewer overrides with reasons, and require parent currency selection.

## Exports

Exports MUST include versioned parent proposals, child associations, and audit metadata. Exported rows MUST reconcile to the reviewed pair and preserve source IDs.

The app MUST also provide a full score ledger immediately after matching, without requiring proposal review. The ledger MUST contain exactly one record per scored candidate pair, in deterministic order, with source IDs, currencies, score, band, exact-identity flag, reason codes, human-readable reasons, and raw/normalized evidence for Name, Website, Phone, composite Billing address, and Ultimate Parent Account. The CSV MUST contain only pair-level columns; batch metadata and column definitions MUST be provided in a separate `cross-currency-score-ledger-summary/v1` JSON download. The full structured JSON MUST use the `cross-currency-score-ledger/v1` contract. `LastModifiedDate` MUST NOT be treated as scoring evidence.

## Launcher and runtime contract

The server MUST expose `GET /api/health` with `appId`, `runtimeContractVersion`, `pid`, `port`, and `runtimeId`. The launchers MUST use `cross-currency-account-reviewer/v1`, keep logs and state outside the repository, wait for health readiness before opening the browser, and reject a port occupied by an unknown or incompatible process.
