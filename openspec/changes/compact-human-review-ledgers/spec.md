# Compact human-review ledger contract

## Account download

The compact Account CSV MUST contain these columns in this order:

`recommendedMasterId`, `recommendedMasterName`, `recommendedMasterCurrency`, `recommendedMasterWebsite`, `recommendedMasterPhone`, `recommendedMasterAddress`, `recommendedMasterHierarchy`, `recommendedSubordinateId`, `recommendedSubordinateName`, `recommendedSubordinateCurrency`, `recommendedSubordinateWebsite`, `recommendedSubordinatePhone`, `recommendedSubordinateAddress`, `recommendedSubordinateHierarchy`, `score`, `matchSummary`, `reviewReason`.

The master and subordinate IDs MUST identify the two scored records. The subordinate MUST be the other record in the pair after the existing deterministic master-selection policy is applied. Source fields MUST be taken from the selected records, not from field-by-field recommended-value selection.

`matchSummary` MUST concatenate concise statuses for the reviewed fields. `reviewReason` MUST concatenate the existing human-readable reasons plus applicable contradiction and hierarchy notes. Internal normalized values, scorer diagnostics, field-score objects, eligibility flags, and contract metadata MUST NOT appear in the compact CSV.

## Contact download

The compact Contact CSV MUST contain these columns in this order:

`recommendedMasterId`, `recommendedMasterName`, `recommendedMasterEmail`, `recommendedMasterPhone`, `recommendedMasterOrganization`, `recommendedMasterMailingAddress`, `recommendedSubordinateId`, `recommendedSubordinateName`, `recommendedSubordinateEmail`, `recommendedSubordinatePhone`, `recommendedSubordinateOrganization`, `recommendedSubordinateMailingAddress`, `score`, `matchSummary`, `reviewReason`.

Contact master selection MUST preserve the existing deterministic Contact recommendation semantics. Contact summaries MUST cover name, email, phone, organization, and mailing address.

## Preservation and projection

The compact ledger MUST preserve row count, pair IDs, scores, and master/subordinate assignments from its rich input. The private producer-generated rich `scored-pairs-latest.csv` artifacts MUST remain available and unchanged by the presentation projection.

## Validation

Each surface MUST have a named regression for exact headers, compactness, source-field values, and recommendation IDs. Browser-facing surfaces MUST verify the real download gesture and downloaded bytes. Large and zero-pair outputs MUST remain valid.
