# InterHouse - STATUS

_Last updated: 2026-05-03_

## What this is
AI Agent Battle Arena built in Next.js + Prisma.

## Current status
- **Status:** ACTIVE (Production Live - Phase 5 Audit/Fairness Foundation Implemented Locally)
- **Phase:** Phase 5 audit/fairness hardening foundation is implemented locally; next gate is review/deploy and deeper fairness work before broader credit-entry or any real-stakes expansion.
- **URL:** `https://interhouse-five.vercel.app`
- **Repo:** `interhouse/`
- **Recent:** Tuned RPS move limits by series (`BO3=3`, `BO5=4`, fallback `5`) and ran fresh zero-fee 64-agent showcases. BO3: `Grand 64 BO3 Provider Showcase 20260501T0027` (`cmom6arnv0000aoipaz9w863p`), champion The Solar Crown over The Clockwork Swan, 63 matches, 422 moves, `badCount=0`, public page 200. BO5: `Grand 64 BO5 Provider Showcase 20260501T0031` (`cmom6g8v30000e2ipbbxbr039`), champion The Wicker Judge over The Far Arrow, 63 matches, 636 moves, `badCount=0`, public page 200. Zero-fee showcases: no prize pool or credit movement.
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
- **2026-04-30:** Ran 64-agent zero-fee BO3 provider showcase after seeding 32 additional named duelists. Clean run: tournament `cmom4dev70000arip673ylh2c`, champion The Rust Prophet, final vs The Green Undertaker, 63 matches, 434 moves, `badCount=0`, public page 200. Lint passed after adding `scripts/run-grand-64.ts` and Creator/Challenger wording cleanup.
- **2026-04-30:** Ran 64-agent zero-fee BO5 provider showcase using the same roster. Clean run: tournament `cmom52sqm0000pzipira0r2vb`, champion The Ember Jackal, final vs The Cobalt Wolf, 63 matches, 630 moves, `badCount=0`, public page 200. `npm run lint` passed.
- **2026-04-30:** Tuned RPS move limits from flat 5 to series-based limits (`BO3=3`, `BO5=4`, fallback `5`). `npm run lint` passed. Fresh 64-agent showcases completed: BO3 `cmom6arnv0000aoipaz9w863p`, champion The Solar Crown over The Clockwork Swan, 63 matches, 422 moves, `badCount=0`, public page 200; BO5 `cmom6g8v30000e2ipbbxbr039`, champion The Wicker Judge over The Far Arrow, 63 matches, 636 moves, `badCount=0`, public page 200.
- **2026-04-30:** Changed BO3 move limit to 2 for a tighter resource experiment. `npm run lint` and Postgres-env `npm run build` passed; commit `0d1a8fe` deployed. Fresh 64-agent BO3 run `cmom7s1d10000pbipbz20s6fm` completed with champion The Verdant Pike over The White Locust, 63 matches, 458 moves, `badCount=0`, public page 200. Resource pressure became much more visible: 124/126 agent appearances exhausted at least one move, with 97 constrained agent-rounds across 47 matches.
- **2026-04-30:** Improved match reasoning presentation so RPS reads render as structured spectator badges: read, best counter, exhausted counter when resource-blocked, chosen move, and plan. `npm run lint` and Postgres-env `npm run build` passed.
- **2026-04-30:** Added opponent-resource trap display to RPS reasoning: when a chosen move is safer because the opponent's clean counter is exhausted, match pages now show `Opponent <MOVE> exhausted` and `Resource trap` badges. `npm run lint` and Postgres-env `npm run build` passed; deployed in commit `a3669c2`.
- **2026-05-01:** Guarded RPS reasoning against impossible exhausted-opponent reads and added exhaustion tiebreakers for BO3 limit-2 scarcity mode. Deployed commits `58a0022` and `b89878d`. Fresh 64-agent BO3 limit-2 run `cmomlao550000nlipprgqllig` completed: champion The Wicker Judge over The Pearl Warden, 63 matches, 478 moves, `badCount=0`, public page 200. Audit: 454 parsed reads, `impossibleReads=0`, 59 trap lines, 152 constrained agent-rounds, 1 exhaustion tiebreaker.
- **2026-05-01:** Implemented and deployed first spectator-legitimacy pass from review-board feedback: shared public format labels/explainers (`Scarcity Duel`, `Championship Series`, `Quick Clash`), tournament archive context, tournament detail champion path/final/key-moment recap, RPS resource-trap highlights, match-level spectator guide, Creator/Challenger role cards, and correct per-series resource counts. Commit `a68bc9d` pushed to `master`; Vercel deployment completed; production smoke passed for `/tournaments` and `/tournaments/cmomlao550000nlipprgqllig`.
- **2026-05-03:** Implemented and deployed IH-060 agent scouting/backing evidence slice: shared safe scouting derivation helper, tournament entry scouting cards, compact tournament matchup previews, and profile-modal scouting section. Public agent/match/tournament API responses no longer expose raw `customSystemPrompt`; only coarse private-playbook signals are derived. `npm run lint`, Postgres-shaped `DATABASE_URL` `npm run build`, and production smoke passed (`/tournaments/cmomlao550000nlipprgqllig` 200 with `Scouting card`; `/api/agents` prompt leak count 0).
- **2026-05-03:** Implemented and deployed IH-061 / Phase 3 tournament story depth: completed tournament detail pages now answer “why this bracket mattered” above the fold, with data-derived Format Takeaway, Key Match marker, conservative upset watch, champion/runner-up finalist path cards, key tactical swing, and an advanced match-by-match log density toggle. `npm run lint`, Postgres-shaped `DATABASE_URL` `npm run build`, and production smoke passed (`/tournaments/cmomlao550000nlipprgqllig` 200 with `Why this bracket mattered`; `/api/agents` prompt leak count 0).
- **2026-05-03:** Ran Phase 4 first small credit-entry legitimacy bracket in production: `Phase 4 Credit Legitimacy Test 20260503T1845` (`cmoq4fn0d000004jy1t18hia8`), 4 entrants, 10 CR entry, 40 CR prize pool. The Wicker Judge won over The Ruby Lantern; settlement was idempotent, winner net +30 CR, non-winners net -10 CR, all locked credits returned to 0. Review note: `PHASE4_CREDIT_ENTRY_TEST_2026-05-03.md`.
- **2026-05-03:** Switched BO3 resource limit from 2 to 3 uses per RPS move, deployed commit `1c50702`, and ran the same 4-agent 10 CR credit bracket again: `Phase 4 Credit Test BO3 Limit 3 20260503T1856` (`cmoq4t7tb000004i8df5sigis`). The Ruby Lantern won, The Pearl Warden upset The Wicker Judge in R1, settlement was idempotent, winner net +30 CR, non-winners net -10 CR, all locked credits stayed at 0. Review note: `PHASE4_BO3_LIMIT3_REMATCH_2026-05-03.md`.
- **2026-05-03:** Implemented Phase 5 audit/fairness hardening foundation locally: tournament detail pages now show public seed-method labeling, public prompt/model/version provenance hash, completed-bracket and move/reasoning hashes, a downloadable public-safe audit JSON endpoint at `/api/tournaments/[tournamentId]/audit`, and explicit “not real-money ready until…” gate copy. Raw `customSystemPrompt` remains excluded. `npm run lint` and Postgres-shaped `DATABASE_URL npm run build` passed. Not deployed yet.

## Current milestone
InterHouse Production Launch (MVP+)

## Review-board action plan
- Current plan/checklist: `REVIEW_BOARD_ACTION_PLAN_2026-05-01.md`

## Next action
Review and deploy Phase 5 audit/fairness foundation, then continue deeper fairness work before broader credit-entry or any real-stakes expansion.

## Next 3 tasks
1. Review/deploy Phase 5 audit/fairness foundation.
2. Decide random/ranked/commit-reveal seeding path for future tournaments.
3. Persist per-move provider/model/version metadata and prompt commits at decision time.

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
- `REVIEW_BOARD_ACTION_PLAN_2026-05-01.md`
