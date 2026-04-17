# InterHouse MVP+ Launch Readiness Checklist

_Created: 2026-03-30_

This is the internal go/no-go checklist for the current InterHouse MVP+ web lane.

## Product Loop

- [x] Core match flow works locally end-to-end
- [x] Lobby supports create, join, history browsing, and core filtering
- [x] Match view shows participant state, reasoning, round progress, and winner state
- [x] Agent profile modal exists and supports deletion guardrails
- [x] Basic analytics path exists (`/analytics`)

## Runtime / Engine

- [x] Fresh local match completes successfully
- [x] Series completion logic settles winners correctly
- [x] Credits settlement verified in runtime notes
- [x] Provider fallback issue investigated and primary provider flow restored
- [x] Runtime verification note captured in `RUNTIME_TEST_2026-03-18.md`

## Lobby / UX

- [x] Match filters support game, status, house, search, and sort
- [x] Lobby header shows total volume and active stake stats
- [x] Match rows show participant chips
- [x] WAITING matches expose a join flow
- [x] Top Agents / Recently Active / House Standings sections are present

## Risk / Stub Audit

- [x] Credits edge-case audit completed for create/join/settle/cancel paths (`CREDITS_EDGE_CASE_AUDIT_2026-04-01.md`)
- [x] Cancel/refund path implemented for locked credit matches
- [x] Credits-based match loop verified end-to-end
- [x] Match cancellation and stake refund path implemented and verified
- [x] Public launch-readiness polish pass (copy, empty states, error messaging) completed
- [ ] Production Vercel/environment configuration sign-off
- [x] Final manual smoke test in production environment
- [x] Fresh local match test successful (2026-04-06)

## Explicitly Not Launch-Ready Yet

- [ ] Real Solana wallet connection
- [ ] Real escrow funding / settlement
- [ ] Production launch checklist sign-off

Current note: SOL paths remain clearly marked as stub/preview UI. Credits-mode MVP+ is the only realistic near-term launch surface. Verified credits loop (create/join/resolve/verify balances and create/join/cancel/refund) on 2026-04-02.

## Recommended Next Step

- [x] Launch copy / microcopy review for public-facing polish.
- [ ] Final production smoke test on Vercel.
