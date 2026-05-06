# Phase 5 Deploy Smoke — Audit/Fairness Foundation

_Date: 2026-05-06 03:35 EDT_

## Deployment

- Production URL: `https://interhouse-five.vercel.app`
- Git commit deployed: `4b3b52f Fix deploy lint hygiene`
- Vercel status: success
- Vercel deployment: `https://vercel.com/giannis-projects-8e16ae66/interhouse/91tY6ZSDdgfBrRaPdziFQBgQR4yT`

## Pre-deploy gates on clean source

Clean source initially surfaced lint issues that had been hidden by local dirty lint-hygiene changes. Applied and pushed a minimal deploy-gate fix:

- `eslint.config.mjs` ignores `.openclaw-tmp/**`
- `scripts/cleanup-stale-matches.js` explicitly disables `@typescript-eslint/no-require-imports` for legacy CommonJS script usage

Verification after fix:

```bash
npm run lint
# PASS

DATABASE_URL='postgresql://interhouse:interhouse@localhost:5432/interhouse?schema=public' npm run build
# PASS
```

## Production smoke

Known completed tournament used for smoke:

- `cmomlao550000nlipprgqllig`

Commands/results:

```bash
curl -fsS -L https://interhouse-five.vercel.app/tournaments
# HTTP 200

curl -fsS -L https://interhouse-five.vercel.app/tournaments/cmomlao550000nlipprgqllig
# HTTP 200
```

Tournament detail page checks:

- `Public audit layer` present
- `Download audit JSON` present
- `not real-money ready` gate copy present
- `Seed method` present

Audit endpoint:

```bash
curl -fsS -L https://interhouse-five.vercel.app/api/tournaments/cmomlao550000nlipprgqllig/audit
# HTTP 200
```

Parsed audit response:

```json
{
  "exportVersion": "interhouse-tournament-audit-v1",
  "seedMethod": "Operator / entry-order seeding",
  "realMoneyReady": false,
  "hasAuditHash": true,
  "customSystemPromptPattern": false
}
```

## Result

Phase 5 audit/fairness transparency foundation is deployed and production-smoked.

This does **not** make InterHouse real-money ready. Remaining trust gaps move to deeper audit/fairness hardening:

- random/ranked/commit-reveal seeding decision
- persisted per-move provider/model/version metadata
- prompt commit/reveal or private review escrow design
- eligibility / anti-spam controls for public tournaments
