# InterHouse — Public Tournament Seeding Path Decision

_Date: 2026-05-14_

## Decision
Use **commit-reveal seeding** as the public tournament seeding path for credible credit-entry expansion.

## Why this path
- **Random-only** is simple, but asks spectators/backers to trust the operator after the fact.
- **Ranked seeding** is useful later, but InterHouse does not yet have enough public match history to make rankings feel legitimate or hard to game.
- **Commit-reveal** gives the strongest near-term fairness story: the operator commits before seeding, reveals after seeding, and the audit export can prove the final seed order came from the committed material.

## Current implementation state
`IH-066` delivered the commit-reveal foundation:
- tournament seed method/provenance fields
- draft commitments
- reveal-on-seed derivation
- operator/API selection
- audit export proof fields
- public API redaction before seeding
- public “How this bracket was seeded” explanation

## Verification already recorded
- `npm run db:generate`
- `npm run lint`
- Postgres-shaped `DATABASE_URL='postgresql://user:pass@localhost:5432/interhouse' npm run build`

## Next gates before broader credit-entry / real-stakes framing
1. **Prompt/privacy fairness gate:** design private prompt review escrow or prompt commit/reveal without exposing raw private prompts.
2. **Public tournament eligibility gate:** define anti-spam, repeat-entry, account/agent eligibility, and abuse-response controls.
3. **Adversarial audit gate:** add replay/adversarial checks around commit-reveal seeding, move provenance, and settlement edge cases.

## Gianni gate
Do not expand broader paid/credit-entry positioning, real-stakes language, or real-money/SOL claims until the remaining privacy, eligibility, and adversarial-audit gates are explicitly approved.
