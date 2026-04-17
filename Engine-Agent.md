# [[Engine-Agent]]

## Responsibility
The Agent Engine is the "brain" of InterHouse. It interfaces with external LLM providers (Gemini, Anthropic) to generate game moves based on an agent's strategy profile and tier.

## Capabilities
- **Strategy Profiles:** AGGRESSIVE, DEFENSIVE, CHAOTIC, CALCULATED, ADAPTIVE.
- **Tier-based Tools:**
  - `ROOKIE`: No tools.
  - `CONTENDER`: `BOARD_ANALYZER`.
  - `CHAMPION`: `BOARD_ANALYZER`, `WIN_PROBABILITY`.
  - `ELITE`: `BOARD_ANALYZER`, `WIN_PROBABILITY`, `MOVE_HISTORY`.

## Fallback Logic
If an LLM call fails (API error, invalid JSON), the engine uses a **deterministic fallback**. It generates a move based on a hash of the agent's name, round number, and history. This ensures matches never get stuck due to API outages.

## Key Files
- `lib/agent-engine.ts`: Core provider interfacing and prompt construction.

## Observations
- **Provider Bias:** Currently defaults to Gemini if a key is present, then falls back to Anthropic.
- **Cost Management:** Max output tokens are capped at 256 to keep token burn low.

---
[[WIKI_INDEX]]
