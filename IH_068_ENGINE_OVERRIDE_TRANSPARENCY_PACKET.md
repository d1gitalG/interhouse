# IH-068 — Engine Override Transparency Implementation Packet

_Status: READY_
_Date: 2026-07-02_
_Author: Claude (architect lane), for Codex execution_
_Source decisions:_
- Dual-track plan 2026-07-02: BYO-agent competition requires the engine's move-enforcement layer to be disclosed, not hidden.
- `IH-067_IMPLEMENTATION_2026-07-02.md` (prior slice receipt)

## Objective

Make the agent engine's move-enforcement layer (`enforceMirrorAsymmetry`, `enforceOpponentPredictionLegality`, `enforceRpsPredictionConsistency`, deterministic recovery/fallback) an audited, disclosed part of the ruleset instead of a silent rewrite. This is the trust prerequisite for any future bring-your-own-agent competition.

Implementation scope only. No production deploy, no production DB changes, no real-money/SOL language, no BYO-agent UI (that is a later slice).

## What was true before this slice

- `lib/agent-engine.ts` `getAgentMove()` runs the model's parsed move through enforcement functions that can replace the move, the predicted opponent move, the intent, and the reasoning text. The final persisted move does not record what the model originally chose or which rule fired.
- Move provenance (IH-065A) records provider/model/prompt hashes but not enforcement outcomes.

## Target changes

1. `lib/agent-engine.ts`
   - Thread an override trail through the enforcement pipeline: capture the model's raw parsed move (`rawMove`) and, when any enforcement function changes the move, record the rule name that fired (`overrideRule`, one of: `MIRROR_ASYMMETRY`, `OPPONENT_PREDICTION_LEGALITY`, `PREDICTION_CONSISTENCY`, `ENGINE_RECOVERY`, `ENGINE_FALLBACK`). If multiple fire, record the last one that changed the move.
   - Extend `AgentMoveResult` with `rawMove: string | null` and `overrideRule: string | null` (null when the model's move was used unchanged).
   - Do not change any enforcement behavior itself in this slice. Disclosure first, rebalancing later.

2. `prisma/schema.prisma` + new migration dir under `prisma/migrations/`
   - Add nullable `rawMove String?` and `overrideRule String?` to `Move`, following the pattern of `20260512102000_move_audit_provenance`.
   - Nullable so legacy moves remain readable. No other schema changes.

3. Move persistence paths (`lib/tick-logic.ts`, `app/api/matches/[matchId]/move/route.ts`, and any other path that persists engine-produced moves — inspect `lib/series-engine.ts` and tournament match flows)
   - Persist `rawMove` and `overrideRule` on every new engine-produced move.

4. `lib/tournament-audit.ts`
   - Include `rawMove` and `overrideRule` in the per-move audit export and extend the move hash coverage to include them, following the IH-065A precedent (keep `exportVersion=interhouse-tournament-audit-v1`; additive fields, hash coverage extended).
   - These fields are public-safe (moves are ROCK/PAPER/SCISSORS strings and rule names; no prompt content).

5. Public engine policy copy
   - Add a short "Engine policy" block to the tournament detail page fairness section (`app/tournaments/[tournamentId]/page.tsx`, near the existing fairness copy) stating, conservatively: agent moves come from AI providers; a deterministic rules layer enforces move legality and logical consistency; every enforcement action is recorded per move and included in the audit export.
   - Wording must NOT say: real-money safe, SOL, KYC, fraud-proof, tamper-proof, Sybil-resistant.

6. Smoke coverage
   - Extend `scripts/smoke-commit-reveal.js` (or add `scripts/smoke-override-transparency.js` if cleaner) to assert that the audit export's move entries contain the `rawMove`/`overrideRule` keys (values may be null) and still contain no `customSystemPrompt` pattern.

## Acceptance criteria

1. A match played end-to-end persists `rawMove` and `overrideRule` on engine-produced moves; `overrideRule` is null when no enforcement changed the move.
2. Legacy moves (null new fields) still render and audit-export cleanly.
3. Audit export includes the new fields with hash coverage; `exportVersion` unchanged; no prompt leakage.
4. Engine behavior (which move is ultimately chosen) is bit-identical to before this slice — disclosure only.
5. Public copy added, conservative wording only.
6. `npm run lint` and Postgres-shaped `npm run build` pass.

## Verification gates

- `npm run lint`
- `npx tsc --noEmit`
- `DATABASE_URL='postgresql://user:pass@localhost:5432/interhouse' npm run build`
- Live smokes (run by reviewer, throwaway Postgres): eligibility, prize-pool, commit-reveal, plus the new override-transparency assertion.

## Approval gates (unchanged from IH-067)

Production deploy, production DB push, external copy changes on live properties, real-money/SOL/wagering claims — all require Gianni.
