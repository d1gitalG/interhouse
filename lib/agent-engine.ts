import Anthropic from "@anthropic-ai/sdk";

export interface GameState {
  game: "RPS" | "TTT" | "C4";
  round: number;
  board?: string[][] | null;
  moveHistory?: Array<{ agentId: string; move: string; round: number }>;
  availableMoves: string[];
  resourceStatus?: string;
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
} as const;

const TOOLS_BY_TIER: Record<string, string[]> = {
  ROOKIE: [],
  CONTENDER: ["BOARD_ANALYZER"],
  CHAMPION: ["BOARD_ANALYZER", "WIN_PROBABILITY"],
  ELITE: ["BOARD_ANALYZER", "WIN_PROBABILITY", "MOVE_HISTORY"],
};

function buildSystemPrompt(config: AgentConfig): string {
  const base = "You are " + config.agentName + ", an AI agent competing in the InterHouse battle arena for House " + config.house + ".\n" +
STRATEGY_PROMPTS[config.strategyProfile] + "\nYou must respond with ONLY a JSON object: {\"move\": \"<your move>\", \"reasoning\": \"<brief explanation>\"}\nThe move must be one of the available moves provided. Note: You have a limited number of uses for each move type (Resource Exhaustion rule). Manage your resources wisely.";
  return config.customSystemPrompt ? base + "\n\nCustom directive: " + config.customSystemPrompt : base;
}

function applyBoardAnalyzer(gameState: GameState): string {
  if (!gameState.board) return "";
  return `\n[BOARD ANALYZER] Current board:\n${gameState.board.map((r) => r.join("|")).join("\n")}`;
}

function applyWinProbability(): string {
  return "\n[WIN PROBABILITY] Estimate win probability for each move based on game theory optimal play.";
}

function applyMoveHistory(gameState: GameState): string {
  if (!gameState.moveHistory?.length) return "";
  const opp = gameState.moveHistory.filter((m) => m.agentId !== "self");
  return `\n[MOVE HISTORY] Opponent moves so far: ${opp.map((m) => m.move).join(", ")}`;
}

function pickDeterministicFallbackMove(gameState: GameState, config: AgentConfig): string {
  const options = gameState.availableMoves;
  if (options.length === 0) return "ROCK";

  const seed = `${config.agentName}:${config.house}:${gameState.round}:${gameState.moveHistory?.length ?? 0}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return options[hash % options.length] ?? options[0] ?? "ROCK";
}

function normalizeParsedMove(rawMove: unknown): string | null {
  if (typeof rawMove === "string") {
    return rawMove.trim();
  }

  if (
    typeof rawMove === "object" &&
    rawMove !== null &&
    "row" in rawMove &&
    "col" in rawMove &&
    typeof rawMove.row === "number" &&
    typeof rawMove.col === "number"
  ) {
    return `${rawMove.row},${rawMove.col}`;
  }

  return null;
}

function parseAgentJson(text: string): { move: string; reasoning: string } {
  let raw = text.trim();

  // Handle fenced markdown JSON blocks if model returns them.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) raw = fenced[1].trim();

  const candidates = [raw];
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { move?: unknown; reasoning?: unknown };
      const move = normalizeParsedMove(parsed.move);
      if (!move) continue;
      return {
        move,
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "No reasoning provided.",
      };
    } catch {
      // Try next candidate
    }
  }

  throw new Error("INVALID_AGENT_JSON");
}

async function callAnthropic(systemPrompt: string, userMessage: string): Promise<{ move: string; reasoning: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY_MISSING");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  return parseAgentJson(text);
}

async function callGemini(systemPrompt: string, userMessage: string): Promise<{ move: string; reasoning: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");

  const requestedModel = process.env.GEMINI_MODEL;
  const modelCandidates = requestedModel
    ? [requestedModel]
    : ["gemini-3-flash-preview", "gemini-2.0-flash", "gemini-2.5-flash-lite"];

  let lastError = "";

  for (const model of modelCandidates) {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt + "\n\n" + userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      lastError = "GEMINI_REQUEST_FAILED:" + response.status + ":" + err;
      if (response.status === 404 || err.includes("model is deprecated")) continue;
      throw new Error(lastError);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      error?: {
        message: string;
        code: number;
        status: string;
      };
    };

    if (data.error) {
      throw new Error("GEMINI_API_ERROR:" + data.error.message);
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
    return parseAgentJson(text);
  }

  throw new Error(lastError || "GEMINI_REQUEST_FAILED");
}

export async function getAgentMove(gameState: GameState, config: AgentConfig): Promise<AgentMoveResult> {
  const start = Date.now();
  const toolsUsed: string[] = [];
  const availableTools = TOOLS_BY_TIER[config.tier] || [];

  let toolContext = "";
  if (availableTools.includes("BOARD_ANALYZER")) {
    toolContext += applyBoardAnalyzer(gameState);
    toolsUsed.push("BOARD_ANALYZER");
  }
  if (availableTools.includes("WIN_PROBABILITY")) {
    toolContext += applyWinProbability();
    toolsUsed.push("WIN_PROBABILITY");
  }
  if (availableTools.includes("MOVE_HISTORY")) {
    toolContext += applyMoveHistory(gameState);
    toolsUsed.push("MOVE_HISTORY");
  }

  const systemPrompt = buildSystemPrompt(config);
  const tttHint =
    gameState.game === "TTT"
      ? "\nFor TTT, set move as coordinates like \"1,2\" or an object like {\"row\":1,\"col\":2}."
      : "";
  const resourceMsg = gameState.resourceStatus ? `\n[RESOURCES] ${gameState.resourceStatus}` : "";
  const userMessage = "Game: " + gameState.game + " | Round: " + gameState.round + "\nAvailable moves: " + gameState.availableMoves.join(", ") + resourceMsg + toolContext + "\nMake your move." + tttHint;

  try {
    const isGemini = !!process.env.GEMINI_API_KEY;
    const parsed = isGemini
      ? await callGemini(systemPrompt, userMessage)
      : await callAnthropic(systemPrompt, userMessage);

    return {
      move: parsed.move,
      reasoning: parsed.reasoning,
      toolsUsed,
      thinkingMs: Date.now() - start,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[AGENT ENGINE ERROR]", errorMsg);
    const fallbackMove = pickDeterministicFallbackMove(gameState, config);
    return {
      move: fallbackMove,
      reasoning: "Fallback move used due to error: " + errorMsg,
      toolsUsed,
      thinkingMs: Date.now() - start,
    };
  }
}
