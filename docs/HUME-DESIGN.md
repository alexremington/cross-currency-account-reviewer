# UX Design Contract

This design direction was produced from the Hume review for the approved v1 stories.

## Flow

`Import CSV → validate → summarize currency coverage → Match or Match and download → download ledger outputs.`

## Information hierarchy

1. Import guidance: required fields, scored fields, and currency coverage.
2. Match actions: a match-only action and a combined match/download action.
3. Outputs: exact scored-pair count and separate CSV, full JSON, and summary JSON downloads.

## Interaction and accessibility requirements

- Use semantic landmarks, headings, labels, table headers, and live status text.
- Do not rely on color alone for match state, field status, or currency differences.
- Keep keyboard navigation available for import, matching, and output downloads.
- Preserve visible focus and 44px minimum hit targets.
- Stack comparisons on narrow windows or provide an explicitly labelled horizontal comparison region.
- The primary content region must scroll when needed; no user-facing content may be clipped.
- Required export and validation status must be announced to assistive technology.
- State clearly that v1 performs export only and never writes to Salesforce.

## Score-ledger output and maturity pass

- After matching, show a named Outputs section with the full score ledger as the primary deliverable. It must be downloadable as CSV and JSON without entering a pair-review workflow.
- State the exact scored-pair count and distinguish the lean CSV, full ledger JSON, and summary JSON.
- The ledger must preserve pair identity, IDs, currencies, scores, bands, reasons, and raw/normalized evidence for every scoring field. Keep the CSV lean; provide batch metadata and column definitions in a separate summary JSON.
- Keep import guidance grouped into required, scored, and imported-but-not-scored fields. Explain the nonblank, different-currency candidate rule.
- In the import panel, keep the example CSV help affordance visually secondary to the primary upload button, but close enough to read as part of the same workflow. It should describe the file as an example/template, not as required input.
- The Outputs section should clearly distinguish each ledger artifact and its purpose.
- Preserve generous spacing, visible focus, keyboard operation, labelled scroll regions, and no clipped content at 320px and 390px widths.

## Acceptance criteria

- A valid exact cross-currency pair visibly shows score 100 and the reason `Exact normalized identity; currency differs`.
- The import panel provides a keyboard-focusable download link for an example CSV template whose headers match the accepted upload contract.
- A reviewer can complete import, Match now or Match and download, and all ledger downloads through the real UI path.
