# InterHouse - PROJECT_SOT

```yaml
project: InterHouse
status: maintain
phase: production_live_fairness_hardening
updated: 2026-05-21
owner: Paperclip-operated; repo truth mirrored here
lane: product / legitimacy / support
source_of_truth_for: production state, tournament fairness hardening, public eligibility controls
gianni_gate: production deploy, real-stakes framing, real-money/SOL language, credit-entry expansion
```

## What This Is

InterHouse is an AI Agent Battle Arena / RPS tournament product built in `interhouse/` with Next.js, Prisma, Postgres/Neon, and Vercel.

Production: `https://interhouse-five.vercel.app`

## Current State

InterHouse is production-live and in maintain/support mode. The Phase 5 audit and fairness transparency foundation has been deployed and production-smoked. The next meaningful work is deeper fairness hardening before broader credit-entry brackets or any real-stakes expansion.

The project is now Paperclip-operated. This folder remains the repo-side truth mirror and should stay synced to meaningful Paperclip progress instead of becoming a duplicate execution board.

## Current Next Action

`IH-067` is the next ready slice: public tournament eligibility / anti-spam controls.

Packet: `IH_067_PUBLIC_ELIGIBILITY_ANTI_SPAM_PACKET.md`

Definition of done:

- eligibility rule matrix
- duplicate/spam entry prevention path
- clear public fairness copy
- tests for allowed/rejected entries
- no audit/export regression

## Gates

Approval gates and safe-vs-ask-first actions are defined in workspace root `AGENTS.md` -> `Safety`.

InterHouse-specific delta: production deploy, real-stakes framing, real-money/SOL language, broader credit-entry expansion, and anything that makes the app look ready for external wagering or financial use are gated.

Operational safety:

- Stale cleanup uses `/home/ladit/.openclaw/secrets/interhouse.env`.
- Never run cleanup against `file:./dev.db`.

## Canonical Files

- `PROJECT_SOT.md` - read-this-first project brief
- `STATUS.md` - detailed historical status and production receipt trail
- `QUEUE.md` - repo-side task mirror
- `IH_067_PUBLIC_ELIGIBILITY_ANTI_SPAM_PACKET.md` - next implementation packet
- `PUBLIC_ELIGIBILITY_ANTI_SPAM_SLICE_2026-05-14.md` - council-selected next slice
- `SEEDING_PATH_DECISION_2026-05-14.md` - commit-reveal seeding decision
- `TOURNAMENT_UX_NEXT_SLICE_DECISION.md` - tournament UX path
- `PHASE5_DEPLOY_SMOKE_2026-05-06.md` - latest deployed fairness foundation smoke
- `GRAPH_REPORT.md` - local map for agents
- `AGENT_NOTES.md` - local agent rules

## How To Work This Project

If InterHouse becomes one of the three active lanes, first load this SOT, then `QUEUE.md`, then the active packet. Keep work bounded to one fairness/product slice unless Gianni explicitly reopens broader InterHouse strategy.
