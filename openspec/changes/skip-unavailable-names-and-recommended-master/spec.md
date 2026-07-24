# Capability Specification

## CSV import

The app MUST require the `Name` header but MUST skip rows whose normalized Account Name is unavailable under the existing comparable-value rules. Skipped rows MUST NOT block matching, candidate generation, duplicate-ID validation, or scoring.

The import result MUST expose skipped-row metadata containing the CSV row number, Salesforce ID, raw Account Name, and skip reason. Other CSV errors MUST remain blocking.

## Recommended master output

Each scored pair MUST expose one deterministic recommended master source record. The recommendation MUST use the same precedence as the existing proposal defaults: most supplied proposed field values, then most populated display fields, then stable ID order.

The score-ledger CSV and JSON MUST include the recommended master ID and source values for the Account Name, CurrencyIsoCode, Website, Phone, Billing address fields, and Ultimate Parent Account. Non-scoring fields such as `LastModifiedDate` MUST remain excluded from the lean score-ledger rows. Existing merged proposal values and scoring evidence MUST remain unchanged.
