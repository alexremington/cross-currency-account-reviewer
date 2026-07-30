# Compact human-review score ledgers

## Why

The current downloaded score ledgers expose scorer diagnostics, normalized comparison values, and implementation metadata alongside the values a human reviewer needs. This makes the files difficult to scan and creates pressure to treat internal diagnostics as user-facing data.

## Proposal

Add a versioned compact presentation ledger for Account and Contact downloads across the Cross Currency Reviewer and public/private Duplicate Reviewers. Preserve rich private producer ledgers as audit and diagnostic artifacts, and project them into the compact structure only at the user-download boundary.

## Outcome

Human reviewers receive the same concise, readable structure across applications while pair identity, score, recommendation assignments, source values, and review rationale remain preserved and testable.
