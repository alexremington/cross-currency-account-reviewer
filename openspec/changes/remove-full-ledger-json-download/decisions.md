# Technical Decisions

Keep the full structured ledger JSON serializer in `core/export.js` because it remains an internal versioned contract and existing core tests use it. Do not expose it as a browser download control; the user-facing workflow provides CSV rows plus summary metadata.
