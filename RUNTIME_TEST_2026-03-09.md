# InterHouse Runtime Test - 2026-03-09

## Result
- Local dev server booted successfully via `npm run dev`
- Created a fresh `RPS / QUICK / CREDITS 1` match through the local API
- Match ID: `cmmiuq32p00005oiprz6slvnx`
- Participants:
  - `Smoke-A-b0a58bcd` (RED)
  - `Smoke-B-b0a58bcd` (BLUE)
- Match auto-ran to completion on the local match page
- Winner: `Smoke-A-b0a58bcd`

## What worked
- Next.js app booted on `http://localhost:3000`
- Match creation succeeded
- Credit locking/settlement worked:
  - Winner credits moved from 1024 locked state to 1026 after settlement
  - Loser credits remained at 974 after losing 1 credit stake
- Match status progressed to `COMPLETED`
- Spectate/match page reflected round result, winner, participant scores, and move history

## Concrete fix list
1. **Agent provider fallback is firing during live rounds**
   - Evidence: both agents showed `Fallback move used due to provider response error.`
   - Impact: the end-to-end loop completes, but real agent reasoning/provider integration is not healthy.
   - Next check: inspect `lib/agent-engine.ts`, provider env/config, and any request/response parsing path causing fallback moves.

2. **Add a visible health signal for fallback-vs-real moves**
   - Right now the only clue is the reasoning text.
   - Add an explicit UI or debug signal so provider degradation is obvious during testing.

## Verdict
- **IH-001 is complete**: one full local match completed successfully.
- **IH-002 is now unblocked**: first fix batch should target provider-response fallback behavior.

---

## Post-Fix Verification - 2026-03-09

### Root Cause
`GEMINI_API_KEY` was present in the environment (session env via `$env:GEMINI_API_KEY`) but **not written to `interhouse/.env`**. The Next.js dev server only loads env from `.env`; it does not inherit PowerShell session variables. So `process.env.GEMINI_API_KEY` was `undefined` at runtime, causing every call to hit the `GEMINI_API_KEY_MISSING` throw, which was silently caught by the outer `try/catch` and replaced with a deterministic fallback move.

### Fix Applied
Added `GEMINI_API_KEY` to `interhouse/.env`.

### Verification
- Created fresh agents `Test-Alpha` (RED/CALCULATED) and `Test-Beta` (BLUE/ADAPTIVE)
- Created fresh match `cmmiuw9w3000c60ip66127w3x` (RPS/QUICK/CREDITS 1)
- Triggered tick manually; match result: **DRAW** (ROCK vs ROCK)
- Both agents returned **real Gemini reasoning**:
  - Test-Alpha: `"First round, no opponent data. Any move is equally optimal."`
  - Test-Beta: `"First round, no opponent data. Starting with a common opening move."`
- Neither agent used `"Fallback move used due to provider response error."`

### IH-002 Status: COMPLETE

### Remaining Notes
- The `GEMINI_API_KEY` must be set in `.env` (or any `.env.local`) to persist across server restarts. It is **not** committed to git (correctly listed in `.gitignore`).
- Concurrent Gemini calls (both agents in same tick) work fine - no rate limit issues observed.
