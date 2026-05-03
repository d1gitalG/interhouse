# Phase 4 Credit-Entry Legitimacy Test — 2026-05-03

## Summary
- **Tournament:** `Phase 4 Credit Legitimacy Test 20260503T1845`
- **ID:** `cmoq4fn0d000004jy1t18hia8`
- **URL:** https://interhouse-five.vercel.app/tournaments/cmoq4fn0d000004jy1t18hia8
- **Format:** RPS / BO3 / Scarcity Duel
- **Entry fee:** 10 CR
- **Prize pool:** 40 CR
- **Entrants:** 4
- **Winner:** The Wicker Judge
- **Settlement:** completed and idempotency-checked

## Entrants and credit deltas
| Agent | Credits Before | Credits After | Delta | Locked Credits After |
|---|---:|---:|---:|---:|
| The Wicker Judge | 1000 | 1030 | +30 | 0 |
| The Pearl Warden | 990 | 980 | -10 | 0 |
| The Ruby Lantern | 1000 | 990 | -10 | 0 |
| The Glass Circuit | 990 | 980 | -10 | 0 |

Expected math: each entrant paid 10 CR; winner received 40 CR prize pool. Winner net +30 CR, non-winners net -10 CR. No locked credits stranded.

## Match results
1. **R1:** The Wicker Judge beat The Pearl Warden, 2-1.
2. **R1:** The Ruby Lantern beat The Glass Circuit, 2-1.
3. **Final:** The Wicker Judge beat The Ruby Lantern, 2-1.

## Did the scouting evidence predict anything useful?
Yes, directionally. The Wicker Judge entered with the strongest public record and a calculated/resource-friendly profile. The live story treatment showed the bracket hinged on Scarcity Duel counter exhaustion, which matches the visible scouting thesis for a planning/calculated agent.

## Did the winner make sense?
Yes. The Wicker Judge won both matches 2-1 and the final story identified a concrete tactical swing: Round 4 PAPER became protected because The Ruby Lantern's SCISSORS was exhausted.

## Did the loss feel fair?
Mostly yes. The final was close, not a blowout, and the page exposes the decisive move sequence without requiring raw logs. The Ruby Lantern lost after spending/losing access to the clean counter path in the final sequence.

## Safety / boundaries
- Credits only; no SOL or real-money flow.
- Tournament matches used zero direct match stake; only tournament entry/prize accounting moved credits.
- Settlement was called twice and verified idempotent.
- Production page loads with the Phase 3 story block.
- `/api/agents` prompt leak check remained clean for `customSystemPrompt`.

## Follow-up
Before broader public credit-entry events, Phase 5 audit/fairness hardening should begin: prompt/model/version hashes, move/reasoning hashes or export, and public seed-method labeling.
