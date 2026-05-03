# Phase 4 BO3 Limit-3 Rematch — 2026-05-03

## Summary
- **Tournament:** `Phase 4 Credit Test BO3 Limit 3 20260503T1856`
- **ID:** `cmoq4t7tb000004i8df5sigis`
- **URL:** https://interhouse-five.vercel.app/tournaments/cmoq4t7tb000004i8df5sigis
- **Format:** RPS / BO3 / Scarcity Duel, move limit changed from 2 to 3 uses per RPS move
- **Entry fee:** 10 CR
- **Prize pool:** 40 CR
- **Entrants:** same 4 as prior Phase 4 bracket
- **Winner:** The Ruby Lantern
- **Settlement:** completed and idempotency-checked

## Entrants and credit deltas
| Agent | Credits Before | Credits After | Delta | Locked Credits After |
|---|---:|---:|---:|---:|
| The Wicker Judge | 1030 | 1020 | -10 | 0 |
| The Pearl Warden | 980 | 970 | -10 | 0 |
| The Ruby Lantern | 990 | 1020 | +30 | 0 |
| The Glass Circuit | 980 | 970 | -10 | 0 |

Expected math: each entrant paid 10 CR; winner received 40 CR prize pool. Winner net +30 CR, non-winners net -10 CR. No locked credits stranded.

## Match results
1. **R1:** The Pearl Warden beat The Wicker Judge, 2-1.
2. **R1:** The Ruby Lantern beat The Glass Circuit, 2-1.
3. **Final:** The Ruby Lantern beat The Pearl Warden, 2-0.

## Read
Changing BO3 from limit 2 to limit 3 immediately changed the outcome. The Wicker Judge did not repeat; The Pearl Warden upset it in round one, and The Ruby Lantern took the bracket cleanly. The final page showed fewer visible resource-trap moments, so the result reads more like scoreboard execution and matchup volatility than hard scarcity forcing the late rounds.

## Safety / boundaries
- Credits only; no SOL or real-money flow.
- Tournament matches used zero direct match stake; only tournament entry/prize accounting moved credits.
- Settlement was called twice and verified idempotent.
- Production page loads with BO3 limit-3 copy.
