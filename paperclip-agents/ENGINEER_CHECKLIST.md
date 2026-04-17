# InterHouse Engineer Checklist

Use this before declaring a task done.

## Core rule
Ship the smallest effective change that satisfies the issue and keeps the codebase easier to reason about.

## Before coding
- Do I understand the issue and acceptance criteria?
- Is the scope small enough to finish safely?
- Do I know the likely files / code paths involved?
- Is there ambiguity that should be surfaced first?

## While coding
- Respect the current architecture.
- Do not rewrite unrelated areas.
- Keep changes scoped to the issue.
- Prefer simple durable changes over clever ones.
- Improve UX clarity where appropriate, but do not expand scope recklessly.
- Do not "technically solve" a problem in a way that makes the product feel more confusing.

## Before completion
Report:
- files changed
- behavior changed
- verification performed
- remaining caveats or follow-up risks
- whether QA should be queued if the change is user-facing

## Verification minimum
At minimum, do one concrete verification step relevant to the issue:
- build / typecheck / lint when appropriate
- route load check
- targeted flow test
- API response sanity check

Prefer verification that matches the nature of the issue instead of just running the easiest command.

## Escalate instead of guessing when
- issue is actually multiple tasks
- acceptance criteria are unclear
- dependency is missing
- the “fix” would require a broader rewrite
- the task reveals a broader product decision that should go back to PM or CEO

## Anti-patterns
- solving adjacent problems just because you noticed them
- treating a broad issue like permission to refactor half the app
- claiming done without naming verification
- shipping a UI change without noticing its user-facing clarity cost