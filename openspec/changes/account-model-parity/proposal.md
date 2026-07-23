# Mature Account Model Parity

## Goal

Make Cross-Currency Account Reviewer use a versioned public port of the current Duplicate Reviewer Account model while preserving its cross-currency eligibility rule.

## Scope

- Port privacy-safe Account normalization, similarity, evidence, contradiction, hierarchy, lane, and reason logic.
- Keep only populated unequal-currency pairs eligible for this app.
- Treat currency difference as lane eligibility, not positive identity evidence.
- Preserve the existing proposal and export workflow while adding mature-model explanations and metadata.
- Keep the model version pinned and require explicit parity releases for future model changes.
- Make `score` a single continuous evidence estimate; retain legacy numeric fields only as equal compatibility aliases.
- Require fixture and sanity checks for score coherence, typed sentinels, and valid typed conflicts.

The change excludes Contacts, Salesforce writes, Duplicate Reviewer runtime dependencies, and unrelated production artifact workflows.
