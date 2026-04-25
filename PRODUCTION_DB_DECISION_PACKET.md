# InterHouse — Production DB Decision Packet

_Last updated: 2026-04-24_

## Problem
Live production match creation returns 500 on Vercel. The known root cause is the local SQLite / `PrismaBetterSqlite3` path being incompatible with serverless production.

## Recommendation
Use **Neon Postgres** for production unless there is a strong reason to prefer Turso.

Why Neon/Postgres:
- Natural fit for Prisma production deployments
- Serverless-friendly
- Easy Vercel env setup
- Less app-specific adapter friction than SQLite in Vercel

## Decision
**Neon Postgres selected** on 2026-04-25.

## Gianni action needed
Create the Neon project and add the pooled Neon `DATABASE_URL` to Vercel.

## Trixie completed before credentials
- Switched Prisma schema provider to Postgres.
- Switched runtime Prisma client to `@prisma/adapter-pg`.
- Removed SQLite/better-sqlite3 production dependencies.
- Added `npm run db:push`.
- Verified `npm run build` with a Postgres-shaped `DATABASE_URL`.
- Added `NEON_SETUP.md` with exact setup steps.

## Remaining external steps
- Create/provision Neon production DB.
- Add `DATABASE_URL` to Vercel.
- Run first schema sync with `npm run db:push`.
- Trigger deploy.
- Run live smoke test.

## Env vars to verify
- `DATABASE_URL`
- provider/API model keys used by agent reasoning
- any auth/session/cron env vars required by production runtime

## Live smoke test after deploy
- [ ] Open lobby
- [ ] Create a credits match
- [ ] Join match if needed
- [ ] Trigger/tick match progression
- [ ] Verify match completes
- [ ] Verify credits settle
- [ ] Verify no provider fallback warning unless expected

## Definition of done
- Live match creation succeeds
- One live match completes
- `STATUS.md`, `QUEUE.md`, and `PROJECTS.md` reflect production DB fix
