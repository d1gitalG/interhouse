# InterHouse Fairness Next Slice Decision

_Date: 2026-05-07_

## Context
Phase 5 audit/fairness transparency foundation is deployed and production-smoked. Current public audit exports already show:

- seed method label/detail for the current operator / entry-order model
- public-safe prompt/model provenance policy hash
- completed bracket hash and move/reasoning hashes
- explicit `realMoneyReady=false` gates

The remaining trust gaps are deeper than copy: seeding is not independently provable, per-move provider metadata is not persisted, private prompts have no attestable commit/reveal path, and public tournament eligibility/anti-spam controls are not yet defined.

## Decision
**Next slice: per-move provider/model/version metadata + prompt commit hash persistence at decision time.**

This should be the next implementation slice before random/ranked/commit-reveal seeding or eligibility controls.

## Why this slice first

1. **It closes the audit export’s most concrete known gap.**
   `lib/tournament-audit.ts` currently states that exact per-move provider response metadata is not persisted yet. Fixing this turns a disclosed weakness into durable evidence.

2. **It is lower-risk than public seeding changes.**
   Seeding policy affects product fairness and tournament format design. Metadata persistence is mostly internal plumbing and can be shipped without changing public tournament behavior.

3. **It supports every later fairness path.**
   Random seeding, ranked seeding, commit-reveal seeding, and prompt escrow all become more credible if each move already carries immutable provider/model/prompt-commit evidence.

4. **It preserves private-agent prompt protection.**
   Persisting a prompt commit hash avoids exposing raw custom prompts while creating a future review/dispute anchor.

## Proposed implementation boundary

### In scope
- Add nullable move-level audit fields, for example:
  - `providerName`
  - `providerModel`
  - `providerModelVersion` or resolved model identifier
  - `agentEngineVersion`
  - `promptCommitHash`
  - optional `providerRequestId` / response metadata if safely available
- Populate these fields when an agent move is generated, not after the match.
- Include the fields in the public-safe tournament audit export.
- Update the audit UI/gate copy so it no longer says per-move provider metadata is missing once verified.
- Add a local verification script or smoke note proving new moves include metadata and the audit export includes it.

### Out of scope for this slice
- Public random draw UX.
- Ranked seeding policy.
- Commit/reveal seeding.
- Public entry eligibility/anti-spam enforcement.
- Raw private prompt exposure.
- Any real-money, SOL, or broader credit-entry expansion.

## Definition of done
- New production-created tournament/match moves have per-move provider/model/version and prompt commit fields persisted.
- Existing tournaments remain readable with null/legacy audit metadata.
- `/api/tournaments/[tournamentId]/audit` includes the new fields without exposing raw `customSystemPrompt`.
- `npm run lint` and Postgres-shaped `npm run build` pass.
- A smoke note records one new match/tournament audit sample and confirms `realMoneyReady` remains `false`.

## Next implementation ticket
`IH-065A` — Persist move-level audit provenance.

Recommended coding-agent handoff: implement only the persistence/export slice above, then update `STATUS.md`, `QUEUE.md`, and this decision doc with verification evidence.
