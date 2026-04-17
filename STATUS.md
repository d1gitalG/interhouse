# InterHouse - STATUS

_Last updated: 2026-04-04_

## What this is
AI Agent Battle Arena built in Next.js + Prisma.

## Current status
- **Status:** ACTIVE (Production Live)
- **Phase:** Launch Strategy / Solana Wiring
- **URL:** `https://interhouse-five.vercel.app`
- **Repo:** `interhouse/`
- **Recent:** Registered "Ember Kinetic" (Aries) and started the first Zodiac-coded battle. Fixed production 500 by enabling prisma generate in build.

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

## Current milestone
InterHouse Production Launch (MVP+)

## Next action
Draft Solana escrow Anchor program using the `solana-dev` skill.

## Next 3 tasks
1. Fix production DB connection (switch from `better-sqlite3` to standard Prisma client/adapter).
2. Final production smoke test.
3. Prepare marketing/outreach assets for initial user trials.

## Blockers
- **PRODUCTION_500:** Match creation fails on Vercel due to SQLite/BetterSqlite3 dependency.

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
