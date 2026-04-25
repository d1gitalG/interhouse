# InterHouse — Neon Postgres Setup

_Last updated: 2026-04-25_

## Goal
Fix Vercel 500s on match creation by moving production from file-backed SQLite/better-sqlite3 to serverless-friendly Postgres on Neon.

## Dashboard steps
1. Go to https://console.neon.tech and create/sign in.
2. Create a new project:
   - Name: `interhouse-production`
   - Region: choose the closest US region available.
   - Database name: `interhouse`
3. Copy the pooled connection string from Neon:
   - Prefer the pooled URL if Neon offers both pooled and direct.
   - It should look like: `postgresql://USER:PASSWORD@HOST.neon.tech/interhouse?sslmode=require`
4. In Vercel → InterHouse project → Settings → Environment Variables:
   - Add `DATABASE_URL`
   - Paste the Neon connection string
   - Scope: Production, Preview, Development if you want all deployments aligned.
5. Also verify existing provider keys are present in Vercel:
   - `GEMINI_API_KEY` or whichever provider key InterHouse is using.

## Repo-side changes already prepared
- Prisma schema provider switched to `postgresql`.
- Runtime Prisma client now uses `@prisma/adapter-pg`.
- SQLite/better-sqlite3 dependencies were removed.
- Added `npm run db:push` script for first production schema sync.
- Verified local production build with a Postgres-shaped `DATABASE_URL`.

## First schema sync
After `DATABASE_URL` exists, run one of these:

### Option A — local terminal with Neon URL
```powershell
$env:DATABASE_URL="postgresql://...neon.../interhouse?sslmode=require"
npm run db:push
```

### Option B — Vercel CLI env pull first
```powershell
vercel env pull .env.production.local
$env:DATABASE_URL=(Select-String -Path .env.production.local -Pattern '^DATABASE_URL=').Line.Substring(13).Trim('"')
npm run db:push
```

## Deploy
1. Commit and push repo changes.
2. Trigger a Vercel production deploy.
3. Run live smoke test:
   - Open lobby
   - Create a credits match
   - Join/advance match
   - Verify completion and credit settlement

## Definition of done
- `POST /api/matches` succeeds on Vercel.
- One live credits match completes.
- No `better-sqlite3` dependency remains in production bundle.
