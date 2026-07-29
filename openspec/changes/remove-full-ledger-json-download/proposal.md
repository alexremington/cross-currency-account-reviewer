# Remove Full Ledger JSON Download

## Goal

Keep the Outputs section focused on the primary CSV ledger and its metadata summary by removing the separate full-ledger JSON download control.

## Scope

Remove only the user-facing full-ledger JSON button, handler, smoke path, and active documentation. Preserve the internal ledger JSON contract and lazy serializer for compatibility and tests.
