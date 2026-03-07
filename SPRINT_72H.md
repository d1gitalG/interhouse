# 72-Hour Sprint — InterHouse MVP (Credits + RPS)

Scope focus: **Credits mode + RPS (Quick/BO3/BO5)**, **Lobby (Scrim/War tabs)**, **Match history**, **Basic profile**.

Assumptions
- Web-only MVP.
- Wallet/NFT auth can be stubbed initially; structure must support real gating later.
- Credits mode is server-authoritative with ledger + balance guardrails.

---

## Day 1 (0–24h) — Foundations + Credits + RPS Quick
Deliverables
1. DB schema + migrations: users/profile, lobby, matches/rounds, credits ledger (+ balance table or computed).
2. Credits backend: get balance, apply delta atomically, prevent negative.
3. RPS Quick end-to-end: create → join → submit moves → resolve → persist → apply credits.
4. Minimal UI to play a Quick match + show updated credits.

Acceptance Criteria
- Quick match playable end-to-end.
- Results persisted + retrievable.
- Credits update correctly + ledger entry exists.
- Minimal automated tests exist (credits + RPS resolution).

---

## Day 2 (24–48h) — BO3/BO5 + Lobby (Scrim/War)
Deliverables
1. RPS series support (BO3/BO5) with correct scoring + stop conditions.
2. Lobby UI with **Scrim / War** tabs:
   - create/list/join/leave
   - view members
3. Start match from lobby (pick opponent + format).

Acceptance Criteria
- BO3 ends at 2 wins; BO5 ends at 3 wins; no moves after end.
- Scrim/War tabs show separate lists.
- Can create lobby, join, view members, start an RPS match tied to lobby.

---

## Day 3 (48–72h) — History + Profile + Polish + Release
Deliverables
1. Match history page (W/L, opponent, format, date, credits delta) + minimal detail view.
2. Basic profile page (display name + credits) with edit display name.
3. Hardening: validation, empty states, error handling; smoke checklist; deploy preview.

Acceptance Criteria
- Match history correct + loads.
- Profile editable display name + persists.
- Smoke flow passes with no critical console/server errors.

---

## MVP Definition of Done (Ship Gate)
Functional
- [ ] RPS Quick playable end-to-end
- [ ] RPS BO3/BO5 playable end-to-end
- [ ] Credits ledger + atomic updates (no-negative)
- [ ] Lobby Scrim/War: create/list/join/leave + members
- [ ] War rules: cross-house only; Scrim: same-house only (once houses are wired)
- [ ] Match history + match detail
- [ ] Profile page + edit display name

Quality
- [ ] No double-settlement; idempotent settlement
- [ ] Basic tests: RPS resolution, series termination, credits atomic update

Delivery
- [ ] README_MVP.md (setup/run/env vars)
- [ ] Deployed preview OR build artifact
- [ ] Known limitations documented
