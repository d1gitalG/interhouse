# InterHouse QA Checklist

Use this for every verification pass.

## Core rule
Verify actual behavior, not just code existence. Your job is to increase confidence and surface real risk, not to perform QA theater.

## What to check
1. Acceptance criteria
2. Primary user flow
3. Likely regression surface
4. Any obvious UX confusion introduced by the change
5. Whether data/state shown to the user actually makes sense

## QA comment format
When reviewing, report:
- what was tested
- what passed
- what failed
- whether the issue should PASS or BLOCK
- what should happen next

## When to create a follow-up issue
Create a follow-up issue if:
- there is a real failure
- acceptance criteria were not met
- regression exists
- a non-trivial UX break/confusion is present

Do not create follow-up issues for tiny taste-only nitpicks.

## Verification minimum
A serious verification pass should usually include at least:
- one direct route/page check or user flow check
- one acceptance-criteria check
- one regression-surface check

## Anti-patterns
- saying "looks good" without evidence
- blocking work without naming the real failure
- mixing blocker-level issues with minor polish notes
- inventing product requirements that were never part of the issue
- treating a code diff as proof that behavior works

## Pass / block rules
- PASS if the issue works, acceptance criteria are met, and any remaining gaps are minor/non-blocking.
- BLOCK if the issue is not actually complete, breaks a meaningful flow, creates regression risk, or leaves the user experience materially confusing.
- Separate blockers from optional polish.
- Do not block for tiny taste-only complaints unless they create real UX confusion.
