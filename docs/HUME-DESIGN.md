# UX Design Contract

This design direction was produced from the Hume review for the approved v1 stories.

## Flow

`Import CSV → validate → summarize currency coverage → Match now → inspect pair evidence → review proposed parent → add optional overrides → export.`

## Information hierarchy

1. Decision header: pair status, score, confidence band, and the plain-language reason.
2. Evidence summary: matched, differing, blank, and conflicting fields; currency difference is shown as context.
3. Side-by-side child records: Salesforce IDs, source row, and attributable values.
4. Proposed parent: selected values, field provenance, override controls, and export action.

## Interaction and accessibility requirements

- Use semantic landmarks, headings, labels, table headers, and live status text.
- Do not rely on color alone for match state, field status, or currency differences.
- Keep keyboard navigation available for queue navigation, evidence details, overrides, and export.
- Preserve visible focus and 44px minimum hit targets.
- Stack comparisons on narrow windows or provide an explicitly labelled horizontal comparison region.
- The primary content region must scroll when needed; no user-facing content may be clipped.
- Required export and validation status must be announced to assistive technology.
- State clearly that v1 performs export only and never writes to Salesforce.

## Acceptance criteria

- A valid exact cross-currency pair visibly shows score 100 and the reason `Exact normalized identity; currency differs`.
- Every proposed parent value identifies its source child or an explicit manual override.
- Overrides require a reason and remain visibly distinct from defaults.
- A reviewer can complete import, Match now, evidence inspection, override, and export through the real UI path.
