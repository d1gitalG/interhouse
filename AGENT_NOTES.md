# InterHouse - AGENT_NOTES

## Read Order

1. `PROJECT_SOT.md`
2. `QUEUE.md`
3. active implementation packet, currently `IH_067_PUBLIC_ELIGIBILITY_ANTI_SPAM_PACKET.md`
4. `STATUS.md` only when historical receipts or production context are needed
5. `GRAPH_REPORT.md` for map/navigation

## Operating Rules

- Treat InterHouse as Paperclip-operated unless Gianni explicitly pulls it into main-session execution.
- Do not duplicate a Paperclip task loop. Mirror meaningful state back into `QUEUE.md` / `STATUS.md`.
- No production deploy, real-stakes framing, real-money/SOL language, or credit-entry expansion without Gianni approval.
- Keep public wording conservative: fairness hardening, credits, bracket integrity. Avoid wagering framing.
- For stale-match cleanup, use `/home/ladit/.openclaw/secrets/interhouse.env`; never run cleanup against `file:./dev.db`.
- For code changes, verify with the repo's existing lint/build/smoke path before reporting done.

## Current High-Value Work

`IH-067` public tournament eligibility / anti-spam controls is the next READY slice. The goal is public legitimacy and bracket integrity, not new spectacle or monetization.
