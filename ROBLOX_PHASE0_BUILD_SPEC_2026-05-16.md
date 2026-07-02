# InterHouse Sports Day - Phase 0 Build Spec

_Date: 2026-05-16_
_Status: Phase 0 design lock draft_

## Product Thesis

InterHouse Sports Day is a Roblox school-life competition universe rooted in Nigerian inter-house sports.

The first build should feel like **Campus 001** of a much larger rite-of-passage world:

> Enroll as a weak first-year. Join a House. Train into a specialist. Represent your House. Show up for Sports Day. Leave legacy behind.

## Build Principle

Big mythology. Focused first campus.

The first playable version must prove the training/House loop, while visibly hinting that graduation, alumni, private/public schools, and inter-school competition are coming later.

## v0.1 Playable Scope

### 1. Campus 001

One school campus with:

- spawn courtyard
- four House areas
- track field
- long-jump pit
- Sigil Clash court
- main scoreboard
- trophy hall entrance
- coach office facade
- term calendar board
- inter-school notice board placeholder

### 2. Four Houses

Each House needs:

- name
- color
- banner/sigil
- spawn area or corner
- scoreboard row
- simple chant/tagline
- House XP total

Temporary placeholder names are fine for build start, but the system should support renaming.

### 3. Student Enrollment

Player flow:

1. Enter campus.
2. Enroll as a first-year student.
3. Pick or receive a House.
4. Complete a short entrance trial.
5. Receive a coach hint.
6. Start with weak stats.

Required feeling: the player is not a champion yet.

### 4. Training Events

Build three event lanes only:

#### Sprint Practice

Purpose: prove physical improvement.

Mechanics:

- slow beginner baseline
- timing-based start
- lane run
- basic speed/stamina improvement
- sprint mastery XP

Coach hint examples:

- `Your start was late, but your stride is improving.`
- `You are becoming useful in sprint drills.`

#### Long Jump Practice

Purpose: prove timing/technique progression.

Mechanics:

- run-up
- takeoff timing
- jump distance
- landing feedback
- jump mastery XP

Coach hint examples:

- `Your takeoff timing is early.`
- `You have field-event potential if you keep training.`

#### Sigil Clash Practice

Purpose: preserve original InterHouse strategy DNA.

Mechanics:

- Blade beats Veil
- Veil beats Spark
- Spark beats Blade
- simple best-of-3 duel
- tactic mastery XP
- short templated reasoning

Coach hint examples:

- `You overused Blade.`
- `Good counter-read. Your pressure rating is improving.`

### 5. House XP

Each practice session awards:

- personal event mastery
- small House XP
- possible coach hint

House XP should visibly move the scoreboard, even if the numbers are temporary.

### 6. Hidden Stats v0.1

Only three hidden fields in v0.1:

- **discipline**: consistency and completion
- **aptitude**: event-specific growth tendency
- **pressure**: performance under trial/final conditions

Do not expose raw numbers.

Player-facing feedback should be hints:

- `Coach sees you becoming a runner.`
- `Your field technique needs more reps.`
- `You perform better in practice than under pressure.`

### 7. Practice Meet

Add one small scheduled or manually triggered practice meet:

- sprint heat
- long-jump attempt
- Sigil Clash duel
- House XP bonus
- meet winner announcement

Important: this is **not** the real Sports Day champion.

## Visible Future Hooks

These do not need full systems yet, but should exist visually:

- locked trophy hall wings
- alumni wall placeholder
- term calendar showing future Sports Day
- inter-school notice board
- school map with locked future campuses
- coach office
- House history plaques

These hooks support build-in-public marketing and make the first campus feel like a world seed.

## Do Not Build Yet

- graduation system
- multiple schools
- paid admission
- inter-school tournaments
- full Sports Day ceremony
- complex AI chat
- open player prompts
- paid stat boosts
- Robux prizes
- crypto or wagering

## AI/LLM v0.1 Boundary

Use AI only behind safe templates or offline design support.

Allowed in v0.1:

- generated coach hint variants from approved templates
- balancing analysis
- internal content generation for House flavor

Not allowed in v0.1:

- unmoderated live chat
- freeform kid-facing AI conversations
- AI deciding outcomes invisibly
- player-authored prompts

## Build-In-Public Content Plan

Record/share the build process around these themes:

1. Why students start weak.
2. Why Houses matter.
3. How training creates specialists.
4. Why hidden aptitude is hinted, not shown.
5. How Sports Day will become the big event.
6. Why no pay-to-win exists.
7. Why the idea comes from Nigerian inter-house sports.

Content should reveal the design philosophy, not every hidden number.

## Proof Gate

Phase 0 is ready to become a builder ticket when this spec answers:

- What can the player do in the first 10 minutes?
- How do they know they improved?
- How does their House benefit?
- What hints at the larger school universe?
- What is explicitly out of scope?

## First 10 Minutes Target

1. Spawn on Campus 001.
2. Enroll as first-year.
3. Join/receive House.
4. Run sprint drill and feel slow.
5. Try long jump and mistime takeoff.
6. Play one Sigil Clash round.
7. See personal mastery move.
8. See House XP move.
9. Get coach hint.
10. Notice trophy hall / term calendar / inter-school board.

## Recommended Next Ticket

Create a Roblox prototype plan for **Campus 001 v0.1** with:

- place layout
- House data model
- student data model
- three event mechanics
- House XP scoreboard
- coach hint system
- visible future hooks

## Open Design Decisions

- House names/colors/sigils.
- Whether House assignment is player choice, sorting trial, or hybrid.
- Exact term length for later seasons.
- Whether first build is in Roblox Studio immediately or mocked as a lightweight design/prototype first.

## Definition of Done

Phase 0 is complete when Gianni approves this as the build target or changes the scope.
