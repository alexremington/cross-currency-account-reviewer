# Technical Decisions

## Chunk size

Use a 64 KiB target chunk size. A single row is kept intact when it exceeds that target so CSV row boundaries and escaping are never split semantically; Blob parts may still be independently concatenated by the browser.

## Compatibility

Keep the existing string properties for small callers and tests, but compute them lazily. The UI uses `csvChunks` for CSV downloads and never requests the full JSON string during a CSV-only action.
