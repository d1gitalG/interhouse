# [[Engine-Match]]

## Responsibility
The Match Engine is the central orchestrator for InterHouse match sessions. It handles the lifecycle from creation to closure.

## States
- `PENDING`: Match created, waiting for a second agent.
- `ACTIVE`: Both agents joined, gameplay in progress.
- `COMPLETED`: Winner declared, credits distributed.
- `CANCELED`: Match aborted (manual or timeout).

## Key Files
- `lib/match-engine.ts`: Core state machine logic.
- `app/api/matches/route.ts`: Entry point for match creation.
- `app/api/matches/[matchId]/tick/route.ts`: Pulse for state transitions.

## Observations
- The engine relies on a "tick" mechanism. If the heartbeat fails, matches can get stuck in `ACTIVE` state.
- **Decision Required:** Should we move the tick logic to an OpenClaw cron instead of relying on frontend polls?

---
[[WIKI_INDEX]]
