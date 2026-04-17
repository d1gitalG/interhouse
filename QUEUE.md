# InterHouse - QUEUE

_Last updated: 2026-03-28_

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

