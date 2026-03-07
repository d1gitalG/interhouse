# InterHouse Agent System — Build Task

You are building InterHouse — an AI Agent Battle Arena where AI agents play games on behalf of their human owners.

## What exists already
- Next.js App Router + TypeScript + Tailwind
- Prisma + SQLite (dev.db), schema in prisma/
- Dependencies: zod, tanstack-query, zustand, solana wallet-adapter

## Task 1: Update Prisma schema (prisma/schema.prisma)

Add these enums and models:

```prisma
enum House { RED GREEN BLUE YELLOW }
enum StrategyProfile { AGGRESSIVE DEFENSIVE CHAOTIC CALCULATED ADAPTIVE }
enum AgentTier { ROOKIE CONTENDER CHAMPION ELITE }
enum AgentTool { BOARD_ANALYZER WIN_PROBABILITY MOVE_HISTORY }
enum GameType { RPS TTT C4 CHESS CHECKERS }
enum MatchStatus { WAITING ACTIVE COMPLETED CANCELLED }
enum StakeMode { CREDITS SOL }
enum SeriesType { QUICK BO3 BO5 }

model User {
  id        String   @id @default(cuid())
  walletAddress String @unique
  agents    AgentProfile[]
  createdAt DateTime @default(now())
}

model AgentProfile {
  id                 String          @id @default(cuid())
  nftMint            String          @unique
  name               String
  house              House
  strategyProfile    StrategyProfile
  tier               AgentTier       @default(ROOKIE)
  xp                 Int             @default(0)
  wins               Int             @default(0)
  losses             Int             @default(0)
  credits            Int             @default(1000)
  customSystemPrompt String?
  toolsEnabled       AgentTool[]
  ownerId            String
  owner              User            @relation(fields: [ownerId], references: [id])
  participants       MatchParticipant[]
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
}

model Match {
  id            String           @id @default(cuid())
  game          GameType
  status        MatchStatus      @default(WAITING)
  stakeMode     StakeMode
  stakeAmount   Int
  series        SeriesType
  currentRound  Int              @default(1)
  challengeCode String           @unique @default(cuid())
  participants  MatchParticipant[]
  moves         Move[]
  winnerId      String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}

model MatchParticipant {
  id        String       @id @default(cuid())
  matchId   String
  match     Match        @relation(fields: [matchId], references: [id])
  agentId   String
  agent     AgentProfile @relation(fields: [agentId], references: [id])
  score     Int          @default(0)
  isCreator Boolean      @default(false)
}

model Move {
  id         String   @id @default(cuid())
  matchId    String
  match      Match    @relation(fields: [matchId], references: [id])
  agentId    String
  round      Int
  move       String
  reasoning  String?
  commitHash String?
  createdAt  DateTime @default(now())
}
```

## Task 2: Create lib/agent-engine.ts

This is the core — it takes game state + agent config, calls Claude, returns a move + reasoning.

```typescript
import Anthropic from "@anthropic-ai/sdk";

export interface GameState {
  game: "RPS" | "TTT" | "C4";
  round: number;
  board?: string[][] | null;
  moveHistory?: Array<{ agentId: string; move: string; round: number }>;
  availableMoves: string[];
}

export interface AgentConfig {
  strategyProfile: "AGGRESSIVE" | "DEFENSIVE" | "CHAOTIC" | "CALCULATED" | "ADAPTIVE";
  tier: "ROOKIE" | "CONTENDER" | "CHAMPION" | "ELITE";
  toolsEnabled: string[];
  customSystemPrompt?: string;
  agentName: string;
  house: string;
}

export interface AgentMoveResult {
  move: string;
  reasoning: string;
  toolsUsed: string[];
  thinkingMs: number;
}

const STRATEGY_PROMPTS = {
  AGGRESSIVE: "You play to dominate. Take calculated risks. Go for the kill move.",
  DEFENSIVE: "You play not to lose. Wait for opponent mistakes. Protect your position at all costs.",
  CHAOTIC: "You are unpredictable. Randomize your choices. Never let them read you.",
  CALCULATED: "You play optimal moves only. No emotion. Pure logic and probability.",
  ADAPTIVE: "You study your opponent patterns. Identify their tendencies. Adapt mid-match.",
};

const TOOLS_BY_TIER = {
  ROOKIE: [],
  CONTENDER: ["BOARD_ANALYZER"],
  CHAMPION: ["BOARD_ANALYZER", "WIN_PROBABILITY"],
  ELITE: ["BOARD_ANALYZER", "WIN_PROBABILITY", "MOVE_HISTORY"],
};

function buildSystemPrompt(config: AgentConfig): string {
  const base = `You are ${config.agentName}, an AI agent competing in the InterHouse battle arena for House ${config.house}.
${STRATEGY_PROMPTS[config.strategyProfile]}
You must respond with ONLY a JSON object: {"move": "<your move>", "reasoning": "<brief explanation>"}
The move must be one of the available moves provided.`;
  return config.customSystemPrompt ? `${base}\n\nCustom directive: ${config.customSystemPrompt}` : base;
}

function applyBoardAnalyzer(gameState: GameState): string {
  if (!gameState.board) return "";
  return `\n[BOARD ANALYZER] Current board:\n${gameState.board.map(r => r.join("|")).join("\n")}`;
}

function applyWinProbability(gameState: GameState): string {
  return `\n[WIN PROBABILITY] Estimate win probability for each move based on game theory optimal play.`;
}

function applyMoveHistory(gameState: GameState): string {
  if (!gameState.moveHistory?.length) return "";
  const opp = gameState.moveHistory.filter(m => m.agentId !== "self");
  return `\n[MOVE HISTORY] Opponent moves so far: ${opp.map(m => m.move).join(", ")}`;
}

export async function getAgentMove(gameState: GameState, config: AgentConfig): Promise<AgentMoveResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const start = Date.now();
  const toolsUsed: string[] = [];
  const availableTools = TOOLS_BY_TIER[config.tier] || [];

  let toolContext = "";
  if (availableTools.includes("BOARD_ANALYZER")) {
    toolContext += applyBoardAnalyzer(gameState);
    toolsUsed.push("BOARD_ANALYZER");
  }
  if (availableTools.includes("WIN_PROBABILITY")) {
    toolContext += applyWinProbability(gameState);
    toolsUsed.push("WIN_PROBABILITY");
  }
  if (availableTools.includes("MOVE_HISTORY")) {
    toolContext += applyMoveHistory(gameState);
    toolsUsed.push("MOVE_HISTORY");
  }

  const userMessage = `Game: ${gameState.game} | Round: ${gameState.round}
Available moves: ${gameState.availableMoves.join(", ")}${toolContext}
Make your move.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 256,
    system: buildSystemPrompt(config),
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(text);

  return {
    move: parsed.move,
    reasoning: parsed.reasoning,
    toolsUsed,
    thinkingMs: Date.now() - start,
  };
}
```

Install the Anthropic SDK: `npm install @anthropic-ai/sdk`

## Task 3: API Routes

Create these files:

**app/api/agents/route.ts** — GET returns mock agent list, POST creates an AgentProfile

**app/api/matches/route.ts** — POST creates a match, GET lists active matches

**app/api/matches/[id]/move/route.ts** — POST triggers agent move (calls getAgentMove from agent-engine)

## Task 4: Agent Config Page (app/agent/page.tsx)

Simple dark-themed page showing:
- Form to create an agent (name, house, strategy profile)
- Display agent stats (W/L/XP/Tier/Credits)
- Show unlocked tools based on tier

House colors: Red=#DC2626, Green=#16A34A, Blue=#2563EB, Yellow=#CA8A04

## Task 5: Run migration
```
npx prisma migrate dev --name agent-system
```

## When done
Run: openclaw system event --text "Done: InterHouse agent system built" --mode now
