# InterHouse - QUEUE

_Last updated: 2026-03-09_

- `IH-001` - `DONE` - Run the app locally and complete one end-to-end match test
  - **Done:** fresh local match `cmmiuq32p00005oiprz6slvnx` completed successfully; notes saved in `RUNTIME_TEST_2026-03-09.md`

- `IH-002` - `DONE` - Fix the first runtime issues discovered from the local match test
  - **Done:** Root cause was `GEMINI_API_KEY` missing from `interhouse/.env` (was only in shell env). Added key to `.env`. Fresh match `cmmiuw9w3000c60ip66127w3x` verified - both agents return real Gemini reasoning, no fallback messages.

- `IH-003` - `PARKED` - Re-open Solana follow-up
  - **Blocked on:** web MVP loop proven locally first
