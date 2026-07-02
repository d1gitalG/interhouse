# IH-069 Implementation Receipt - 2026-07-02

_Status: DONE (all live smokes passed; not yet deployed)_
_Executor: Codex CLI (gpt-5.5, reasoning=high, sandboxed) dispatched and reviewed by Claude_
_Branch: ih-069-byo-agents_
_Packet: IH_069_BYO_AGENTS_PACKET.md_
_Decision: Gianni approved A3 (hybrid builder + capped directive) + B2 (one free slot, earn/buy more) via BYO_AGENT_DECISION brief._

## What was built

Public agent creation is now owned, slot-limited, and directive-safe:

- Dual-mode POST /api/agents: internal-secret mode byte-compatible with legacy behavior; public mode requires x-address identity (requireUser), forces ROOKIE tier and empty tools, validates the optional directive (500-char cap, control-character and injection-pattern filter in lib/agent-slots.ts), and enforces slots inside the create transaction (rejections have zero side effects).
- User.agentSlots (default 1, max 3) added via additive migration 20260702180000_agent_slots.
- POST /api/agents/slots/unlock: WINS path (10 total wins per next slot) or CREDITS path (500 CR debit from an owned agent), transactional with a race-guarded conditional increment. GET /api/agents/slots feeds the UI.
- app/agent/page.tsx: A3 layout - guided builder plus collapsed "Advanced: custom directive" section with live character counter, MVP wallet identity field (localStorage -> x-address), slot status and unlock button. Conservative credits-only copy; no real-money/SOL/KYC/fraud-proof wording (grep-verified).
- publicAgentSelect privacy preserved; no public surface returns customSystemPrompt.

## Verification

- npm run lint: PASS; npx tsc --noEmit: PASS (Codex, in-sandbox)
- Postgres-shaped npm run build: PASS (Claude)
- Live smokes on throwaway local Postgres 16 (docker :5433, next start :3177, production build):
  - smoke-byo-agents (new, 8 cases): PASS - 401 without identity; owned ROOKIE create; slot exhaustion 409; oversize and injection directives 400; TIER_NOT_ALLOWED 400; credits unlock debits exactly 500 and enables second create; max-slots 409 at 3; internal-mode legacy create unchanged.
  - Regressions all PASS: eligibility, prize-pool, commit-reveal, override-transparency.

## Known limitations (documented, accepted for prototype)

- Identity is the MVP x-address header; new wallet strings mean new free slots (Sybil pressure remains; consistent with IH-067's no-identity-claims stance). Signature-based sessions are the hardening slice.
- Create-path slot check has a theoretical concurrent-request race (worst case one extra agent); unlock path is race-guarded.

## Gates

Not deployed. Production push awaits Gianni.
