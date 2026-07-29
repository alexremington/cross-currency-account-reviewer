# Technical Decisions

## Preserve recommended-master ledger fields

The current ledger builder calls proposal construction only to select a deterministic recommended master. That selection will move to a small ledger-owned helper so removing proposal editing and proposal exports does not change the score-ledger contract.

## One-shot combined action

The combined control is a convenience action for the initial dataset match. It is reset by a new import and remains disabled after a successful match. The separate Match and Output controls remain available for recovery and alternate downloads.

## Browser download reliability

Downloads will use an anchor attached to `document.body`, then remove the anchor and revoke the object URL after the click has been dispatched. The Playwright smoke must wait for the real browser download event and inspect its contents.
