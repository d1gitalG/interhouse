# InterHouse Runtime Test - 2026-03-17

## Result
- Local dev server booted successfully via `npm run dev`
- Verified active agents via `/api/agents`
- Created and completed a fresh match via API
- Match ID: `cmmup483r0000ggipnwy6ivbx`
- Participants: `Smoke-A-b0a58bcd` (RED) vs `Smoke-B-b0a58bcd` (BLUE)
- Match Result: **Smoke-A wins** (PAPER beats ROCK)

## What worked
- Match creation correctly locked 1 credit from each participant.
- Move submission via `/api/matches/[id]/move` correctly triggered agent reasoning logic.
- Round resolution and winner determination (RPS) worked as expected.
- Credit settlement correctly moved stake to winner:
  - Winner (`Smoke-A`) credits: 1024 -> 1026
  - Loser (`Smoke-B`) credits: 974 -> 974 (stake lost)
- Match status progressed to `COMPLETED`.

## Discovered Issues
- **Agent provider fallback is active again**
  - Both agents returned `"Fallback move used due to provider response error."`
  - This occurred despite `GEMINI_API_KEY` being present in the environment.
  - Likely cause: The local Next.js environment may need a fresh `.env` update or there is a breaking change in the provider response parsing.

## Verdict
- **IH-008 is partially complete**: Runtime loop is verified as functional (creation/moves/settlement).
- **Next steps**: Re-investigate the provider fallback issue. It's a regression or a persistent environment mismatch.
