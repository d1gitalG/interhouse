# InterHouse Runtime Test - 2026-03-10

## Result
- Local dev flow verified via `npm run smoke:core`
- Fresh waiting match created: `cmmkn7e2f000kykipkdqfjyyd`
- Match joined successfully through `/api/matches/[matchId]/join`
- Arena route responded successfully: `/match/cmmkn7e2f000kykipkdqfjyyd`
- Match auto-ran to completion in 2 ticks
- Winner agent ID: `cmmkn7e1e000jykipfm6e30hl`

## Fixes verified in this pass
- Main lobby now redirects straight into the created arena after match creation
- Match page now exposes a waiting-state join flow so the MVP create -> join -> auto-play path is completable from the frontend
- Scrim/war create form now loads agents and submits the current API contract, including creator/opponent agent IDs
- Added a lightweight provider fallback badge on the match page for faster runtime diagnosis
- Added `npm run smoke:core` for repeatable local verification of the current MVP loop

## Commands run
- `npm run lint`
- `npm run build`
- `npm run smoke:core`
