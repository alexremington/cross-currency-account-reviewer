# Cross-Currency Account Reviewer

Local-first browser app for reviewing Salesforce Account pairs that may represent the same company in different currencies.

## Requirements

- Node.js 20 or newer: <https://nodejs.org/>
- macOS, Windows, or Linux

## First-time setup

These steps are for a colleague using a new computer. The launcher is included in the GitHub repository; it does not need to be provided separately.

1. Install Node.js 20 or newer from <https://nodejs.org/>. On Windows, use the LTS installer and restart PowerShell afterward if it was already open.
2. Open Terminal on macOS or PowerShell on Windows.
3. Clone the public repository and enter its folder:

```bash
git clone https://github.com/alexremington/cross-currency-account-reviewer.git
cd cross-currency-account-reviewer
npm install
```

On Windows PowerShell, the same commands work. If Git is not installed, install it from <https://git-scm.com/downloads>, then repeat these commands.

If PowerShell reports that running scripts is disabled on the system when you run `npm install`, use the Windows command shim instead:

```powershell
npm.cmd install
```

The `npm install` step is required once per checkout. After that, use the launcher whenever you want to run the app.

## Run the app

macOS: open the cloned repository in Finder and double-click `Launch Cross-Currency Reviewer - Mac.command`. If macOS blocks the first launch, right-click the file, choose **Open**, and confirm. The launcher force-restarts a per-user background service, waits for readiness, and opens the app in your default browser. The server remains running after the terminal window closes.

Windows: open the cloned repository in File Explorer and double-click `Launch Cross-Currency Reviewer - Windows.cmd`. If execution policy prevents the launcher from running, open PowerShell in the repository folder and run `powershell -ExecutionPolicy Bypass -File scripts/launch-windows.ps1`. The launcher starts a detached server, waits for readiness, and opens the browser without requiring the terminal to remain open.

Manual: run `npm start`, then open <http://127.0.0.1:5190>.

The app reads files locally in the browser. It does not upload data or connect to Salesforce.

## Use the app

1. Export the Salesforce Account data as a CSV and keep the file on your computer.
2. In the app, choose **Import Account CSV** and select the file.
3. Review the validation message and field guide, then choose **Match now**.
4. Download the **score ledger CSV** from the Outputs section. It contains one lean row per scored pair. Download the full ledger JSON for structured evidence, or the summary JSON for batch metadata and column definitions. These downloads do not require reviewing individual pairs.
5. Select a pair in the queue to inspect its evidence and proposed multicurrency parent.
6. Optionally override proposed values. Every override requires a reason.
7. Choose a parent currency, then export the reviewed parent proposal, child associations, and audit files.

The app only creates local downloads. It does not insert records into Salesforce.

### Account model

Cross-Currency Account Reviewer uses the pinned Duplicate Reviewer Account model `duplicate-reviewer-account-model/2026-07-20`. It carries over fuzzy field comparison, evidence weighting, contradiction handling, hierarchy-aware account-name interpretation, confidence lanes, and explainable reason metadata. Different populated currencies are required for this app's lane but do not themselves increase the identity score. Future model changes are applied through explicit parity releases.

## Runtime lifecycle

Both launchers use the versioned `/api/health` contract `cross-currency-account-reviewer/v1`. They force-restart a compatible app runtime, reject an unknown process occupying the configured port, and open the browser only after readiness.

macOS service state and logs are stored outside the repository under `~/Library/Application Support/Cross-Currency Account Reviewer/`. Windows state and logs are stored under `%LOCALAPPDATA%\Cross-Currency Account Reviewer\`. To stop a managed runtime manually, run `node scripts/launch-local-app.js --stop --no-open` from the app directory.

## CSV contract

Required headers are `Id`, `Name`, and `CurrencyIsoCode`. The scorer reviews `Name`, `CurrencyIsoCode`, `Website`, `Phone`, the composite billing address (`BillingStreet`, `BillingCity`, `BillingState`, `BillingPostalCode`, `BillingCountry`), and `Ultimate_Parent_Account__c`. `LastModifiedDate` is accepted and preserved as source data, but does not affect scoring. Only records with two nonblank, different currencies become candidates. Salesforce export headers are accepted case-insensitively.

## Workflow

Import a CSV, validate it, click **Match now**, download the complete score ledger, inspect the prioritized pair queue, review the proposed parent, optionally override fields with a reason, and export the reviewed parent proposal, child association, and audit files. The score ledger contains every scored pair, including pairs that have not been reviewed. A score of 100 is reserved for exact normalized identity evidence with different currencies.

## Development

```bash
npm test
npm run check
npm run check:windows
npm run sanity:results
npm run smoke:ui:local
```

Only sanitized fixtures belong in this public repository. Never commit Salesforce exports, credentials, or internal paths.
