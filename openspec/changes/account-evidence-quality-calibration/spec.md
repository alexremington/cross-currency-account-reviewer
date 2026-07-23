# Capability Specification

## Typed Account evidence

Account Website and Phone values MUST emit `valid`, `blank`, or `invalid` availability. Invalid values MUST retain their raw cell and a stable invalid reason, but MUST be unavailable to scoring, contradictions, corroboration, field statistics, candidate blocking, and confidence rules. Missing values MUST remain unpenalized.

Pair evidence MUST emit `matched`, `conflict`, `blank`, or `invalid` status. Valid unequal typed values remain conflicts unless a named stronger-evidence rule permits promotion.

## Renaissance calibration

An Account pair with an exact same-level name, aligned billing address, exact valid Phone, and valid unequal Website MAY qualify for the existing `exact-name-address-phone` confidence rule when the Website is the only decisive contradiction. The Website conflict MUST remain in pair metadata and UI evidence.

## Parity

Cross Currency and Duplicate Reviewer MUST use equivalent typed validation, availability, evidence status, and Renaissance rule semantics. Contact normalization MUST remain unchanged.
