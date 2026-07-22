# Cross-Currency Account Reviewer

Local-first browser app for reviewing Salesforce Account pairs that may represent the same company in different currencies.

## Requirements

- Node.js 20 or newer: <https://nodejs.org/>
- macOS, Windows, or Linux

## Run

macOS: double-click `Launch Cross-Currency Reviewer - Mac.command`. The launcher waits for the local server and opens the app in your default browser automatically.

Windows: double-click `Launch Cross-Currency Reviewer - Windows.cmd`, or run `powershell -ExecutionPolicy Bypass -File scripts/launch-windows.ps1`.

Manual: run `npm start`, then open <http://127.0.0.1:5190>.

The app reads files locally in the browser. It does not upload data or connect to Salesforce.

## CSV contract

Required headers are `Id`, `Name`, and `CurrencyIsoCode`. Optional evidence headers include `Website`, `Phone`, `BillingStreet`, `BillingCity`, `BillingState`, `BillingPostalCode`, `BillingCountry`, `Ultimate_Parent_Account__c`, and `LastModifiedDate`. Salesforce export headers are accepted case-insensitively.

## Workflow

Import a CSV, validate it, click **Match now**, inspect the prioritized pair queue, review the proposed parent, optionally override fields with a reason, and export the parent proposal, child association, and audit files. A score of 100 is reserved for exact normalized identity evidence with different currencies.

## Development

```bash
npm test
npm run check
npm run check:windows
npm run sanity:results
npm run smoke:ui:local
```

Only sanitized fixtures belong in this public repository. Never commit Salesforce exports, credentials, or internal paths.
