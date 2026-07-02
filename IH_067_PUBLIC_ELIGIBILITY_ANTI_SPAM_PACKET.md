# IH-067 — Public Tournament Eligibility / Anti-Spam Controls Implementation Packet

_Status: PAPERCLIP-READY FOR INTERNAL BUILD_
_Date: 2026-05-18_
_Source decisions:_
- `PUBLIC_ELIGIBILITY_ANTI_SPAM_SLICE_2026-05-14.md`
- `SEEDING_PATH_DECISION_2026-05-14.md`
- `STATUS.md`

## Objective

Implement the first internal eligibility and anti-spam guardrails for public InterHouse credit-entry tournaments so broader prototype brackets are harder to pollute with duplicate, brand-new, inactive, or spammy entries.

This packet is implementation scope only. It does not approve production deploy, production DB changes, external messaging, broader credit-entry expansion, SOL/real-money framing, or public claims.

## Current baseline from repo inspection

- Tournament creation is internal-secret gated at `app/api/tournaments/route.ts`.
- Tournament creation currently accepts `agentIds` and calls `createTournament(parsed.data)`.
- Entry creation currently happens in `lib/tournaments.ts:createTournament`.
- `prisma/schema.prisma` already has `@@unique([tournamentId, agentId])`, so duplicate-agent-per-tournament is DB-backed but should receive explicit preflight validation and a clean API error.
- Commit-reveal seeding/audit foundation is already present and must not regress:
  - `lib/tournaments.ts`
  - `lib/tournament-audit.ts`
  - `app/api/tournaments/[tournamentId]/seed/route.ts`
  - `app/api/tournaments/[tournamentId]/audit/route.ts`

## Target files

Primary implementation targets:

1. `lib/tournament-eligibility.ts` (new)
   - Central deterministic v1 eligibility helper.
   - Returns structured allow/reject result with public-safe reason codes.
   - No raw prompt exposure, identity claims, KYC language, or IP/device storage in v1.

2. `lib/tournaments.ts`
   - Call eligibility helper inside the existing tournament creation transaction before entry creation / fee debit.
   - Preserve current commit-reveal seed commitment/reveal behavior.
   - Preserve current `agentIds` de-duplication, but add explicit rejection/logging for duplicated request bodies if needed by the final rule.

3. `app/api/tournaments/route.ts`
   - Map eligibility failures to clear 409/400 public-safe errors such as `DUPLICATE_TOURNAMENT_ENTRY`, `TOURNAMENT_ENTRY_CAP_REACHED`, `AGENT_INELIGIBLE_FOR_PUBLIC_CREDIT_TOURNAMENT`, or `AGENT_NOT_FOUND`.
   - Do not leak internal heuristic details.

4. `prisma/schema.prisma` (only if required after implementation inspection)
   - Existing `@@unique([tournamentId, agentId])` should remain.
   - Avoid production-impacting schema additions unless explicitly approved. If a schema change is necessary for durable abuse logs, stop at a migration/approval packet.

5. Public copy surfaces, if the selected UI scope includes it:
   - `app/tournaments/page.tsx`
   - `app/tournaments/[tournamentId]/page.tsx`
   - Optional shared helper: `lib/tournament-presentation.ts`

6. Verification scripts/tests:
   - Prefer adding a small local smoke/test script under `scripts/` if there is no existing test harness.
   - Candidate: `scripts/smoke-tournament-eligibility.js`.

## V1 eligibility rule matrix

| Rule | Applies when | Default v1 behavior | Public-safe rejection code |
| --- | --- | --- | --- |
| Agent exists | All tournament entries | Required before entry creation | `AGENT_NOT_FOUND` |
| One entry per agent per tournament | All tournaments | Required; preflight plus existing DB unique constraint | `DUPLICATE_TOURNAMENT_ENTRY` |
| Duplicate agent IDs in create request | `agentIds` body contains repeated IDs | Reject or normalize with explicit warning; prefer reject for public-credit scopes | `DUPLICATE_TOURNAMENT_ENTRY` |
| Entry cap | Public credit-entry tournament | Default cap for early public tests: 4, 8, 16, or 64 as configured; must be explicit in helper | `TOURNAMENT_ENTRY_CAP_REACHED` |
| Agent inactive/deleted | If app has an inactive/deleted field | Reject inactive/deleted agents | `AGENT_INELIGIBLE_FOR_PUBLIC_CREDIT_TOURNAMENT` |
| Minimum history | Public credit-entry tournament only | Require minimum completed match count, or allow explicit prototype/test override if no history threshold is selected | `AGENT_INELIGIBLE_FOR_PUBLIC_CREDIT_TOURNAMENT` |
| Active public credit-entry overlap | Public credit-entry tournament only | Optional v1 guard: one active public credit-entry tournament per agent | `AGENT_ALREADY_IN_ACTIVE_PUBLIC_CREDIT_TOURNAMENT` |
| Suspicious owner/session/IP heuristics | Future scope only unless safe data already exists | Log design note only; do not invent identity/KYC controls | N/A in v1 |

Recommended v1 default: deterministic app-local checks only. Do not claim account, human identity, KYC, IP/device, payment, or real-money protection.

## Acceptance criteria

1. Eligible agents can still be entered into a tournament through the existing internal-secret-gated create flow.
2. A duplicate agent in the same tournament request is rejected before fee debit or entry creation, with a clean public-safe error.
3. Existing DB uniqueness for `tournamentId + agentId` remains intact and is not weakened.
4. If minimum-history or inactive/deleted rules are implemented, rejected agents return a public-safe eligibility error without internal heuristic details.
5. Entry cap, if configured, is enforced before any partial tournament/entry/credit side effects are committed.
6. Credit-entry tournament failure paths do not debit credits or increment prize pool.
7. Commit-reveal behavior remains intact: commitment generated pre-seed, reveal redacted before seeding, reveal published after seeding, audit export still verifies derivation.
8. Public copy says only: credits-only / prototype fairness controls / duplicate and suspicious entries limited. It must not say real-money safe, SOL-ready, fraud-proof, KYC-backed, or fully Sybil-resistant.
9. Implementation updates `STATUS.md` or a dated verification note only after local verification passes.

## Verification gates

Run locally before marking implementation done:

1. Static checks
   - `npm run lint`
   - `DATABASE_URL='postgresql://user:***@localhost:5432/interhouse' npm run build` or the existing Postgres-shaped build command used by this repo.

2. Eligibility smoke
   - Create a zero-fee or low-stakes prototype tournament with eligible agents: expect 201/ok.
   - Attempt duplicate-agent entry in the same create request: expect clean 400/409 and no partial debit/entries.
   - If entry cap is implemented: create over-cap request and verify clean rejection.
   - If inactive/deleted/min-history rule is implemented: verify rejection response is public-safe.

3. Credit safety smoke
   - For credit-entry tournament rejection, compare agent credits and tournament prize pool before/after; no debit or prize increment should occur.

4. Commit-reveal no-regression smoke
   - Create `seedMethod=COMMIT_REVEAL` tournament.
   - Verify public GET before seed redacts `seedReveal`.
   - Seed tournament.
   - Verify audit endpoint returns `exportVersion=interhouse-tournament-audit-v1`, reveal/commitment verification fields, and no `customSystemPrompt` field pattern.

5. Existing tournament prize-pool smoke where feasible
   - `npm run smoke:tournament-prize-pool`

## Approval gates

Stop and request Gianni approval before any of the following:

- Production deploy.
- Production DB push/migration or destructive data operation.
- Public/external announcement or positioning copy change on live properties.
- Broader credit-entry expansion beyond controlled prototype brackets.
- Real-money, SOL, wagering, fraud-proof, KYC, or Sybil-proof claims.
- Storing or processing new sensitive identity/IP/device signals.
- Exposing raw private prompts or private prompt-derived internals.

## Risk notes

- Duplicate-agent protection already has a DB constraint, but relying on DB errors alone gives poor operator UX and can obscure partial-side-effect risk; add explicit preflight inside the transaction.
- Minimum match-history thresholds can unfairly block useful new test agents. If used, pair with an explicit internal prototype allowlist/override rather than identity claims.
- IP/session/owner heuristics are easy to overclaim and may introduce privacy obligations. Keep them out of v1 unless existing safe data makes them trivial and approved.
- Entry caps protect early public tests but must be explained as prototype controls, not comprehensive anti-abuse.
- Any schema change for durable abuse logging is a separate approval packet because production DB changes are out of scope for IH-067 scoping.
- Commit-reveal audit export is a key legitimacy proof; eligibility changes must not alter seeding basis, audit hash fields, or prompt redaction guarantees without explicit review.

## Worker handoff

```text
Worker role: Builder
Agent: omni-dev or web
Task: Implement IH-067 public tournament eligibility / anti-spam controls from this packet.
Context files:
- interhouse/STATUS.md
- interhouse/PUBLIC_ELIGIBILITY_ANTI_SPAM_SLICE_2026-05-14.md
- interhouse/IH_067_PUBLIC_ELIGIBILITY_ANTI_SPAM_PACKET.md
- interhouse/SEEDING_PATH_DECISION_2026-05-14.md
Allowed changes: InterHouse internal code/tests/docs only.
Forbidden actions: no production deploy, no production DB changes, no public/external changes, no real-money/SOL claims, no raw prompt exposure.
Return proof: changed files, exact commands run, pass/fail output, smoke IDs if any, remaining gate/blocker.
```
