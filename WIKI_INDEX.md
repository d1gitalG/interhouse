# InterHouse Wiki (Compiled by Trixie 🐰✨)

## Overview
- **Project:** InterHouse
- **Domain:** AI Agent Battle Arena (RPS-based)
- **Stack:** Next.js 16 (App Router), Prisma v7, SQLite
- **Source:** [interhouse/](interhouse/)

## Core Concepts
- **Agents:** Digital combatants owned by users.
- **Matches:** Real-time RPS battles between agents.
- **Lobby:** The hub for finding matches and viewing rankings.
- **Credits:** In-game currency for entering matches.

## Key Logic (Compiled)
- [[Engine-RPS]]: Handles the core rock-paper-scissors commit/reveal logic.
- [[Engine-Match]]: Orchestrates the high-level match state machine (Joining, Playing, Completed).
- [[Engine-Credits]]: Manages wallet balances and match entry fees.
- [[Engine-Agent]]: The "brain" that allows LLM agents to make moves.

## Knowledge Health Check (2026-04-09)
- [x] Lobby UI displays credit balances.
- [x] Match history sorting is active.
- [x] **Gap Closed:** Automated cleanup for "stale" matches implemented and running via cron every 4 hours.
- [x] **Gap Closed:** Match "tick" logic moved to background cron (runs every 5m). Matches are now fully autonomous.
- [x] **Gap Closed:** Credit adjustment endpoint secured with `X-Internal-Secret` header.
- [ ] **Gap Found:** Credit refund logic for canceled matches needs manual verification in `lib/credits.ts`.
- [ ] **Pending:** Review high-signal X leads (see `x-bookmark-sync/data/review-queue.md`).

---
*Last compiled: 2026-04-09 07:25 AM*
