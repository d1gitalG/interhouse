# InterHouse Tournament QA Plan — 2026-04-26

## Scope

Future tournament work must differ from the 2026-04-26 ad hoc brackets: the 16/32-agent runs were normal two-agent matches chained by scripts/reports, each with its own `stakeAmount`, so the champion did **not** win a single tournament pool.

This plan covers winner-take-all tournament accounting plus match/character presentation regressions.

## Current-state findings

- Schema has `Match`, `MatchParticipant`, `Move`, and per-agent `credits`/`lockedCredits`; there is no `Tournament`, `TournamentEntry`, bracket node, tournament pot, or per-tournament settlement model yet.
- Normal credit lifecycle is match-local:
  - create/join activates a two-player match and calls `lockMatchStakeCredits`.
  - lock marks `Match.creditsLockedAt`, then debits each participant `credits -= stakeAmount` and increments `lockedCredits += stakeAmount`.
  - match completion calls `settleLockedMatchStakeCredits`, decrements loser locked credits, decrements winner locked credits, and credits winner `stakeAmount * 2`.
  - cancel/stale cleanup calls `refundLockedMatchStakeCredits`, marks `creditsSettledAt`, and refunds each participant from locked credits.
- High-risk existing edge: `lockMatchStakeCredits` marks `creditsLockedAt` before participant debit. If any later participant debit fails inside the transaction this should roll back, but tournament tests should explicitly guard against stranded `creditsLockedAt`/partial locks under insufficient funds and concurrency.
- High-risk existing edge: `creditsSettledAt` is overloaded for both payout settlement and refund settlement. Tournament accounting should have explicit state/reason fields or event rows so payout vs refund is auditable.
- High-risk existing edge: `finalizeMatchWinner` updates match status/winner and W/L before credit settlement. It runs in callers' transactions today, but tests should prove settlement failure rolls back winner/status/stat changes.
- Historical tournament reports (`TOURNAMENT_RESULTS_2026-04-26_16_AGENT.md`, `TOURNAMENT_RESULTS_2026-04-26_32_AGENT_BO5.md`, `CHARACTER_CUP_RESULTS_2026-04-26.md`) show bracket labels and champions, but match URLs are ordinary `/match/:id` records with per-match stakes. They should be labeled as exhibitions/ad hoc brackets, not proof of tournament pool semantics.
- Character presentation exists on the match page through `deriveCharacterSummary`, `parseReasoningBeats`, participant trait chips, latest reasoning chips, and post-match story text. QA should ensure tournament recaps preserve these summaries without truncating key traits/flaws/voice cues.

## QA matrix

| Area | Test | Expected result |
|---|---|---|
| Normal match regression | Create ACTIVE CREDITS match with two funded agents, complete via tick/move. | Each agent locks one stake; winner receives `stakeAmount * 2`; both `lockedCredits` return to 0; match `COMPLETED`, one winner, W/L increment once. |
| Normal match idempotency | Re-submit final tick/move after match completed; call settlement helper twice if covered by unit/integration harness. | No double payout, no second W/L increment, no locked credit mutation after `creditsSettledAt`. |
| Normal waiting/join path | Create WAITING match with creator only, then join with opponent. | Creator is not locked until match becomes ACTIVE; both participants lock exactly once on join. |
| Insufficient credits | Try to create/join a CREDITS match/tournament with one underfunded entrant. | 409/validation failure; no participant loses credits; no match/tournament lock timestamps survive; no stranded locked credits. |
| Tournament entry lock | Register N entrants with entry fee E. | Each entrant has exactly E moved from credits to locked/pool accounting once; tournament state changes from OPEN to LOCKED/ACTIVE; entries cannot mutate after lock. |
| Tournament pool invariant | After lock, compute pool = N * E. | Stored pool equals sum of entry locks; no per-round match settlement leaks into tournament pool unless intentionally modeled. |
| Bracket progression | Run N=4 and N=8 deterministic bracket. | Winners advance exactly once; eliminated agents cannot re-enter; final has exactly two finalists; champion matches final winner. |
| Winner-take-all payout | Complete final. | Champion receives full pool; non-champions receive no payout; all entrant locked credits clear; tournament has settled timestamp/state; total credits conserved. |
| Tournament payout idempotency | Retry finalization/settlement, concurrent finalize calls, page refresh tick retry. | Champion paid once; state remains SETTLED; no duplicate credits/stat changes. |
| Cancellation before lock | Cancel OPEN tournament. | No credits touched; entries marked cancelled/refunded/not locked. |
| Cancellation after lock before first match | Cancel LOCKED/ACTIVE tournament. | Every entrant refunded E; pool returns to 0; all `lockedCredits` clear; state CANCELLED; retry cancel is no-op. |
| Cancellation mid-bracket | Cancel after some completed bracket matches but before final settlement. | Unsettled tournament entry locks refund or resolve per product rule; no stranded locked credits; normal match results stay readable but do not imply champion payout. |
| Match-vs-tournament isolation | Tournament bracket matches use zero internal stake or a clearly separate accounting path. | Round winners do not receive `stakeAmount * 2` unless product intentionally allows per-round prizes; champion-only payout remains exact. |
| Reporting semantics | Generate tournament report/recap. | Shows entry fee, entrant count, total pool, champion payout, bracket match IDs, and explicitly distinguishes exhibition/ad hoc bracket from real tournament pool. |
| UI recap readability | Match and tournament pages show participant archetype, flaw, voice cue, latest plan/read/action, final score, and champion story. | Chips/text are readable on mobile/desktop; long reasoning is collapsed but expandable; fallback/provider warnings are visible. |
| Trait consistency | Known agents (Granite Crown, Ember Jackal, Twin Static, etc.) render expected archetype/flaw/voice cue. | Presentation mapping remains stable across match page and tournament recap. |

## Recommended automated coverage

1. Add integration tests around `lib/credits.ts` for lock/settle/refund/idempotency/corruption rollback using test DB transactions.
2. Add API smoke tests for `/api/matches`, `/join`, `/tick` or `/move`, `/cancel` covering normal CREDITS flow and insufficient-credit flow.
3. When tournament models/APIs land, add a deterministic tournament harness with seeded RPS outcomes for 4-agent and 8-agent brackets.
4. Add an invariant checker script/test:
   - `sum(agent.credits + agent.lockedCredits) + settled external pool delta` is conserved.
   - no completed/cancelled tournament leaves entrants with locked credits.
   - no tournament has both refund and payout settlement events.
5. Add Playwright/screenshot checks for match/tournament recap: participant cards, trait chips, reasoning chips, champion story, and fallback badge.

## Highest-risk areas to watch

- Mixing normal match `stakeAmount * 2` settlement with tournament winner-take-all pool settlement.
- Absence of tournament-specific tables/events; trying to infer tournament state from ordinary matches will be fragile.
- Double payout from retries/concurrent finalization.
- Stranded locked credits when a lock succeeds but later bracket creation/tick/settlement fails.
- `creditsSettledAt` meaning both refund and payout, making audit/reporting ambiguous.
- Reports using tournament language for ad hoc bracket scripts without pool semantics.
