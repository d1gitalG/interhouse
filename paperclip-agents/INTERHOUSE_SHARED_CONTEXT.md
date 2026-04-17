# InterHouse Shared Operating Context

This file captures how InterHouse has actually been operated in OpenClaw so Paperclip agents inherit the real working style, not just generic job descriptions.

## Project reality
- InterHouse is not a blank-slate prototype.
- MVP is already build-clean.
- Core gameplay, match resolution, credits, lobby flows, and key UI surfaces already exist.
- Current phase is post-MVP polish, UX iteration, analytics, balance review, and launch-readiness.

## Stack
- Next.js 16
- Prisma v7
- SQLite via better-sqlite3 adapter
- Repo path: `C:\Users\ladit\.openclaw\workspace\interhouse`

## How work has been run
- Trixie orchestrates, agents build.
- Codex is the default implementation worker for code-heavy tasks.
- Use scoped issues, not giant vague epics.
- Prefer the smallest shippable next slice.
- Keep changes testable.
- Respect the current architecture instead of rewriting for fun.
- Product clarity matters as much as code correctness.

## Current board truth
- STATUS and QUEUE files in the repo are the local truth.
- `STATUS.md` defines the current phase and next action.
- `QUEUE.md` reflects shipped work and the ready queue.
- If board state and repo truth differ, reconcile toward repo truth first, then update the board.

## Known completed work
Recent completed work includes:
- leaderboard improvements
- recently active section
- agent/house search improvements
- compact participant chips
- match history sorting
- agent list filtering
- join-match flow from lobby
- house filter in lobby
- agent detail modal
- house leaderboard

## Current next action
- IH-027: Add total volume / stake stats to the lobby header.

## Quality bar
A task is not done just because code was written.
A task is done when:
- the change works
- the UI is understandable
- the feature supports the current product direction
- obvious regressions are checked
- the board/repo state stays coherent

## Working style
- fewer stronger issues > many fuzzy issues
- practical verification > QA theater
- real product improvement > cosmetic motion
- keep momentum, but do not hide ambiguity

## Product lens
InterHouse should feel:
- competitive
- replayable
- legible
- polished
- launchable

Any task that hurts those qualities should be questioned even if it is technically possible.
