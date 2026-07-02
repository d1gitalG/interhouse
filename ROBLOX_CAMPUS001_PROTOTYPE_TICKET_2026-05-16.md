# InterHouse Sports Day - Campus 001 Prototype Ticket

_Date: 2026-05-16_
_Status: builder-ready v0.1 ticket_

## Goal

Build the first playable Roblox prototype for **Campus 001**.

The prototype should prove the core loop:

> enroll as a weak first-year -> join a House -> train -> improve -> contribute House XP -> see the larger school world waiting.

## Product Frame

Big mythology. Focused first campus.

This is not the whole InterHouse universe. It is the first playable school seed that shows the world is bigger through visible future hooks.

## Player First 10 Minutes

1. Spawn in Campus 001 courtyard.
2. Enroll as a first-year student.
3. Join or receive one of four Houses.
4. Try Sprint and feel slow/rough.
5. Try Long Jump and mistime takeoff.
6. Try Sigil Clash and learn the counter triangle.
7. Earn personal event mastery.
8. Add points to House XP.
9. Receive one coach hint.
10. Notice future hooks: trophy hall, alumni wall, term calendar, inter-school board.

## v0.1 Event Roster

### Core Full Events

1. **100m Sprint**
2. **Long Jump**
3. **Sigil Clash**

### Activity / Training Stations

4. **Target Throw**
5. **Chant Timing**
6. **Sprint Start Reaction**
7. **Takeoff Timing**

## v0.2 Backlog Events

- Relay
- Table Tennis
- Penalty Shootout
- Basketball Free Throw
- Banner Painting

## Campus Layout

Required zones:

- **Spawn Courtyard**: first entry point, enrollment prompt, school identity.
- **House Corners / House Areas**: four visible House zones with color, banner, and scoreboard presence.
- **Track Field**: Sprint and Sprint Start Reaction.
- **Jump Pit**: Long Jump and Takeoff Timing.
- **Sigil Court**: Sigil Clash.
- **Throwing Lane**: Target Throw.
- **Assembly / Spirit Area**: Chant Timing.
- **Main Scoreboard**: House XP totals and current term.
- **Trophy Hall Entrance**: visible but mostly locked.
- **Coach Office Facade**: source of coach hints.
- **Term Calendar Board**: shows current term and future Sports Day.
- **Inter-School Notice Board**: placeholder for future inter-school events.
- **Future Campus Map**: locked future schools/campuses.

## Data Model

### Student

Fields:

- `studentId`
- `playerUserId`
- `displayName`
- `yearLevel` default `Year1`
- `houseId`
- `createdAt`
- `active`
- `sprintMastery`
- `jumpMastery`
- `tacticMastery`
- `throwMastery`
- `spiritMastery`
- `disciplineHidden`
- `aptitudeHiddenByEvent`
- `pressureHidden`
- `fatigue`
- `injuryStatus`
- `injuryRecoveryUntil`

Notes:

- Raw hidden values are not shown to players.
- Mastery values can be visible as broad bands: Novice, Regular, Specialist.

### House

Fields:

- `houseId`
- `name`
- `color`
- `sigil`
- `chant`
- `xpTotal`
- `termRank`

### EventAttempt

Fields:

- `attemptId`
- `studentId`
- `houseId`
- `eventType`
- `score`
- `masteryGain`
- `houseXpGain`
- `coachHintKey`
- `fatigueGain`
- `injuryRiskApplied`
- `createdAt`

### CoachHint

Fields:

- `hintKey`
- `eventType`
- `triggerCondition`
- `messageTemplate`
- `tone`

## Event Mechanics

### 100m Sprint

Purpose: prove physical improvement.

Mechanics:

- player starts with low base speed
- start timing affects launch
- staying in lane avoids penalty
- finish time determines score
- repeat attempts improve sprint mastery and discipline

Scoring:

- time score
- start reaction bonus
- lane discipline bonus
- House XP based on completion and performance band

Coach hints:

- `Your start was late, but your stride is improving.`
- `You are getting useful in sprint drills.`
- `Your stamina fades near the end. Train more starts and finishes.`

### Long Jump

Purpose: prove technique and timing.

Mechanics:

- player runs up
- takeoff timing window
- jump distance based on timing + jump mastery
- landing quality affects score

Scoring:

- distance
- takeoff timing
- landing control
- House XP based on clean attempt and improvement

Coach hints:

- `Your takeoff was early.`
- `You have field-event potential if you keep training.`
- `Better rhythm. Your approach is improving.`

### Sigil Clash

Purpose: preserve InterHouse mind-game identity.

Rules:

- Blade beats Veil
- Veil beats Spark
- Spark beats Blade

Mechanics:

- best-of-3 practice duel
- opponent can be NPC, House captain, or simple bot
- player chooses sigil each round
- result screen shows simple read/plan text

Scoring:

- round wins
- counter-read bonus
- variety bonus
- tactic mastery gain
- House XP gain

Coach hints:

- `You overused Blade.`
- `Good counter-read. Your pressure rating is improving.`
- `You guessed well, but repeated too quickly.`

### Target Throw

Purpose: introduce throwing/strength path cheaply.

Mechanics:

- charge meter
- angle/release timing
- target accuracy

Scoring:

- accuracy
- release timing
- power control
- throw mastery gain

### Chant Timing

Purpose: let non-athletic players contribute to House score.

Mechanics:

- rhythm/call-and-response timing
- simple button prompts
- group bonus if multiple House members participate

Scoring:

- timing streak
- participation
- group sync
- spirit mastery gain

### Sprint Start Reaction

Purpose: micro-drill for sprint improvement.

Mechanics:

- wait for signal
- react quickly without false start

Scoring:

- reaction time
- false start penalty
- small sprint mastery gain

### Takeoff Timing

Purpose: micro-drill for jump improvement.

Mechanics:

- moving timing marker
- press within takeoff window

Scoring:

- timing accuracy
- consistency
- small jump mastery gain

## Progression Rules v0.1

- Players start weak on purpose.
- Every event gives small mastery gain.
- Repeated completion raises discipline hidden value.
- Strong event performance nudges aptitude for that event.
- Practice meet or trial-like conditions can nudge pressure hidden value.
- Specialization emerges from what players repeatedly choose.
- Training too much raises fatigue and injury risk.

Do not allow players to max everything quickly.

Use broad visible bands:

- Novice
- House Regular
- Specialist

## Fatigue / Injury System v0.1

Purpose: prevent all-day grind from being optimal and make training feel like real school sports.

Principle:

> You can train hard, but you cannot train forever.

### Fatigue

Each event attempt adds fatigue. Fatigue should lower performance before it creates injury.

Suggested fatigue effects:

- slower sprint finish
- worse long-jump timing window
- weaker throw control
- lower Sigil Clash pressure consistency
- reduced House XP bonus for repeated exhausted attempts

Fatigue should recover over time, between sessions, or through rest activities.

### Injury Risk

Injury risk increases when a player keeps training while fatigue is high.

Injury should not feel like random punishment. It should feel like the result of ignoring warnings.

Use warning hints first:

- `Coach: You're tired. Rest before you push again.`
- `Trainer: Your form is slipping. Injury risk is rising.`
- `Captain: We need you healthy for trials.`

### Injury Types

Use light, school-sport-safe injuries:

- **Minor strain**: affects 1-2 event attempts.
- **Soreness**: lowers performance temporarily.
- **Pulled muscle**: sidelines a specific event lane for a short cooldown.
- **Overuse fatigue**: reduces mastery gain until rested.

Avoid graphic or scary injury presentation.

### Recovery

Recovery options:

- rest period / cooldown timer
- low-impact House Spirit activity
- coach recovery drill
- visit nurse/trainer NPC
- skip one practice meet to recover

Recovery should create a decision, not make the game unplayable.

### Design Guardrail

Do not let injury permanently ruin a student.

In v0.1, injuries should:

- slow progress
- affect a few attempts/games
- encourage rest and smarter planning
- create tension before trials

They should not:

- delete progress
- permanently lower hidden potential
- feel unavoidable
- punish casual players harshly

## House XP Rules

Every completed event should give some House XP so casual players matter.

Suggested v0.1 House XP:

- complete event: +5 XP
- good performance: +10 XP
- excellent performance: +15 XP
- personal best: +5 bonus
- group spirit event: +2 per synced participant bonus

Numbers are placeholders. Tune after playtests.

## Coach Hint System

Coach hints are the main way hidden mechanics become legible.

Rules:

- show one hint after an event or small session
- hint should explain improvement without exposing raw stats
- hint should nudge specialization
- hint should never shame the player

Examples:

- `Coach sees you becoming a runner.`
- `Your field technique needs more reps.`
- `You perform better in practice than under pressure.`
- `Your House may need you in sprint trials later.`

## Visible Future Hooks

Build these as visual/locked areas:

- locked trophy hall wings
- alumni wall placeholder
- term calendar with future Sports Day
- inter-school notice board
- future campus map
- coach office
- House history plaques

These are not full systems in v0.1. They are world signals.

## Build-In-Public Beats

Record or write about:

1. Building the first campus.
2. Why first-years start weak.
3. How House XP works.
4. How coach hints replace raw hidden stats.
5. Why Sigil Clash keeps the original InterHouse DNA.
6. How future hooks point to graduation and inter-school competition.

## Out of Scope

Do not build in v0.1:

- graduation
- multiple schools
- paid admission
- full Sports Day finals
- inter-school competition
- open AI chat
- player-authored prompts
- Robux prizes
- wagering
- crypto
- paid stat boosts

## Acceptance Criteria

- Player can enroll and join/receive a House.
- Player can complete Sprint, Long Jump, and Sigil Clash.
- Player can complete at least two activity stations.
- Player receives mastery gain from attempts.
- House XP updates visibly.
- Coach hint appears after play.
- Scoreboard shows four Houses.
- Future hooks are visible on campus.
- No pay-to-win mechanics exist.
- No open/freeform AI chat exists.

## Builder Return Format

When implementation starts, return:

- changed files/assets
- implemented zones
- implemented events
- data model status
- known gaps
- test/playthrough notes
- screenshots or video if available

## Next Decision Needed

Before build starts, choose:

1. House names/colors/sigils.
2. House assignment method: choice, sorting trial, or hybrid.
3. Whether prototype begins directly in Roblox Studio or with a greybox design mock first.

Recommended default:

- use placeholder House names/colors
- use hybrid House assignment: player can choose, but entrance trial recommends one
- start with Roblox Studio greybox if tooling is ready
