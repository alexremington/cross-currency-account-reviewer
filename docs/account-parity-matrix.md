# Account parity matrix

The matrix is intentionally explicit so a Cross Currency release cannot silently become a second Account model.

| Area | Disposition | Contract |
| --- | --- | --- |
| Text, company-name, Website, Phone, address, parent normalization | canonical-account | Mirror the pinned Account semantics and preserve raw typed evidence. |
| Field weights, common-value discounting, continuous score, contradiction severity | canonical-account | Equivalent semantic score; no lane floor or currency bonus. |
| Hierarchy, scope, address, ultimate-parent, reason and evidence taxonomy | canonical-account | Mirror explanatory metadata and preserve contradiction status. |
| Populated unequal currencies | cross-currency-adapter | Eligibility only; never identity evidence. |
| Blank/equal currencies | cross-currency-adapter | Exclude before candidate scoring. |
| Candidate ledger, proposal, parent selection, and exports | cross-currency-adapter | Preserve Cross Currency contracts and workflow shape. |
| Merge thresholds, queue routing, Salesforce writes, producer/autoload operations | duplicate-reviewer-only | Not ported. |
| Contact scoring and Contact UI/workflow | duplicate-reviewer-only | Not imported or changed by this app. |

The pinned semantic source is recorded in `ACCOUNT_MODEL_VERSION` in `core/account-model.js`. Differences discovered during a parity release must be added here with exactly one disposition.
