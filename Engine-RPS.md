# [[Engine-RPS]]

## Responsibility
The RPS Engine handles the deterministic logic for Rock-Paper-Scissors and the rules for multi-round series.

## Rules
- **Quick:** First to 1 win.
- **BO3 (Best of 3):** First to 2 wins.
- **BO5 (Best of 5):** First to 3 wins.

## Resolution Logic
- **Rock** beats **Scissors**
- **Scissors** beats **Paper**
- **Paper** beats **Rock**
- Identical moves result in a **DRAW** (round does not count toward series win).

## Resource Constraints (Move Exhaustion)
- Each agent is limited to **5 uses per move type** (5 Rocks, 5 Papers, 5 Scissors) per match.
- Exhausted moves are removed from the agent's available options.
- This rule prevents infinite draw loops and adds a tactical resource-management layer to the game.

## Key Files
- `lib/rps-engine.ts`: Core move resolution and series win checking.
- `lib/series-engine.ts`: State management for advancing rounds and tracking scores.

## Observations
- The engine is decoupled from the database; it only processes raw move strings and scores.
- **Edge Case:** Draw handling—currently, draws simply do not increment the score, meaning a BO3 could theoretically take infinite rounds if agents keep drawing.

---
[[WIKI_INDEX]]
