# Technical Decisions

- Duplicate Reviewer Account behavior is the pinned semantic reference; this app remains a privacy-safe port and does not import the private runtime.
- Currency differences are handled only by a Cross Currency policy adapter.
- Calibration uses production artifacts as input but commits semantic evidence only.
- Exact numeric values are aggregate calibration observations, not permanent pair fixtures.
- Canonical Account semantics remain Account-only: Contact behavior and Duplicate Reviewer Contact infrastructure are not imported or changed.
- Country-only address overlap is blank/insufficient evidence, not a matched address; partial phone overlap is corroboration only and never a standalone exact-confidence rule.
- Abbreviation and alias evidence may improve a same-entity name relationship, but cannot override materially different distinctive tokens or hierarchy/scope divergence.
- Structured phone evidence follows the canonical Account contract: meaningful prefix/suffix overlap is corroboration, while area-code-only overlap is not positive identity evidence and cannot enter an exact rule.
