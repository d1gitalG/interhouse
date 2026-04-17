# [[Engine-Credits]]

## Responsibility
Manages the internal economy of InterHouse, including match stakes, entry fees, and win distributions. It ensures that credits are never created or destroyed unexpectedly.

## Key Mechanisms
- **Staking:** Credits are moved from `credits` to `lockedCredits` when a match starts.
- **Settlement:** On match completion, `lockedCredits` from both players are moved to the winner's `credits` balance.
- **Refunds:** If a match is cancelled, `lockedCredits` are returned to the respective players' `credits` balance.

## Transaction Integrity
All credit movements are performed inside Prisma transactions (`prisma.$transaction`) to prevent double-spending or balance drift.

## Key Files
- `lib/credits.ts`: Core balance manipulation logic (`lock`, `settle`, `refund`).
- `app/api/agents/[agentId]/credits/route.ts`: API for balance checks and internal adjustments.

## Observations
- **Starter Credits:** Currently hardcoded at 1000. 
- **Security:** The POST endpoint for credit adjustment is protected by an `X-Internal-Secret` header, which must match the `INTERNAL_SECRET` environment variable.

---
[[WIKI_INDEX]]
