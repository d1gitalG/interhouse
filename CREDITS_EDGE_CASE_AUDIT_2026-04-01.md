# InterHouse Credits Edge-Case Audit — 2026-04-01

## Scope
Internal repo audit of the credits loop across create, join, settle, and cancel/refund paths.

## Verdict
- **Create path:** acceptable for MVP+ credits mode
- **Join path:** acceptable for MVP+ credits mode
- **Settle path:** acceptable and idempotent for MVP+ credits mode
- **Cancel/refund path:** **missing** and should be added before calling the credits loop launch-ready

## What was checked

### 1) Create path
Files:
- `app/api/matches/route.ts`
- `lib/credits.ts`

Observations:
- Create uses a Prisma transaction.
- Starter credits are granted inside the transaction before stake assertions/locking.
- Waiting matches only assert creator balance when a creator is present and stake mode is `CREDITS`.
- Matches created already full (`creatorAgentId` + `opponentAgentId`) rely on `lockMatchStakeCredits()` to atomically debit both participants before commit.
- If stake lock fails, the whole create transaction rolls back.

Assessment:
- Safe enough for local MVP+ credits matches.

### 2) Join path
Files:
- `app/api/matches/[matchId]/join/route.ts`
- `lib/credits.ts`

Observations:
- Join uses a Prisma transaction.
- Match must still be `WAITING`.
- Duplicate participant joins are blocked.
- Credits lock happens after the second participant is attached, but still inside the same transaction.
- If either side lacks credits, the join fails and the transaction rolls back.

Assessment:
- Safe enough for MVP+ credits mode.

### 3) Settle path
Files:
- `lib/match-engine.ts`
- `lib/credits.ts`
- `app/api/matches/[matchId]/move/route.ts`

Observations:
- Winner resolution calls `settleLockedMatchStakeCredits()` only after the match is finalized.
- Settlement is guarded by `creditsSettledAt` so repeat settlement is suppressed.
- Loser lock is decremented by `stakeAmount`.
- Winner lock is decremented by `stakeAmount` and winner credits receive `stakeAmount * 2`.
- Runtime note `RUNTIME_TEST_2026-03-18.md` already confirms the basic winner/loser balance math.

Assessment:
- Current credit settlement looks internally consistent for the happy path.

## Main gap found

### 4) Cancel / refund path is not implemented
Files checked:
- `prisma/schema.prisma`
- `app/api/matches/**`
- `lib/credits.ts`

Observations:
- `MatchStatus` includes `CANCELLED`.
- The launch checklist explicitly calls out create/join/settle/**cancel** audit coverage.
- There is **no API route or helper** that cancels a credits-staked match and returns locked credits to both participants.
- There is also no refund helper paired with `lockMatchStakeCredits()`.

Why this matters:
- If a credits-staked match ever needs manual cancellation after lock, balances can remain stranded in `lockedCredits`.
- That means the credits loop is not fully edge-case complete yet, even if the normal create->join->resolve path works.

## Recommendation
1. Add an explicit cancel/refund path for locked credit matches.
2. Then run one fresh manual smoke test over create -> join -> resolve -> verify balances.
3. Optionally add one local test for cancel-after-lock refund behavior.

## Small note
- `lockMatchStakeCredits()` stamps `creditsLockedAt` even when `stakeAmount <= 0`. That is mostly harmless, but it makes zero-stake matches look "locked" even though no credits moved.
