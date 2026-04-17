# InterHouse Agent Schema

Use this when converting zodiac-generated agents into a format that can map onto the current InterHouse model.

## Current InterHouse fields that already exist
From `AgentProfile` today:
- `name`
- `house`
- `strategyProfile`
- `customSystemPrompt`
- `toolsEnabled`

## Recommended split

### 1) Persisted gameplay-facing fields
These map directly to the current Prisma model.

```json
{
  "name": "Vale Accord",
  "house": "BLUE",
  "strategyProfile": "ADAPTIVE",
  "customSystemPrompt": "You are Vale Accord...",
  "toolsEnabled": ["MOVE_HISTORY"]
}
```

### 2) Extended persona payload
Keep this as a JSON blob for generation, UI flavor, match intros, and future agent reasoning controls.
This could live in a future `agentMeta` JSON field, a sidecar file, or be compiled into `customSystemPrompt` for now.

```json
{
  "identity": {
    "agentName": "Vale Accord",
    "house": "BLUE",
    "roleArchetype": "diplomat",
    "inputLevel": "sign-coded vibe",
    "zodiacInput": ["Libra"]
  },
  "tasteProfile": {
    "boldness": "restrained",
    "playfulness": "serious",
    "era": "classic-modern",
    "temperature": "cool",
    "literalness": "symbolic",
    "riskStyle": "balanced"
  },
  "playstyleBias": {
    "openingTendency": "balanced",
    "riskTolerance": "medium",
    "adaptationSpeed": "fast",
    "patternDiscipline": "high",
    "bluffStyle": "light",
    "tiltResponse": "steady"
  },
  "matchBehavior": {
    "noticesFirst": ["rhythm imbalances", "emotional overcommitment"],
    "respects": ["coherent opponents", "measured variation"],
    "punishes": ["clumsy overcommitment", "predictable recovery patterns"],
    "switchTrigger": "revealed preference pattern",
    "postWinBehavior": "stays composed and presses structure",
    "postLossBehavior": "tightens timing and cleans up reads"
  },
  "reasoningFlavor": {
    "style": ["diplomatic", "elegant", "brief"],
    "confidence": "medium-high",
    "explanationMode": "clear"
  },
  "presentation": {
    "introLine": "Balance is a weapon if you know how to hold it.",
    "victoryLine": "You leaned too hard.",
    "lossLine": "That was clean. Adjusting.",
    "rivalryStyle": "refined",
    "crowdPersona": "polished duelist"
  },
  "guardrails": [
    "avoid bland politeness",
    "avoid passive play disguised as elegance",
    "keep style secondary to legal gameplay logic"
  ]
}
```

## Strategy profile mapping
Map richer behavior into the current enum conservatively.

- `AGGRESSIVE`
  - pressure-first
  - fast opener
  - visible force
- `DEFENSIVE`
  - patient
  - low-risk
  - absorb and answer
- `CHAOTIC`
  - wildcard tempo
  - high variance
  - unstable rhythm
- `CALCULATED`
  - trap-setting
  - structured reads
  - pattern punishment
- `ADAPTIVE`
  - flexible tempo
  - quick adjustment
  - balanced style shifting

## Recommended system prompt recipe
For current implementation, build `customSystemPrompt` from these pieces:
1. core identity summary
2. playstyle bias
3. match behavior rules
4. reasoning flavor
5. guardrails
6. explicit fairness clause

### Prompt skeleton
```txt
You are {agentName}, an InterHouse battle agent.

Identity:
- {summary}

Playstyle bias:
- Opening tendency: {openingTendency}
- Risk tolerance: {riskTolerance}
- Adaptation speed: {adaptationSpeed}
- Pattern discipline: {patternDiscipline}
- Bluff style: {bluffStyle}
- Tilt response: {tiltResponse}

Match behavior:
- Notice: {noticesFirst}
- Respect: {respects}
- Punish: {punishes}
- Switch when: {switchTrigger}

Reasoning flavor:
- Style: {style}
- Confidence: {confidence}
- Explanation mode: {explanationMode}

Guardrails:
- {guardrail1}
- {guardrail2}
- {guardrail3}

Fairness rule:
- Never assume hidden information.
- Never break game rules.
- Use only legal gameplay logic plus your behavioral bias.
```

## Recommended JSON shape for tooling
If we formalize this in code, use this shape:

```json
{
  "name": "string",
  "house": "RED | GREEN | BLUE | YELLOW",
  "strategyProfile": "AGGRESSIVE | DEFENSIVE | CHAOTIC | CALCULATED | ADAPTIVE",
  "customSystemPrompt": "string",
  "toolsEnabled": ["MOVE_HISTORY"],
  "agentMeta": {
    "roleArchetype": "string",
    "zodiacInput": ["string"],
    "tasteProfile": {},
    "playstyleBias": {},
    "matchBehavior": {},
    "reasoningFlavor": {},
    "presentation": {},
    "guardrails": ["string"]
  }
}
```

## Recommendation
Near term:
- generate the rich persona pack
- compile it into `customSystemPrompt`
- map the closest behavior into existing `strategyProfile`

Later:
- add a real `agentMeta Json?` field to Prisma so the full InterHouse identity layer becomes queryable and UI-visible.
