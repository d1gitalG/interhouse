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
} as const;

const TOOLS_BY_TIER: Record<string, string[]> = {
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
      if (typeof parsed.move !== "string") continue;
      return {
        move: parsed.move,
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
    : ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

  let lastError = "";

  for (const model of modelCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      lastError = `GEMINI_REQUEST_FAILED:${response.status}:${err}`;
      // Try next model only when model is unavailable.
      if (response.status === 404) continue;
      throw new Error(lastError);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

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
  const userMessage = `Game: ${gameState.game} | Round: ${gameState.round}
Available moves: ${gameState.availableMoves.join(", ")}${toolContext}
Make your move.`;

  try {
    // Prefer Gemini when key is available (your current setup), fallback to Anthropic.
    const parsed = process.env.GEMINI_API_KEY
      ? await callGemini(systemPrompt, userMessage)
      : await callAnthropic(systemPrompt, userMessage);

    return {
      move: parsed.move,
      reasoning: parsed.reasoning,
      toolsUsed,
      thinkingMs: Date.now() - start,
    };
  } catch {
    // Resilience fallback: never hard-fail a match turn due to model/provider formatting issues.
    const fallbackMove = pickDeterministicFallbackMove(gameState, config);
    return {
      move: fallbackMove,
      reasoning: "Fallback move used due to provider response error.",
      toolsUsed,
      thinkingMs: Date.now() - start,
    };
  }
}
