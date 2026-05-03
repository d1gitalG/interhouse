# InterHouse Review Board Action Plan

_Last updated: 2026-05-03_

## Source
- Review doc: `C:/Users/ladit/OneDrive/Documents/game-system-review-board/games/interhouse/reports/interhouse-game-system-review-2026-05-01.md`
- Production app: `https://interhouse-five.vercel.app`
- Current product stance: **spectator-first agent tournament system with credits live and SOL/backing still preview**.

## North Star
Make InterHouse feel like an informed agent-backing game before it feels like wagering.

A user should be able to:
1. Understand why the match is not random RPS.
2. Compare two agents before a bracket.
3. Pick who they would back and explain why.
4. Watch the bracket and see whether that thesis held up.
5. Trust the result enough to risk non-money credits later.

## Questions Answered So Far

- [x] **Is InterHouse more than random RPS?**
  - Yes, directionally. Resource-limited RPS plus visible intent, role pressure, move exhaustion, and agent temperament creates real tactical pressure.
  - Shipped: match-level resource/counter badges, resource-trap labels, role clarity, and tournament recaps.

- [x] **Should the next milestone be real betting?**
  - No. Real-money framing is explicitly deferred.
  - Current milestone is spectator clarity and informed backing legitimacy.

- [x] **Are credits live vs SOL real?**
  - Credits are live for prototype testing.
  - SOL/wallet/escrow remain preview/stub and must stay labeled that way.

- [x] **Can completed tournaments tell a story?**
  - First pass shipped.
  - Tournament pages now show public format labels, champion path, final scoreline, and key resource-trap/key constraint moments.

- [x] **Do public format names exist?**
  - First pass shipped:
    - `Scarcity Duel`
    - `Championship Series`
    - `Quick Clash`

## Questions Not Fully Answered Yet

- [ ] **Can a new user identify which agent they would back and give a reason from visible evidence?**
  - Biggest remaining gap.
  - Requires agent scouting cards and matchup previews.

- [ ] **Do agent archetypes feel mechanically different to users, not just narratively different?**
  - Engine direction exists.
  - UI needs visible tactical traits and historical evidence.

- [ ] **What information is sufficient before risking credits?**
  - Working answer: archetype, flaw, resource discipline, trap tendency, off-read tolerance, recent record, preferred format, notable wins/losses.
  - Needs implementation and playtest.

- [ ] **What is public backing?**
  - Do not decide yet.
  - Candidate models: direct stake, tournament entry, bracket prediction, side bet.
  - Recommendation: test credit-entry tournaments only after scouting cards make decisions feel skill-based.

- [ ] **How should public bracket seeding work?**
  - Operator/entry-order seeding is fine for showcases.
  - Public stake events need random, ranked, or commit-reveal seeding later.

## Execution Roadmap

### Phase 1 — Spectator Legitimacy Foundation
Status: **DONE / shipped**

- [x] Public tournament archive exists.
- [x] Tournament detail page shows bracket progress and champion context.
- [x] Public format labels/explainers exist.
- [x] Match UI shows role context: Creator vs Challenger.
- [x] Match UI surfaces resource-trap/counter-exhaustion context.
- [x] Production smoke passed after deploy.

### Phase 2 — Agent Scouting / Backing Evidence
Status: **DONE / shipped**

Goal: a user can compare agents and say, “I would back this one because…”

Checklist:
- [x] Create shared agent scouting derivation helper.
  - Inputs: agent profile, strategy profile, prompt text, wins/losses, recent matches, tournament history where available.
  - Outputs: tactical identity, flaw, preferred format, resource discipline, trap tendency, off-read tolerance, confidence caveat.
- [x] Add scouting cards to tournament entries.
  - Show each entrant’s identity, flaw, preferred format, record, and evidence chips.
- [x] Add compact matchup preview to tournament match cards.
  - Show role, recent form, likely edge, and visible uncertainty.
- [x] Add agent detail/scouting section in existing agent profile modal or agent page.
  - Include “best in” format and “watch out for” flaw.
- [x] Add clear empty/low-data states.
  - Avoid pretending confidence when an agent has little history.

Acceptance criteria:
- [x] On a tournament page, a user can compare two adjacent agents without opening raw logs.
- [x] Each visible recommendation includes a reason and a caveat.
- [x] No hidden prompt text is exposed in a way that enables cloning.
- [x] `npm run lint` passes.
- [x] Postgres-env `npm run build` passes.
- [x] Production smoke verifies one tournament page with scouting cards.

### Phase 3 — Tournament Story Depth
Status: **DONE / deployed to production**

Goal: completed brackets feel like sports recaps, not database records.

Checklist:
- [x] Add tournament `Format Takeaway` section.
  - Derives from public format/series resource limits plus visible trap/upset evidence.
- [x] Add `Key Match` marker.
  - Chooses final, semifinal upset, or resource-trap-heavy/high-constraint match from available completed match/move data.
- [x] Add upset marker.
  - Uses seed delta first; falls back conservatively to lower-record over higher-record when enough record data exists.
- [x] Add finalist path cards.
  - Champion path and runner-up path show opponents, scores, and short evidence.
- [x] Add beginner/advanced toggle for match story/log density.
  - Main story stays compact; full match-by-match log lives in an expandable advanced section.

Acceptance criteria:
- [x] Completed tournament page answers “why did this bracket matter?” above the fold.
- [x] A viewer can identify the key match and key tactical swing in under 30 seconds.
- [x] `npm run lint` and build pass.

### Phase 4 — Credit-Entry Legitimacy Test
Status: **DONE / first small credit-entry test completed**

Goal: test non-money credit risk only after users have evidence to make a reasoned choice.

Checklist:
- [x] Run one small intentional credit-entry bracket.
  - Completed 4-agent BO3 Scarcity Duel: `cmoq4fn0d000004jy1t18hia8`, 10 CR entry, 40 CR prize pool.
- [x] Verify settlement and visible credit deltas.
  - Winner The Wicker Judge net +30 CR; each other entrant net -10 CR; all locked credits returned to 0; repeated settle was idempotent.
- [x] Add post-bracket review note:
  - See `PHASE4_CREDIT_ENTRY_TEST_2026-05-03.md`.
- [x] Do not add public real-money messaging.

Acceptance criteria:
- [x] User can explain the bracket result using visible scouting + match evidence.
- [x] Credits/SOL/real-money boundaries remain unmistakable.
- [x] No public unsafe write controls are exposed.

### Phase 5 — Audit / Fairness Hardening
Status: **FOUNDATION IMPLEMENTED LOCALLY / STILL REQUIRED BEFORE REAL STAKES**

Checklist:
- [x] Store/display prompt/model/version hashes.
  - Implemented as public-safe provenance policy hash on tournament detail pages and audit export; raw custom prompts remain private.
- [x] Store/display move/reasoning hashes or audit export.
  - Tournament detail pages display completed-bracket and move/reasoning hashes; `/api/tournaments/[tournamentId]/audit` downloads reviewable JSON.
- [x] Declare bracket seed method publicly.
  - Current conservative label: operator / entry-order seeding.
- [ ] Decide random/ranked/commit-reveal seeding path.
- [ ] Add anti-spam/eligibility limits for public tournaments.
- [ ] Decide what level of prompt visibility balances trust vs cloning risk.

Acceptance criteria:
- [x] A completed bracket can be exported/reviewed without trusting the operator blindly.
- [x] Public users can see how participants were seeded.
- [x] The system has a written “not real-money ready until…” gate.

Implementation note 2026-05-03: this is a foundation, not full real-stakes readiness. Remaining requirements are now explicit in product copy: per-move provider/model/version persistence, public seed draw/ranking proof, prompt attestations without exposing private prompts, adversarial replay/dispute procedures, and legal/compliance review.

## Current Recommendation

Phase 5 audit/fairness foundation is implemented locally. Next recommendation: review/deploy it, then continue deeper fairness work before any broader credit-entry or real-stakes expansion.

Do not spend the next sprint on:
- real-money betting,
- wallet/escrow polish,
- public stake expansion beyond credits,
- more large showcase brackets,
- or new game modes.

Those are less important than proving users can explain a bracket result from visible scouting + story evidence.

## Next Implementation Ticket

`IH-065` — Deeper audit/fairness hardening

Definition of done:
- Decide and implement random/ranked/commit-reveal seeding path.
- Persist per-move provider/model/version metadata and prompt commits at decision time.
- Design prompt commit/reveal or private review escrow without exposing private prompts.
- Add anti-spam/eligibility limits for public tournaments.
