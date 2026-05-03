# InterHouse - QUEUE

_Last updated: 2026-05-03_

> Operating note: InterHouse is now **Paperclip-operated**. Paperclip runs the active team loop (CEO / PM / Engineer / QA). This queue remains the repo-side truth mirror and should be synced to meaningful Paperclip progress, not run as a duplicate execution lane.

- `IH-001` - `DONE` - Run the app locally and complete one end-to-end match test
  - **Done:** fresh local match `cmmiuq32p00005oiprz6slvnx` completed successfully; notes saved in `RUNTIME_TEST_2026-03-09.md`

- `IH-002` - `DONE` - Fix the first runtime issues discovered from the local match test
  - **Done:** Root cause was `GEMINI_API_KEY` missing from `interhouse/.env`. Added key to `.env`.
  - **Done:** Added explicit health signals (Provider Healthy/Fallback) to the match view UI to make provider degradation obvious during testing.

- `IH-003` - `DONE` - Re-open Solana/Series support in schema
  - **Done:** Updated `schema.prisma` with `Float` stake support, `User.credits` field, `solEscrowAddress` and `solSettledAt` fields.
  - **Done:** Made `AgentProfile.nftMint` optional to allow local testing without valid mint addresses.

- `IH-004` - `DONE` - Implement Series completion/winner logic in engine
  - **Done:** `lib/rps-engine.ts` resolves RPS rounds and determines series winners for `QUICK`/`BO3`/`BO5`.
  - **Done:** `app/api/matches/[matchId]/move/route.ts` records moves, resolves completed rounds, advances `currentRound`, finalizes completed series, updates agent W/L, and settles locked credit stakes.
  - **Done:** `app/api/matches/[matchId]/route.ts` returns the full match payload including `currentRound`.

- `IH-005` - `DONE` - Create CRUD endpoints for Agent Profiles
  - **Done:** Created `app/api/agents/[agentId]/route.ts` with GET, PATCH, and DELETE handlers.
  - **Done:** Implemented logic to prevent deleting agents currently in ACTIVE matches.

- `IH-008` - `DONE` - Post-series runtime verification (creation/moves/settlement)
  - **Done:** Verified match creation, move submission, and credit settlement via `/api/matches` and `/move` endpoints; match `cmmup483r0000ggipnwy6ivbx` resolved correctly.
  - **Note:** Discovered that provider fallback moves are still occurring; fixed in IH-009/010.

- `IH-010` - `DONE` - Post-series runtime verification (creation/moves/settlement)
  - **DoD:** match `cmmxyztw80000h8ip9bhopz8b` created, moves submitted, and credit settlement confirmed without provider fallback.
  - **Done:** Verified runtime in `RUNTIME_TEST_2026-03-18.md` (finished 03-19). Fixed `gemini-2.0-flash-lite` 404 issue. Verified credit balance updates.

- `IH-011` - `DONE` - Surface Agent Personality/Strategy in Match View
  - **DoD:** Agent card in `/match/[matchId]` shows `personality` (italic quote) and `strategy` (small text block) if available.
  - **Done:** Updated Prisma includes in match and spectate API routes. Updated `MatchPage` UI to render the new fields.

- `IH-013` - `DONE` - Implement basic match history filtering (by game or status) in the matches API
  - **Done:** Updated `GET /api/matches` to accept `game` and `status` query parameters for filtering.

- `IH-014` - `DONE` - Design 'Series Result' UI for match view
  - **DoD:** A visually distinct winner banner is shown when a match is COMPLETED, including final scores and payout details.
  - **Done:** Updated `app/match/[matchId]/page.tsx` with a high-impact winner section that animates in and uses house-specific colors.

- `IH-012` - `DONE` - Implement mock SOL escrow address generation
  - **DoD:** Matches created with `stakeMode: "SOL"` generate a random `solEscrowAddress` string and expose it in API payloads.
  - **Done:** Updated `POST /api/matches` to generate mock addresses. Updated `GET /api/matches/[matchId]` to include `solEscrowAddress` in the response.

- `IH-009` - `DONE` - Re-investigate the provider fallback issue
  - **Done:** Identified that Gemini's free-tier `generateContent` API requires the `systemInstruction` to be passed as a system-specific field OR concatenated into the user prompt for older models/tiers. Updated `agent-engine.ts` to concatenate instructions and use `gemini-1.5-flash` as the primary model. Verified matches now resolve with real AI reasoning.

- `IH-015` - `DONE` - Implement match history filtering in the frontend UI
  - **DoD:** Users can filter the lobby match list by Game and Status.
  - **Done:** Added `filterGame` and `filterStatus` states to `LobbyPage`. Updated `loadData` to pass these as query parameters to `/api/matches`. Added a filter UI section with dropdowns above the match list.

- `IH-016` - `DONE` - Add search by Agent ID to the match history API and UI
  - **DoD:** Users can filter the lobby match list by Agent ID in addition to Game and Status.
  - **Done:** Updated `GET /api/matches` to support `agentId` filtering via Prisma `some` on participants.
  - **Done:** Added `filterAgentId` search input to `LobbyPage` and wired it to the API fetch.

- `IH-017` - `DONE` - Add agent performance stats to the lobby (Top Agents by Wins)
  - **DoD:** Lobby UI displays a leaderboard of the top 4 agents sorted by win count.
  - **Done:** Added `wins` and `xp` to the `Agent` type in `LobbyPage`. Implemented a grid of "Top Agents" cards using existing agent data from `/api/agents`.

- `IH-018` - `DONE` - Add a "Recently Active" agent list to the lobby
  - **DoD:** Lobby shows a distinct "Recently Active" section, using recent `/api/matches` participants without backend schema changes.
  - **Done:** Added a new lobby section that derives unique recent agents from latest match participants and links each entry to that agent's most recent match.

- `IH-019` - `DONE` - Improve lobby match filtering UX to support agent name search
  - **DoD:** Users can search/filter match history by agent name (not just raw agent ID), mapped to existing agent records.
  - **Done:** Updated `LobbyPage` to use a `useMemo` filter that checks match ID, agent names, and agent houses against the search input. It still falls back to server-side `agentId` filtering if the input looks like a CUID.

- `IH-020` - `DONE` - Add compact participant chips to each lobby match row
  - **DoD:** Each match row in the lobby displays small badges/chips for both participants (name + house color) so users don't have to click through to see who is playing.
  - **Done:** Updated `app/lobby/page.tsx` match cards to render compact participant chips using existing participant+agent data, with house-color styling and fallback labels when agent metadata is missing.

- `IH-021` - `DONE` - Add match history sort controls (newest/oldest/highest stake)
  - **DoD:** Lobby match history can be sorted client-side without changing API contracts, with a clear default sort and no regression to existing filters.
  - **Done:** Added `sortOrder` state and UI select to `LobbyPage`. Updated `filteredMatches` memo to apply sorting by `createdAt` or `stakeAmount`.

- `IH-022` - `DONE` - Implement a basic search/filter for the Agent list in the lobby
  - **DoD:** Users can filter the Top Agents list or a separate full agent list by name/house.
  - **Done:** Added `agentSearch` state and a filter input to the "Top Agents" section in `LobbyPage`. Expanded the visible list to 8 agents and implemented real-time filtering by name, house, or ID.

- `IH-023` - `DONE` - Add 'Join Match' button to WAITING matches in the lobby
  - **Done:** Added "Join Match" button to WAITING match cards in `app/lobby/page.tsx`. Button is hidden for non-WAITING matches, shows "Joining…" loading state, POSTs to `/api/matches/[matchId]/join` with selected agent, reloads lobby on success, and shows error in existing error state.
  - **Also fixed:** Pre-existing TS errors in `app/api/matches/[matchId]/route.ts` — removed stale `personality`, `strategy`, and `solEscrowAddress` fields that don't exist in the Prisma schema.

- `IH-024` - `DONE` - Add optional house-based quick filters in the lobby
  - **Done:** Updated `GET /api/matches` to support `house` filtering via participant agent metadata.
  - **Done:** Added `filterHouse` state and a "House Filter" select dropdown to the Lobby Match History section. Wired it to the API call in `loadData`.

- `IH-025` - `DONE` - Implement agent profile detail view modal
- `IH-026` - `DONE` - Add a "House" leaderboard section
  - **Done:** Implemented client-side aggregate house standings in `app/lobby/page.tsx` using existing agent data. Displays total wins and agent count per house, sorted by wins.
- `IH-027` - `DONE` - Add total volume/stake stats to the lobby header
  - **Done:** Added `lobbyStats` memo to `LobbyPage` and integrated a compact stat display (Total Volume, Active Stakes) into the header.

- `IH-028` - `DONE` - Implement agent deletion in the profile modal
  - **Done:** Updated `AgentDetailModal` with a deletion flow, including confirmation state and API integration. Wired `onDeleted` callback in `LobbyPage` to refresh data on success. Verified prevention of deletion for agents in active matches via the existing API guard.

- `IH-029` - `DONE` - Create MVP+ launch-readiness checklist
  - **DoD:** Internal checklist exists that separates current launch-ready credits flow from known non-launch-ready SOL stubs and names the next risk-reduction pass.
  - **Done:** Added `LAUNCH_READINESS_CHECKLIST.md` covering product loop, runtime verification, lobby UX, risk/stub audit, and explicit non-launch-ready items.

- `IH-030` - `DONE` - Audit credits / reward loop for balance edge cases
  - **DoD:** create/join/settle/cancel coverage is reviewed and the real risk is written down in repo truth.
  - **Done:** Wrote `CREDITS_EDGE_CASE_AUDIT_2026-04-01.md`.
  - **Finding:** normal create/join/settle credits flow is transaction-safe enough for MVP+, but there is no explicit cancel/refund path for locked credit matches.

- `IH-031` - `DONE` - Implement explicit cancel/refund path for locked credit matches
  - **DoD:** a cancelled credits-staked match returns locked credits to both participants and cannot strand balances in `lockedCredits`.
  - **Done:** Added `refundLockedMatchStakeCredits` to `lib/credits.ts`. Created `POST /api/matches/[matchId]/cancel` endpoint to handle match cancellation and credit refunds.

- `IH-032` - `DONE` - Rerun MVP+ smoke test against `LAUNCH_READINESS_CHECKLIST.md` (verified 2026-04-03)
  - **DoD:** match `cmnizmnfq0002fgiptemf3zw4` created, joined, and resolved correctly in 1 tick. Verification note saved in `RUNTIME_TEST_2026-04-03.md`.

- `IH-033` - `DONE` - Public launch-readiness polish pass (copy, empty states, errors)
  - **DoD:** copy in Lobby and Match views is professionalized (Roadmap/Preview instead of "stubs"), and explicit "Preview" labels applied to non-live SOL paths.
  - **Done:** Updated `app/lobby/page.tsx` and `app/match/[matchId]/page.tsx` with refined messaging for the Solana roadmap and credits-only live state.

- `IH-034` - `DONE` - Create internal credit adjustment and balance check API endpoints
  - **DoD:** `GET /api/agents/[agentId]/credits` and `POST /api/agents/[agentId]/credits` are functional and verified.
  - **Done:** Created `app/api/agents/[agentId]/credits/route.ts`. Verified with `scripts/smoke-credits-api.ps1`.

- `IH-036` - `DONE` - Integrate Direct Match (Scrim/War) forms into Lobby UI
  - **DoD:** Users can create Scrim and War matches directly from the lobby without navigating to sub-pages.
  - **Done:** Updated `LobbyPage` to include a "Direct Match" toggle and integrated `CreateMatchForm` with styled Scrim/War switching. Polished `CreateMatchForm` components for consistent dark-theme lobby integration.

- `IH-037` - `DONE` - Surface agent credit balances in the Lobby and Match Creation UI
  - **DoD:** Agent credit balances are visible in the Top Agents list and in the match creation agent selectors.
  - **Done:** Updated `LobbyPage.tsx` and `CreateMatchForm.tsx` types and UI to include credit displays. Verified by reading from existing `AgentProfile` credit data in `/api/agents`.

- `IH-038` - `DONE` - Implement automated cleanup for stale matches
  - **Done:** Created `scripts/maintenance-cleanup.ts` to find and cancel matches (>2h PENDING, >24h ACTIVE).
  - **Done:** Skill codified in `workspace/skills/interhouse-maintenance/SKILL.md`.
  - **Done:** Scheduled cron to run every 4 hours. Initial sweep cleared 7 matches.

- `IH-040` - `DONE` - Production environment setup and Vercel deployment
  - **Done:** Deployed to `https://interhouse-five.vercel.app`. Added `prisma generate` and fixed TS errors.
  - **Verified 2026-04-17:** Live at URL.

- `IH-041` - `FAILED` - Final production smoke test (real match on live URL)
  - **Status:** Match creation (/api/matches) returns 500.
  - **Root Cause:** App uses `PrismaBetterSqlite3` adapter which is incompatible with Vercel's serverless runtime.
  - **Next:** Switch to Postgres or Turso for production.

- `IH-042` - `DONE` - Switch production DB from SQLite to serverless-compatible provider
  - **DoD:** App is provisioned with a Postgres (Vercel/Neon) or Turso DB. `lib/prisma.ts` updated to handle the chosen production provider. `DATABASE_URL` set in Vercel. Match creation verified live.
  - **Done:** Modified `lib/prisma.ts` so file-backed SQLite supplies the required Prisma v7 adapter during local production builds.
  - **Done:** Prepared the Postgres/Neon migration path: Prisma provider switched to Postgres, runtime client switched to `@prisma/adapter-pg`, SQLite/better-sqlite3 deps removed, and `db:push` script added.
  - **Verified 2026-04-24:** `npm run build` passes locally.
  - **Verified 2026-04-25:** Local production build passes with a Postgres-shaped `DATABASE_URL`.
  - **Done 2026-04-25:** Added Vercel `DATABASE_URL`, ran `npm run db:push` against Neon, redeployed production, and live-smoked match creation/join/tick successfully. Production 500 is fixed.

- `IH-043` - `DONE` - Fix Vercel Gemini provider auth
  - **DoD:** Production match tick uses provider-healthy Gemini reasoning instead of fallback reasoning.
  - **Status:** Live APIs and match flow are up, but Gemini calls still fall back. Attempted to refresh Vercel `GEMINI_API_KEY` from local/OpenClaw config on 2026-04-26; direct Google API test says the available key is expired/invalid.
  - **Done:** Gianni updated the Vercel key, Gemini JSON handling was tightened, production redeployed, and live match `cmog0ggbk000204l2p950qdlf` verified provider reasoning with `fallback=false`.

- `IH-044` - `DONE` - Create zodiac-coded exhibition agent pod
  - **DoD:** Production has a small set of distinctive agents generated from zodiac/persona rules, each with name, house, strategy profile, and custom prompt.
  - **Done:** Added `ZODIAC_EXHIBITION_POD.md`, created seed/run scripts, deployed agent create/update support for custom prompts and tier, seeded 12 agents, and ran 6 BO3 live matches with `fallback=false`.
  - **Results:** `ZODIAC_EXHIBITION_RESULTS_2026-04-26.md`.

- `IH-045` - `DONE` - Improve zodiac opener diversity / match context
  - **Finding:** Pod 001 works, but several agents converge on `ROCK` as a default first move.
  - **DoD:** Custom prompts include sign-specific opener tendencies that produce more varied first-round behavior without invalid moves or fallback reasoning.
  - **Done:** Upgraded the agent engine context with score, self/opponent prior moves, last-round outcome, explicit resource limits, repetition warnings, and creator/challenger symmetry advice.
  - **Verified:** Match `cmog2kd94000004jv53sdxbmo` completed with varied moves, resource-aware reasoning, and `fallback=false`.

- `IH-046` - `DONE` - Persona distinctness polish
  - **DoD:** Zodiac agents are not just mechanically varied; their reasoning and move choices feel clearly differentiated by archetype.
  - **Done:** Superseded/completed by the follow-on RPS strategy, character layer, engine-composed reasoning, and tournament showcase passes (`IH-047` through `IH-054`). Current active InterHouse next action is `IH-060`.

- `IH-047` - `DONE` - Add RPS rule-consistency guard
  - **Finding:** Agents had hard RPS rules in prompt context but could still produce reasoning where the named counter did not match the chosen move.
  - **Done:** Added explicit RPS rules, required `predictedOpponentMove`, increased Gemini output cap, and added an engine-level consistency correction: if an RPS prediction is provided and the selected move does not beat it, the engine switches to the legal counter when available.
  - **Verified:** Match `cmog380fp000004l4d713y5ci` completed with clearer counter logic and `fallback=false`.

- `IH-048` - `DONE` - Fix RPS last-round perspective and malformed JSON fallback ugliness
  - **Finding:** Gianni caught a Round 3→4 reasoning issue where an agent reversed who won/lost the prior round. Later verification also exposed malformed Gemini JSON producing visible fallback text.
  - **Done:** Last-round truth is now perspective-safe and prepended authoritatively to reasoning. JSON parser now extracts the first balanced object from noisy output. RPS model failures can recover with clean deterministic counter reasoning instead of exposing fallback errors.
  - **Verified:** Match `cmog3wa8q000004l5s409cpcl` completed with correct Round 3→4 reasoning, `fallback=false`, and no engine recovery needed.

- `IH-049` - `DONE` - Add deeper RPS strategy layer
  - **Done:** Added engine-side opponent modeling: move frequencies, after-draw tendency, first-order and second-order reads, score/resource pressure, exploit warnings, and persona-biased tactical intents.
  - **Agent output:** RPS agents now return/use `intent` and `confidence` alongside `predictedOpponentMove`; reasoning gets authoritative intent/counter context prepended.
  - **Verified:** Match `cmog4ok3k000004l780duqdj0` completed with `fallback=false` and `recovery=false`; moves showed intents like `high-risk-read`, `anti-mirror`, and `punish-repeat`.
  - **Follow-up:** Free-form prose can still mention alternate reads loosely; if this becomes annoying, store structured intent/confidence separately in DB/UI instead of relying only on reasoning text.

- `IH-050` - `DONE` - Add persona-aware opening priors / controlled uncertainty
  - **Done:** Replaced universal no-history ROCK prior with seeded persona-aware opener priors based on strategy profile plus name/custom prompt cues. Round 1 now gets an opening scout with weighted ROCK/PAPER/SCISSORS tendencies and a deterministic per-match seeded read.
  - **Verified:** 5-match batch completed with `fallback=false`/`recovery=false`. Openings varied across `SCISSORS/ROCK`, `PAPER/ROCK`, `ROCK/ROCK`, and `ROCK/SCISSORS` instead of collapsing into Paper/Paper every time.
  - **Observed:** Red Comet still wins most Red/Gilded rematches, but Gilded Blade picked up one clean win and match shapes are no longer identical.

- `IH-051` - `DONE` - Run 16-agent tournament smoke
  - **Done:** Added 4 real wildcard agents and ran a 16-agent single-elimination BO3 RPS bracket.
  - **Verified:** 15/15 matches completed with `fallback=false` and `recovery=false`.
  - **Champion:** The Granite Crown defeated The Twin Static in the final (`cmoga8hjl004a04l84twjhepu`).
  - **Report:** `TOURNAMENT_RESULTS_2026-04-26_16_AGENT.md`.

- `IH-052` - `DONE` - Add character layer / flaws / temperament
  - **Done:** Added derived duelist traits (`aggression`, `discipline`, `adaptability`, `deception`, `volatility`, `composure`), archetypes, flaws, behavior bias, and short voice cues to RPS match context.
  - **Purpose:** Make agents feel like consistent characters, not merely smarter optimizers.
  - **Verified:** Character Cup completed with `fallback=false`; The Ember Jackal beat The Granite Crown in the final (`cmogb5s1e001004jr24oy2vc2`).
  - **Report:** `CHARACTER_CUP_RESULTS_2026-04-26.md`.
  - **Follow-up:** Some prose still needs tightening (`discipline discipline`, occasional long/truncated lines). Next UI step should store/display structured traits, plan, read, and flaw separately from freeform reasoning.

- `IH-053` - `DONE` - Replace freeform RPS prose with engine reasoning composer
  - **Finding:** Gianni caught Granite saying “opponent repeated SCISSORS” in Round 2 when there was only one prior round. Root cause: model/freeform prose used `repeat` loosely from `punish-repeat` intent.
  - **Done:** Engine now composes visible RPS reasoning from validated state: `Last`, `Read`, `Plan`, and a short character action line. `punish-repeat` is displayed only when opponent actually repeated the same move across 2 prior rounds; otherwise it becomes `break-mirror` or `punish-read`.
  - **Also fixed:** Ember Jackal was inheriting Red Comet's `Tempo` cue because the red/pressure matcher was too broad; now Ember uses `Snap`.
  - **Verified:** Granite vs Ember rematch `cmogbsoz6000004laj9ojtc2x` completed with `fallback=false` and `badRepeat=false`.

- `IH-054` - `DONE` - Run BO5 32-agent tournament
  - **Done:** Created/seeded enough real duelists for a 32-agent field and ran a single-elimination BO5 production tournament.
  - **Champion:** The Obsidian Choir defeated The Ashen Oracle 3-2 in the final (`cmogc88jl00cm04juc451qwce`).
  - **Cleanliness:** 31/31 matches completed with `fallback=false` and `recovery=false`.
  - **Report:** `TOURNAMENT_RESULTS_2026-04-26_32_AGENT_BO5.md`.

- `IH-055` - `DONE` - First-class tournament prize-pool backend
  - **Finding:** The recent BO3/BO5 brackets were ad hoc match batches using normal per-match credit settlement; champions did not receive a tournament-wide pool.
  - **Done:** Added Tournament/TournamentEntry/TournamentMatch schema, tournament create/list/get/seed/advance/settle APIs, zero-stake bracket match creation, and idempotent winner-take-all final settlement.
  - **Integration check 2026-04-26 20:45 EDT:** `dev.db` was backed up/restored to tracked state. Prisma schema validates and `npm run build` passes with a Postgres-shaped `DATABASE_URL`.
  - **Migration:** Safe Postgres SQL prepared at `prisma/safe-migrations/20260427_tournament_prize_pool.postgres.sql`; full instructions in `SAFE_DB_MIGRATION_2026-04-26.md`.
  - **Safe branch verified 2026-04-26 21:22 EDT:** Applied schema to Neon child branch `tournament-smoke-2026-04-26`, built app against that branch DB, started local server, and ran `SMOKE_BASE_URL=http://localhost:3000 npm run smoke:tournament-prize-pool`. Result: PASS (`cmogin11i000400ipxgbv0sbp`), 100-credit prize pool, winner at 1075, losers at 975, all lockedCredits 0, repeat settle idempotent.
  - **Production verified 2026-04-27 08:16 EDT:** Production schema was pushed, compatible app code deployed to `https://interhouse-five.vercel.app`, `/api/tournaments` returned 200, and guarded production smoke passed (`cmoh5vri0000404jrm7o1ckk1`), 100-credit prize pool, winner at 1075, losers at 975, all lockedCredits 0, repeat settle idempotent.

- `IH-056` - `DONE` - Read-only tournament UX / visibility slice
  - **DoD:** Tournament list/detail states are visible and understandable from the UI, not just API/script-driven.
  - **Done 2026-04-27:** Created `TOURNAMENT_UX_NEXT_SLICE_DECISION.md` recommending a low-risk read-only tournament list/detail UX before admin controls or the first intentional public prize-pool bracket.
  - **Done 2026-04-30:** Implemented `/tournaments`, `/tournaments/[tournamentId]`, lobby/home entry points, and nav exits on major pages. Verified with `npm run lint` and `npm run build` using InterHouse Postgres env.

- `IH-057` - `DONE` - Minimal tournament operator/admin controls
  - **DoD:** Trusted operator can create, seed, advance, and settle tournaments from the app behind an explicit admin/safety gate; no public unsafe write controls are exposed.
  - **Done 2026-04-30:** Added shared `INTERNAL_SECRET` guard for tournament write APIs and reused it for credit adjustment API. Unauthenticated local `POST /api/tournaments` returns 401.
  - **Done 2026-04-30:** Added unlinked `/operator/tournaments` server-rendered panel. Unlock uses an internal secret form that sets an httpOnly sameSite operator cookie; controls call tournament library functions server-side so the secret is not exposed to client JS.
  - **Verified production 2026-04-30:** `/tournaments` and `/operator/tournaments` returned 200; unauthenticated tournament create returned 401; authenticated create returned 201 after Vercel `INTERNAL_SECRET` redeploy.
  - **First operator bracket:** `First Operator Cup 2026-04-30` (`cmol3pvi4000004jyq3czpnt4`) completed and settled; champion The Ember Jackal.

- `IH-058` - `DONE` - Restore non-fallback agent reasoning after operator bracket
  - **Finding:** First operator bracket mechanically worked, but every move used fallback reasoning with `INVALID_AGENT_JSON`.
  - **Done 2026-04-30:** Deployed hardened Gemini JSON path, balanced JSON extraction, tactical context, RPS consistency/recovery, and composed reasoning.
  - **Verified production 2026-04-30:** Brain smoke match `cmol3zjt3000004l7nj3fw0pp` completed with 8 moves and `badCount=0`; no fallback or `INVALID_AGENT_JSON` reasoning.
  - **Next:** Run the next showcase bracket now that provider reasoning is healthy again.


- `IH-059` - `DONE` - Spectator legitimacy polish pass
  - **Source:** Review-board feedback said InterHouse should make informed backing feel legitimate before pushing real-money/backing.
  - **Done 2026-05-01:** Added shared public format labels/explainers (`Scarcity Duel`, `Championship Series`, `Quick Clash`) and surfaced them on tournament list/detail and match pages.
  - **Done 2026-05-01:** Upgraded tournament detail with champion path, final scoreline, key resource-trap/key constraint moment, and per-match key-moment callouts.
  - **Done 2026-05-01:** Upgraded match view with a spectator guide, Creator/Challenger role explanation, participant role chips, and correct per-series RPS resource limits in the participant resource display.
  - **Verified:** `npm run lint` passed. Postgres-env `npm run build` passed. Commit `a68bc9d` pushed to `master`; Vercel deployment completed. Production smoke loaded `/tournaments` and `/tournaments/cmomlao550000nlipprgqllig` and found the new `Tournament Archive`, `Scarcity Duel`, and `Champion Path` UI copy.
  - **Next:** Add agent scouting/backing evidence cards before treating credit-backed public brackets as the main milestone.

- `IH-060` - `DONE` - Agent scouting/backing evidence cards
  - **Source:** `REVIEW_BOARD_ACTION_PLAN_2026-05-01.md` Phase 2.
  - **Goal:** A user can compare agents and say, “I would back this one because…” before opening raw logs.
  - **DoD:** Tournament entrant cards expose tactical identity, flaw, preferred format, recent record, resource behavior, trap tendency, and evidence/caveat chips. Existing agent profile/detail surfaces the same scouting summary. Matchup cards make backing reasoning possible before full log reading.
  - **Verification:** `npm run lint`, Postgres-env `npm run build`, and production smoke on a known tournament page after deploy.

- `IH-061` - `DONE` - Tournament story depth
  - **Source:** `REVIEW_BOARD_ACTION_PLAN_2026-05-01.md` Phase 3.
  - **Goal:** Completed brackets feel like sports recaps, not database records.
  - **Done 2026-05-03:** Upgraded the completed-tournament recap above the fold with a “why this bracket mattered” headline, data-derived Format Takeaway, Key Match marker, conservative upset watch, finalist path cards for champion/runner-up, and an advanced match-by-match log hidden behind a native density toggle.
  - **Privacy:** Keeps existing prompt/private-playbook protections intact; the story layer uses public match, move, seed, score, and derived scouting data only.
  - **Verified:** `npm run lint` passed. Postgres-shaped `DATABASE_URL` `npm run build` passed.
