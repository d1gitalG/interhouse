# InterHouse - STATUS

_Last updated: 2026-04-30_

## What this is
AI Agent Battle Arena built in Next.js + Prisma.

## Current status
- **Status:** ACTIVE (Production Live - Tournament Prize Pools Verified)
- **Phase:** Tournament visibility/operator controls deployed; agent reasoning fallback fixed; ready for next showcase bracket.
- **URL:** `https://interhouse-five.vercel.app`
- **Repo:** `interhouse/`
- **Recent:** Deployed guarded `/operator/tournaments`, ran first operator bracket (`cmol3pvi4000004jyq3czpnt4`, champion The Ember Jackal), then fixed deployed agent fallback issue. Production brain smoke `cmol3zjt3000004l7nj3fw0pp` completed with 8 moves and no fallback/`INVALID_AGENT_JSON` reasoning.
- **Safe-branch smoke 2026-04-26 21:22 EDT:** Applied tournament schema to Neon child branch `tournament-smoke-2026-04-26`, built the app against that branch DB, started local Next server, and ran `SMOKE_BASE_URL=http://localhost:3000 npm run smoke:tournament-prize-pool`. Smoke passed: tournament `cmogin11i000400ipxgbv0sbp`, prize pool 100, champion paid 1075, losers stayed 975, all `lockedCredits=0`, repeat settle idempotency passed.
- **Production smoke 2026-04-27 08:16 EDT:** Production schema was pushed, compatible app code deployed, `/api/tournaments` returned 200, and guarded smoke passed against `https://interhouse-five.vercel.app`: tournament `cmoh5vri0000404jrm7o1ckk1`, prize pool 100, champion `cmoh5vrbu000204jr40goc2yz` paid 1075, losers stayed 975, all `lockedCredits=0`, repeat settle idempotency passed.

## Done
- MVP is build-clean
- Core routes, Prisma models, UI flows, and credit settlement are wired
- Series completion and winner resolution are wired for match move processing
- Project is locally runnable
- Fresh local match test completed successfully (`cmnn9x6w300021kipizsaa35f`, verified 2026-04-06)
- Provider integration fixed: `GEMINI_API_KEY` added to `.env`; real agent reasoning verified in match `cmmiuw9w3000c60ip66127w3x`
- Added explicit health signals (Provider Healthy/Fallback) to the match view UI
- Created Agent Profile CRUD endpoints (`/api/agents/[agentId]`) to support future profile management.
- Added Solana wallet/escrow stub UI to match creation and match view without enabling real wallet integration.
- Refined agent reasoning display with an "Expand/Collapse" toggle and compact default view.
- Added explicit error logging to `agent-engine.ts` for fallback reasoning to aid debugging.
- Fixed 404 issue with `gemini-2.0-flash-lite-preview-02-05` by removing it from the candidate list in `agent-engine.ts`.
- IH-012: Implemented mock SOL escrow address generation and API exposure for SOL-marked matches.
- IH-010: Final runtime verification complete. Match `cmmxyztw80000h8ip9bhopz8b` resolved correctly.
- IH-011: Surfaced agent personality and strategy in the Match View UI.
- IH-013: Implement basic match history filtering (by game or status) in the matches API.
- IH-014: Designed and implemented the 'Series Result' UI for the match view.
- IH-015: Implemented match history filtering in the frontend UI (Lobby).
- IH-016: Added search by Agent ID to the match history API and UI.
- IH-017: Implemented 'Top Agents by Wins' leaderboard in the Lobby UI.
- IH-018: Added a distinct 'Recently Active' lobby section.
- IH-019: Improved lobby match filtering UX to support agent name and house search.
- IH-020: Added compact participant chips to each lobby match row.
- IH-021: Added match history sort controls to the Lobby UI.
- IH-022: Implement a basic search/filter for the Agent list in the lobby.
- IH-023: Added 'Join Match' button to WAITING matches in the lobby.
- IH-024: Added a House Filter dropdown to the Lobby Match History section (API + UI).
- IH-025: Implemented agent profile detail view modal.
- IH-026: Added a "House" leaderboard section to the Lobby UI.
- IH-027: Added total volume and active stake stats to the Lobby header (connected to recent match data).
- IH-028: Implemented agent deletion in the profile modal with confirmation state and API integration.
- IH-031: Implement explicit cancel/refund path for locked credit matches (verified).
- IH-032: Rerun MVP+ smoke test against `LAUNCH_READINESS_CHECKLIST.md` (verified 2026-04-03).
- IH-033: Public launch-readiness polish pass (copy, empty states, error messaging) completed.
- IH-034: Created internal credit adjustment and balance check API endpoints (verified).
- IH-035: Pre-deployment smoke test successful. Verified the core RPS credits-based match flow. (verified 2026-04-06)
- IH-037: Surface agent credit balances in the Lobby and Match Creation UI.
- IH-038: Implement automated cleanup for stale matches via OpenClaw cron.
- IH-039: Move match tick logic to an OpenClaw cron (matches now progress autonomously).
- IH-040: Production environment setup and Vercel deployment (verified live 2026-04-17).
- **2026-04-17 10:20 EDT:** Production smoke test failed. Match creation (/api/matches POST) returns 500. Console shows "Unexpected end of JSON input". Likely cause: `lib/prisma.ts` hardcoded to `PrismaBetterSqlite3` which is incompatible with Vercel/Serverless and expects a local filesystem.
- **2026-04-24:** Local production build fixed/verified after updating `lib/prisma.ts` so file-backed SQLite still supplies the required Prisma v7 adapter during build. Production still requires a serverless-compatible DB/provider before live Vercel match creation is fixed.
- **2026-04-25:** Neon/Postgres production setup completed: Vercel `DATABASE_URL` added, `npm run db:push` synced Neon, production redeployed to `https://interhouse-five.vercel.app`, and live smoke verified `GET /api/matches`, `GET /api/agents`, live agent creation, live match creation, join, and tick. Production 500 is fixed.
- **2026-04-26:** Replaced Vercel `GEMINI_API_KEY` from available local/OpenClaw config and redeployed production. Live smoke still falls back; direct Google API test reports the available key is expired/invalid.
- **2026-04-26:** Gianni updated Vercel with a fresh Gemini key. Tightened Gemini prompt/JSON handling (`responseMimeType`, higher max output, Gemini 2.0 Flash first), redeployed production, and verified live match `cmog0ggbk000204l2p950qdlf` completed with provider reasoning and `fallback=false`.
- **2026-04-26:** Seeded Zodiac Exhibition Pod 001 (12 zodiac-coded agents), deployed API support for custom prompts/tier on agent create/update, ran 6 live BO3 exhibition matches, and verified all completed with `fallback=false`. Results saved in `ZODIAC_EXHIBITION_RESULTS_2026-04-26.md`.
- **2026-04-26:** Fixed repetitive/confused move reasoning by passing structured tactical context into the agent engine: self/opponent previous moves, score, last-round outcome, explicit resource limits, repetition warnings, and creator/challenger symmetry advice. Verification match `cmog2kd94000004jv53sdxbmo` completed with varied moves and no fallback.
- **2026-04-26:** Added hard RPS rules/counter context plus `predictedOpponentMove` parsing and consistency correction in `agent-engine.ts`. Verification match `cmog380fp000004l4d713y5ci` completed with clearer counter logic and `fallback=false`.
- **2026-04-26:** Fixed last-round perspective confusion and parser brittleness. Verification match `cmog3wa8q000004l5s409cpcl` completed with correct Round 3→4 reasoning, no fallback text, and no engine recovery needed.
- **2026-04-26:** Added deeper RPS strategy layer: opponent move frequencies, after-draw tendency, first/second-order reads, score/resource pressure, persona-biased intent suggestions, parsed `intent`/`confidence`, and primary-prediction guardrails. Verification match `cmog4ok3k000004l780duqdj0` completed with `fallback=false`/`recovery=false` and visible intents like `high-risk-read`, `anti-mirror`, and `punish-repeat`.
- **2026-04-26:** Added persona-aware seeded opening priors. Verification batch of 5 matches produced varied openings (`SCISSORS/ROCK`, `PAPER/ROCK`, `ROCK/ROCK`, `ROCK/SCISSORS`) with `fallback=false`/`recovery=false`; one Gilded Blade win and four Red Comet wins. Latest sample match IDs: `cmog5sjfo000004ktbgqim27e`, `cmog5sobc000a04ktf94jln6y`, `cmog5stli000604ld83gatnkb`, `cmog5sxrn000i04ldkmvheonj`, `cmog5t0ny000s04ldfghlvery`.
- **2026-04-26:** Ran 16-agent tournament with 12 zodiac agents + 4 wildcard agents. All 15 BO3 RPS matches completed with `fallback=false`/`recovery=false`. Champion: The Granite Crown. Final: The Granite Crown defeated The Twin Static 2-1 (`cmoga8hjl004a04l84twjhepu`).
- **2026-04-26:** Added derived character layer (traits: aggression/discipline/adaptability/deception/volatility/composure; flaws like overcommit, overmirror, chaos-break, rigidity; voice cues like Tempo/Hold/Answered/Static shift). Deployed and ran Character Cup. Champion: The Ember Jackal, beating The Granite Crown in final (`cmogb5s1e001004jr24oy2vc2`). Report: `CHARACTER_CUP_RESULTS_2026-04-26.md`.
- **2026-04-26:** Added engine-side RPS reasoning composer to prevent awkward/freeform prose. Verified Granite vs Ember rematch `cmogbsoz6000004laj9ojtc2x`: `fallback=false`, no invalid Round 2 repeat language, and Ember correctly uses `Snap` instead of inheriting Red Comet's `Tempo` cue.
- **2026-04-26:** Ran BO5 32-agent single-elimination tournament. Champion: The Obsidian Choir. Final: The Obsidian Choir defeated The Ashen Oracle 3-2 (`cmogc88jl00cm04juc451qwce`). Full report: `TOURNAMENT_RESULTS_2026-04-26_32_AGENT_BO5.md`.
- **2026-04-26:** Added first-class tournament backend foundation: `Tournament`, `TournamentEntry`, and `TournamentMatch` Prisma models; create/list/get/seed/advance/settle API routes; zero-stake match creation for bracket matches; and idempotent winner-take-all tournament settlement. Prepared safe Postgres migration SQL and 4-agent prize-pool smoke; safe Neon child-branch migration/smoke passed.

## Current milestone
InterHouse Production Launch (MVP+)

## Next action
Run the next showcase bracket now that operator controls and non-fallback agent reasoning are live.

## Next 3 tasks
1. Run a fresh 4-agent or 8-agent showcase bracket and verify public bracket/match pages show non-fallback reasoning.
2. Add spectator polish: champion card, bracket recap, and active/completed tournament grouping.
3. Decide whether the next public bracket should include a real credit entry fee/prize pool.

## Blockers
- None for the tournament prize-pool backend foundation.

## Definition of done
- Fresh local match completes
- Agent moves come from healthy provider responses
- Runtime note is updated with verified post-fix result
- Current milestone work is understandable, verified, and reflected in repo truth files

## Related docs
- `RUNTIME_TEST_2026-03-09.md`
- `LAUNCH_READINESS_CHECKLIST.md`
- `../idea-to-reality/STATUS_INTERHOUSE.md`
- `../idea-to-reality/MVP_PRD_LITE_interhouse.md`
- `../idea-to-reality/AGENT_SYSTEM_SPEC.md`
- `TOURNAMENT_UX_NEXT_SLICE_DECISION.md`
