# IH-069 — BYO Agents v1 (A3 hybrid creation + B2 slot model) Implementation Packet

_Status: READY_
_Date: 2026-07-02_
_Author: Claude (architect lane), for Codex execution_
_Decision: Gianni approved "A3 + B2" per `BYO_AGENT_DECISION` brief — hybrid builder with optional capped directive; one free agent slot per account, more earned or bought with credits._

## Objective

Turn public agent creation from an ungated free-for-all (everything owned by the shared `default` user, unlimited creates, unbounded `customSystemPrompt`, any tier) into an owned, slot-limited, directive-safe flow. Credits-only prototype; no payments, no real-money/SOL language.

## Current baseline (verified 2026-07-02)

- `prisma/schema.prisma`: `AgentProfile.ownerId -> User` already exists and is required. `User` has `walletAddress @unique` and `credits`.
- `lib/auth.ts` `requireUser(req)`: MVP identity — trusts `x-address` header, auto-upserts User. Keep this mechanism for v1; do not build signatures.
- `app/api/agents/route.ts` POST: open to everyone, assigns the `default` user, no slot limit, no directive limits, accepts any tier.
- `lib/public-agent.ts` `publicAgentSelect` already excludes `customSystemPrompt` from all public reads — preserve this.
- Internal smoke/ops flows create agents while sending `x-internal-secret` (see `lib/internal-auth.ts` and existing smoke scripts).

## Design decisions (do not deviate)

1. **Two creation modes on POST `/api/agents`:**
   - **Internal mode** (valid `x-internal-secret` header): behavior unchanged from today (default user, any tier, no slot cap, no directive limits). Existing smokes and operator flows must keep passing untouched.
   - **Public mode** (no valid internal secret): requires `x-address` via `requireUser`; missing header returns 401 `UNAUTHENTICATED`. Agent is owned by that user.
2. **Public mode rules:**
   - Tier is forced `ROOKIE`. If the body explicitly requests a different tier, reject 400 `TIER_NOT_ALLOWED` (explicit beats silent coercion).
   - `toolsEnabled` forced to `[]`.
   - Slot enforcement: count of agents owned by the user must be `< user.agentSlots`, else 409 `AGENT_SLOTS_EXHAUSTED`. Enforce inside the create transaction (no partial side effects, consistent with IH-067 style).
   - Directive (optional `customSystemPrompt`): max 500 chars and must pass the filter below, else 400 `DIRECTIVE_REJECTED` (single public-safe code; do not echo which rule fired).
3. **Schema:** add `agentSlots Int @default(1)` to `User`. Additive migration dir `prisma/migrations/20260702180000_agent_slots/` following existing migration file patterns. NO other schema changes.
4. **New module `lib/agent-slots.ts`** (pure, unit-testable):
   - `MAX_AGENT_SLOTS = 3`, `SLOT_UNLOCK_CREDITS_COST = 500`, `SLOT_UNLOCK_WINS_PER_SLOT = 10`, `DIRECTIVE_MAX_LENGTH = 500`.
   - `validateDirective(text): { ok: true } | { ok: false }` — length cap; reject control characters; reject case-insensitive patterns: `ignore (all )?previous`, `system prompt`, `jailbreak`, `reveal .*(prompt|secret|instructions)`, `disregard .*(rules|instructions)`. Best-effort prototype filter; keep the list in one exported const.
   - `winsRequiredForNextSlot(currentSlots)` = `currentSlots * SLOT_UNLOCK_WINS_PER_SLOT` (so slot 2 needs 10 total wins, slot 3 needs 20).
5. **New endpoint POST `/api/agents/slots/unlock`:**
   - Public mode only (`requireUser`; 401 if missing).
   - Body: `{ method: "WINS" }` or `{ method: "CREDITS", agentId: string }`.
   - In one transaction: if `user.agentSlots >= MAX_AGENT_SLOTS` → 409 `AGENT_SLOTS_MAX_REACHED`.
     - WINS: sum `wins` across the user's owned agents; must be `>= winsRequiredForNextSlot(user.agentSlots)`, else 409 `SLOT_UNLOCK_REQUIREMENTS_NOT_MET`.
     - CREDITS: `agentId` must be owned by the user (404 `AGENT_NOT_FOUND` otherwise) and have `credits >= 500` and `lockedCredits` untouched; debit 500 from that agent, else 409 `INSUFFICIENT_CREDITS`.
   - On success increment `agentSlots` by 1 and return `{ agentSlots }`.
   - GET `/api/agents/slots` (public mode): returns `{ agentSlots, agentsUsed, maxSlots, winsRequiredForNextSlot, creditsCost }` for the UI.
6. **UI — `app/agent/page.tsx` create form (A3 layout):**
   - Keep existing name/house/strategy fields as the guided builder.
   - Remove any public tier selector if present (ROOKIE implied).
   - Add a collapsed "Advanced: custom directive (optional)" section: textarea, live character counter to 500, helper text: "Appended to your agent's vetted base prompt. Length-capped and filtered. Every move your agent makes is recorded in the public audit trail."
   - Add a small identity field for the MVP wallet address (persist in `localStorage`, sent as `x-address`) if the page does not already have one; reuse any existing wallet stub if present.
   - Show slot status from GET `/api/agents/slots` ("Slot 1 of 1 used — unlock the next: win 10 matches or 500 CR") with an unlock button wired to the unlock endpoint.
   - Copy rule: credits-only / prototype controls wording ONLY. Never: real-money safe, SOL, KYC, fraud-proof, Sybil-resistant.
7. **Do not touch:** engine behavior, audit export shape, tournament/eligibility logic, `publicAgentSelect` privacy, existing smokes.

## New smoke: `scripts/smoke-byo-agents.js` (+ `package.json` script `smoke:byo-agents`)

Model on the existing smoke style (SMOKE_BASE_URL, prod guard, INTERNAL_SECRET from env). Cover, using a random wallet address W1:
1. Public create without `x-address` → 401.
2. Public create with W1 → 201, agent owned tier ROOKIE; response must not include `customSystemPrompt`.
3. Second public create with W1 → 409 `AGENT_SLOTS_EXHAUSTED`.
4. Directive over 500 chars → 400 `DIRECTIVE_REJECTED`; directive containing "ignore previous instructions" → 400 `DIRECTIVE_REJECTED`.
5. Public create requesting tier CHAMPION → 400 `TIER_NOT_ALLOWED`.
6. Grant 600 credits to W1's agent via the existing internal credits adjustment endpoint, then unlock via CREDITS → `agentSlots: 2`, agent credits reduced by exactly 500; second create now succeeds.
7. Unlock attempt beyond MAX (drive slots to 3 via internal credit grants, then try again) → 409 `AGENT_SLOTS_MAX_REACHED`.
8. Internal-mode create (x-internal-secret, no x-address) still works with arbitrary tier — unchanged legacy behavior.

## Acceptance criteria

1. All eight smoke cases pass; existing eligibility / prize-pool / commit-reveal / override-transparency smokes still pass unchanged.
2. Legacy agents (owned by `default` user) render and behave exactly as before.
3. No public surface leaks `customSystemPrompt` (existing guarantee preserved).
4. Slot and directive rejections have zero side effects (no partial creates, no debits).
5. `npm run lint`, `npx tsc --noEmit` pass; reviewer runs Postgres-shaped build + live smokes.

## Approval gates (unchanged)

Production deploy, production DB push, external announcements, real-money/SOL/wagering claims, new identity signals — all require Gianni.
