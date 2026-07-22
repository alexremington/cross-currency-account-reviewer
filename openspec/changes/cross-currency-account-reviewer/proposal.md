# Cross-Currency Account Reviewer

## Goal

Provide a public, sanitized, local-first tool for identifying Salesforce Account pairs that represent the same company in different currencies and producing reviewable parent-record proposals.

## Scope

V1 includes CSV import, validation, pair-level scoring, explainable evidence, proposed parent values, overrides, and Salesforce-ready exports. It excludes multi-record grouping, direct Salesforce writes, Contacts, and live credentials.

## Decisions

- Different `CurrencyIsoCode` values are required for the cross-currency lane.
- Score 100 requires exact normalized `Name`, exact agreement for all comparable nonblank identity evidence, and at least one corroborating identity field.
- Parent currency is explicitly selected before export.
- Pair-level proposals ship before grouping.
- Data stays in the browser and is never sent to a server or Salesforce.
