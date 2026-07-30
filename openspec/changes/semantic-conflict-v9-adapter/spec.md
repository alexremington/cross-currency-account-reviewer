# Cross Currency Account semantic-conflict v9 adapter

## Requirements

- The Cross Currency Account adapter MUST declare the v9 Account model and preserve semantic conflict fields.
- Unequal populated currencies MUST remain eligibility-only and MUST NOT change identity scoring.
- Broad and explicit semantic conflicts MUST receive the v9 penalty-only treatment and MUST not enter confidence lanes.
- Typed invalid Website/Phone values, sentinels, hierarchy evidence, and Renaissance exceptions MUST retain Cross Currency behavior.
- v8 artifacts MUST remain rollback-compatible; mixed model metadata MUST fail closed.
