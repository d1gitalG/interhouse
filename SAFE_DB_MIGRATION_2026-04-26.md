# Safe DB Migration Handoff — Tournament Prize Pool

_Date: 2026-04-26_

## Scope

Prepare the tournament prize-pool schema for a **safe Postgres target** without touching production.

Production warning: do **not** run these commands against `https://interhouse-five.vercel.app` or the production Neon database without Gianni's explicit approval.

## What changed

The current Prisma schema adds:

- `TournamentStatus` enum
- `TournamentPayoutMode` enum
- `Tournament`
- `TournamentEntry`
- `TournamentMatch`
- `AgentProfile.tournamentEntries` relation
- `Match.tournamentMatch` relation

## Prepared SQL

A Postgres-only SQL diff has been generated here:

```text
prisma/safe-migrations/20260427_tournament_prize_pool.postgres.sql
```

Generated from tracked HEAD schema to current working schema with:

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/interhouse_shadow'
npx prisma migrate diff --from-schema .openclaw-tmp\schema.before-tournament.prisma --to-schema prisma\schema.prisma --script --output prisma\safe-migrations\20260427_tournament_prize_pool.postgres.sql
```

This command only generated SQL; it did not connect to or mutate production.

## Safe target availability check

2026-04-26 20:53 EDT check found:

- `.env` points to local SQLite (`file:./dev.db`) and is not usable because the app now requires Postgres.
- `.env.production.local` has an empty `DATABASE_URL` in this checkout.
- No process-level `DATABASE_URL` was available.
- `docker`, `psql`, and `pg_isready` are not installed/available on this Windows host.

So the next action needs either a safe Neon/Postgres branch URL or explicit approval to use production.

## Safe branch result

2026-04-26 21:22 EDT:

- Gianni created Neon child branch `tournament-smoke-2026-04-26` from `production` with current data.
- Ran `npx prisma db push` against that child branch only.
- Ran `npm run build` against the child branch DB.
- Started local Next server against the child branch DB.
- Ran `SMOKE_BASE_URL=http://localhost:3000 npm run smoke:tournament-prize-pool`.
- Result: PASS.
  - Tournament: `cmogin11i000400ipxgbv0sbp`
  - Prize pool: 100 credits
  - Champion: `cmogin0z3000300ipsbgak0nh`
  - Winner balance: 1075
  - Loser balances: 975 each
  - All entrant `lockedCredits`: 0
  - Repeat settle idempotency: passed

Production DB was not touched.

## Recommended safe path

1. Create or select a non-production Postgres database / Neon branch.
2. Set the shell `DATABASE_URL` to that safe target.
3. Apply schema using one of these, preferably on the safe branch first:

```powershell
npm run db:push
```

or apply the prepared SQL with your Postgres client:

```powershell
psql "$env:DATABASE_URL" -f prisma/safe-migrations/20260427_tournament_prize_pool.postgres.sql
```

4. Start the app against the same safe DB:

```powershell
$env:DATABASE_URL='<SAFE_POSTGRES_URL>'
npm run dev
```

5. In a second shell, run the 4-agent smoke against local app only:

```powershell
$env:SMOKE_BASE_URL='http://localhost:3000'
npm run smoke:tournament-prize-pool
```

## Smoke assertions

The smoke script verifies:

- four agents are created
- entry fee is debited once per entrant
- tournament bracket matches use `stakeAmount = 0`
- champion receives the full tournament pool
- explicit repeat settlement is idempotent
- losers do not receive per-round payouts
- no entrant has stranded `lockedCredits`

## Current local DB handling

`dev.db` was backed up, then restored to the tracked copy so local runtime data does not enter this integration diff.

Backup path pattern:

```text
.openclaw-backups/dev.db.<timestamp>.bak
```

The backup directory is ignored via local `.git/info/exclude`, not committed.
