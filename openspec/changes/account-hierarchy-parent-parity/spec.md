# Cross Currency Account hierarchy parity

## Requirement: preserve parent levels

Account preparation MUST preserve `Parent.Name` separately from `Ultimate_Parent_Account__c`, including explicit, fallback, self-referential, and blank provenance.

## Requirement: hierarchy-aware confidence

Parent/child and sibling relationships MUST be exposed in Account score metadata and MUST NOT be promoted to same-level confidence by shared website, phone, currency, or ultimate-parent evidence alone.

Cross-currency eligibility MUST remain separate from identity scoring.
