# Technical Decisions

- The model is ported and pinned rather than imported from the private Duplicate Reviewer checkout or extracted into a new shared package.
- Currency behavior is implemented as an explicit Cross-Currency policy adapter around the ported Account model.
- The existing `score` and `exactIdentity` fields remain available for compatibility; mature-model fields are additive.
- Same-currency pairs remain excluded before scoring, so the Cross-Currency app does not expose a second same-currency behavior.
- Candidate generation may use mature Account blocking and bounded candidate discovery, but it remains limited to unequal-currency records.
