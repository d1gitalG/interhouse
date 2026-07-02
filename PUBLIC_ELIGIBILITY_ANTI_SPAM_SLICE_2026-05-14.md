# InterHouse — Public Eligibility / Anti-Spam Fairness Slice

_Date: 2026-05-14_
_Status: SELECTED NEXT INTERNAL SLICE_

## Decision

After the first persistent Council v2 InterHouse evaluation, the next fairness/legitimacy slice is:

**Public tournament eligibility + anti-spam controls.**

This comes before:
1. prompt/privacy escrow, and
2. adversarial replay/audit expansion.

## Council vote

| Council member | Pick | Rationale |
| --- | --- | --- |
| Peña | Eligibility / anti-spam | Clean/authenticated participant pool is the fastest bottleneck-clearing slice. |
| Kiyosaki | Prompt/privacy escrow | Trust/data protection is the valuable asset to protect before scaling. |
| Naval | Eligibility / anti-spam | Clean signal from noise before optimizing fairness mechanics. |
| Hormozi | Eligibility / anti-spam | Bad inputs create technical debt and weaken future backing/offer trust. |
| Jobs | Eligibility / anti-spam | Participant legitimacy is the simplest trust story for users to understand first. |
| Bezos | Eligibility / anti-spam | Platform health requires high-quality participant pool and anti-abuse thresholds. |
| Drucker | Adversarial audit/replay | System integrity needs measurable stress tests and owner/KPI. |
| Analyst | Eligibility / anti-spam | Sybil/spam uncertainty must be reduced before auditing/protecting the pool. |

Result: **6 / 8 selected eligibility + anti-spam.**

## Why this wins

Commit-reveal improves bracket seeding fairness, but broader credit-entry legitimacy still depends on **who is allowed into the tournament and how abuse is handled**.

If entries are spammy, duplicate, sybil-like, or manipulation-prone, then privacy escrow and replay audits protect a polluted participant pool. Eligibility comes first because it defines the clean input boundary.

## Scope

Design the internal v1 rules and implementation packet for:

1. **Entrant eligibility**
   - minimum agent age / activity criteria
   - whether newly created agents can enter public credit-entry tournaments
   - repeat-entry limits per tournament
   - duplicate/suspicious agent controls

2. **Tournament entry controls**
   - per-agent entry limits
   - per-owner/session/IP-ish heuristic notes where available and safe
   - cooldowns or rate limits for entry creation/joining
   - caps for early public credit-entry tests

3. **Abuse response**
   - what blocks entry automatically
   - what requires manual review
   - what gets logged for later review
   - how false positives are handled

4. **Public trust copy**
   - simple explanation of who can enter
   - no real-money framing
   - clear “credits-only / prototype fairness controls” language

5. **Verification path**
   - unit or API tests for duplicate entry prevention
   - API smoke for allowed entry
   - API smoke for rejected duplicate/spam entry
   - no regression to commit-reveal audit export

## Non-goals

- No production deploy in this slice without approval.
- No real-money/SOL claims.
- No KYC/payment identity system.
- No external/public announcement.
- No raw private prompt exposure.

## Worker handoff recommendation

Primary worker:
- **Builder:** `omni-dev` or `web` for implementation packet/code if approved.

Supporting workers:
- **Systems Ops Architect:** abuse-control mechanism/SOP.
- **QA:** duplicate/rejection test plan.
- **Analyst:** overclaim/risk check.
- **Jobs / UX Taste:** public fairness copy clarity.

## Immediate next action

Create a concrete implementation packet for **IH-067: Public Tournament Eligibility / Anti-Spam Controls** with:

```text
- data model/API assumptions
- eligibility rule matrix
- public copy draft
- test plan
- no-deploy approval gate
```

## Gate

Gianni approval is required before:
- production deploy,
- broader credit-entry expansion,
- real-stakes framing,
- real-money/SOL language.
