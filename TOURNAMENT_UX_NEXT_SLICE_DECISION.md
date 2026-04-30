# InterHouse Tournament UX — Next Slice Decision

_Last updated: 2026-04-27_

## Context
Tournament prize-pool backend is live and production-smoked. Current gap: brackets are mostly API/script-operated, so a user/operator cannot easily see what exists, understand prize state, or follow bracket progress from the app.

## Recommendation
Ship a **minimal public tournament bracket display** before a full admin panel or first intentional public prize-pool bracket.

Why this first:
- It exposes the backend work without adding risky write/admin paths.
- It gives Gianni a visible product surface to review before real public money/credit events.
- It creates the foundation a future operator/admin panel can link into.
- It is lower-risk than running the first public bracket while the UX is still invisible.

## Proposed slice
Create read-only tournament pages:

1. **Tournament list**
   - Route: `/tournaments`
   - Shows recent tournaments with status, entry count, prize pool, champion if settled, and created date.
   - Empty state: explain that prize-pool brackets are ready but no public brackets are live yet.

2. **Tournament detail / bracket view**
   - Route: `/tournaments/[tournamentId]`
   - Shows tournament metadata, entries, bracket rounds, match links, current status, prize pool, winner/champion, and settlement state.
   - Read-only for now; no create/settle buttons.

3. **Lobby entry point**
   - Add a small lobby card/link: “Prize-Pool Tournaments”.

## Acceptance criteria
- App builds cleanly.
- `/tournaments` loads against production-shaped data.
- A known smoke tournament detail page renders entries/matches/prize/champion without requiring scripts.
- No new public write actions are exposed.
- Existing lobby and match flows are unchanged.

## Later slices
- Minimal operator/admin panel for create/seed/advance/settle.
- First intentional small public prize-pool bracket.
- Tournament marketing/promo landing copy.

## Decision needed
Gianni should approve whether to proceed with this recommended read-only tournament UX slice, or override with:
- minimal admin/operator panel first, or
- first intentional small public bracket first.
