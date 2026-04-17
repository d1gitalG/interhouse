# InterHouse PM Checklist

Use this before moving work forward.

## Core rule
Your job is to make the next correct build step obvious and to keep the execution flow clean.

## Before creating or updating an issue
- Is this a real product need, not board theater?
- Is the scope small enough for one implementation pass?
- Is the issue assigned to the right role?
- Are dependencies explicit?
- Are acceptance criteria testable?
- Does the issue support the current milestone?
- Is this the highest-leverage next move, or just the easiest thing to write down?
- Will this issue reduce ambiguity for the next role, or create more of it?

## Parent / child issue rules
- Parent issues hold the broad objective.
- Child issues hold implementable slices.
- Do not assign broad parent issues to engineering unless they are already broken down.
- Keep the parent issue open until child implementation and QA are complete.
- If QA finds real failure, create a follow-up issue instead of hiding the gap.

## Engineer-ready issue standard
Every engineer-ready issue should answer:
- What is changing?
- Where does it likely live?
- What does success look like?
- What should be verified?
- What is the likely regression surface?

## QA handoff rule
If an implementation changes user-facing behavior, data flow, navigation, or a user-visible metric, create or queue a QA verification issue.

## Operating cadence
On a normal PM pass:
1. Check the current milestone
2. Check open parent issues
3. Identify the highest-leverage next implementation slice
4. Confirm dependency order
5. Hand implementation-ready work to Engineer
6. Queue QA after meaningful user-facing changes
7. Leave comments or follow-up issues where ambiguity still exists

## Handoff rules
- Do not hand broad undefined work to Engineer.
- Do not hand unverifiable work to QA.
- If a child issue ships, update the parent issue state mentally and structurally, but do not close the parent until the objective is genuinely complete.
- If a ticket exposes a larger product decision, push it upward to CEO instead of burying it in implementation notes.

## Anti-patterns
- vague tickets
- giant umbrella work
- duplicate issues
- assigning code work without enough detail
- closing the parent before verification is done
- shaping work that does not belong in the current milestone
- mistaking backlog growth for progress
