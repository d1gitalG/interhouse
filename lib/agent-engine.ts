import Anthropic from "@anthropic-ai/sdk";

export interface GameState {
  game: "RPS" | "TTT" | "C4";
  round: number;
  board?: string[][] | null;
  moveHistory?: Array<{ agentId: string; move: string; round: number }>;
  availableMoves: string[];
  resourceStatus?: string;
  tacticalContext?: {
    selfAgentId: string;
    opponentAgentId: string;
    initiativeRole: "CREATOR" | "CHALLENGER";
    selfScore: number;
    opponentScore: number;
    targetWins: number;
    selfPreviousMoves: string[];
    opponentPreviousMoves: string[];
    lastRound?: {
      round: number;
      selfMove: string;
      opponentMove: string;
      outcome: "WIN" | "LOSS" | "DRAW";
    };
    repetitionWarning?: string;
    opponentRepetitionWarning?: string;
    symmetryAdvice?: string;
    strategyAnalysis?: {
      opponentProfile: string;
      likelyOpponentMove: "ROCK" | "PAPER" | "SCISSORS";
      confidence: number;
      recommendedIntents: string[];
      firstOrderRead: string;
      secondOrderRead: string;
      resourcePressure: string;
      scorePressure: string;
      exploitWarning?: string;
    };
    characterProfile?: {
      archetype: string;
      traits: {
        aggression: number;
        discipline: number;
        adaptability: number;
        deception: number;
        volatility: number;
        composure: number;
      };
      flaw: string;
      voiceCue: string;
      behaviorBias: string;
    };
  };
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

type ParsedAgentMove = {
  move: string;
  reasoning: string;
  predictedOpponentMove?: string;
  intent?: string;
  confidence?: number;
};

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
STRATEGY_PROMPTS[config.strategyProfile] + "\nTactical intents available for RPS: punish-repeat, break-symmetry, bait-counter, resource-denial, match-point-safe, high-risk-read, anti-mirror, bluff-switch. Use an intent that matches your character traits and the strategy analysis. Choose exactly one primary predictedOpponentMove. Do not optimize away your flaw; express it as controlled character. The engine will write match facts. Your reasoning should be only a short character flavor line, max 10 words. Do not mention repeats, prior rounds, rules, resources, seeded opener, strategy analysis, or direct counter.\nYou must respond with ONLY a JSON object. The first character of your response must be `{` and the last character must be `}`. No markdown, no code fence, no preface. Shape: {\"move\": \"<your move>\", \"predictedOpponentMove\": \"<ROCK|PAPER|SCISSORS if RPS>\", \"confidence\": 0.0, \"intent\": \"<one tactical intent>\", \"reasoning\": \"<short character flavor line only>\"}\nThe move must be one of the available moves provided. Note: You have a limited number of uses for each move type (Resource Exhaustion rule). Manage your resources wisely.";
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
  const ctx = gameState.tacticalContext;
  if (ctx) {
    return `\n[MOVE HISTORY] Your moves so far: ${ctx.selfPreviousMoves.join(", ") || "none"}. Opponent moves so far: ${ctx.opponentPreviousMoves.join(", ") || "none"}.`;
  }

  if (!gameState.moveHistory?.length) return "";
  return `\n[MOVE HISTORY] Raw match moves so far: ${gameState.moveHistory.map((m) => `R${m.round}:${m.agentId}:${m.move}`).join(" | ")}`;
}

function buildTacticalContext(gameState: GameState): string {
  const ctx = gameState.tacticalContext;
  if (!ctx) return "";

  const lastRoundResult = ctx.lastRound?.outcome === "WIN"
    ? "you won"
    : ctx.lastRound?.outcome === "LOSS"
      ? "you lost"
      : ctx.lastRound?.outcome === "DRAW"
        ? "draw"
        : null;
  const lastRound = ctx.lastRound
    ? `Last round: you ${ctx.lastRound.selfMove}, opponent ${ctx.lastRound.opponentMove}; ${lastRoundResult}. Do not reverse this.`
    : "Last completed round: none; this is the first decision of the match.";
  const warnings = [ctx.repetitionWarning, ctx.opponentRepetitionWarning].filter(Boolean).join(" ");
  const strategy = ctx.strategyAnalysis
    ? `\n[STRATEGY ANALYSIS]\nOpponent profile: ${ctx.strategyAnalysis.opponentProfile}\nLikely opponent move: ${ctx.strategyAnalysis.likelyOpponentMove} at confidence ${ctx.strategyAnalysis.confidence.toFixed(2)}.\nRecommended intents: ${ctx.strategyAnalysis.recommendedIntents.join(", ")}.\nFirst-order read: ${ctx.strategyAnalysis.firstOrderRead}\nSecond-order read: ${ctx.strategyAnalysis.secondOrderRead}\nResource pressure: ${ctx.strategyAnalysis.resourcePressure}\nScore pressure: ${ctx.strategyAnalysis.scorePressure}\n${ctx.strategyAnalysis.exploitWarning ? `Exploit warning: ${ctx.strategyAnalysis.exploitWarning}\n` : ""}Do not only counter the last move. Consider whether the opponent expects your obvious counter, then choose whether to punish the counter-counter.\n`
    : "";
  const character = ctx.characterProfile
    ? `\n[CHARACTER]\nArchetype: ${ctx.characterProfile.archetype}. Voice cue: ${ctx.characterProfile.voiceCue}.\nTraits: aggression ${ctx.characterProfile.traits.aggression}, discipline ${ctx.characterProfile.traits.discipline}, adaptability ${ctx.characterProfile.traits.adaptability}, deception ${ctx.characterProfile.traits.deception}, volatility ${ctx.characterProfile.traits.volatility}, composure ${ctx.characterProfile.traits.composure}.\nFlaw: ${ctx.characterProfile.flaw}.\nBias: ${ctx.characterProfile.behaviorBias}\nLet this character shape the move, not just the wording.\n`
    : "";

  return `\n[TACTICAL CONTEXT]\nYour initiative role: ${ctx.initiativeRole}.\nScore: you ${ctx.selfScore}, opponent ${ctx.opponentScore}; target wins for this series: ${ctx.targetWins}.\nYour previous moves: ${ctx.selfPreviousMoves.join(", ") || "none"}.\nOpponent previous moves: ${ctx.opponentPreviousMoves.join(", ") || "none"}.\n${lastRound}\n${warnings ? `Pattern warning: ${warnings}\n` : ""}${ctx.symmetryAdvice ? `Symmetry advice: ${ctx.symmetryAdvice}\n` : ""}${character}${strategy}If round > 1, do not describe this as an opener. Adapt to the actual prior moves above. Do not invent prior moves that are not listed.\n`;
}

function buildGameRules(gameState: GameState): string {
  if (gameState.game !== "RPS") return "";

  return `\n[RPS RULES - HARD CONSTRAINTS]\nROCK beats SCISSORS.\nSCISSORS beats PAPER.\nPAPER beats ROCK.\nIf you expect opponent ROCK, choose PAPER.\nIf you expect opponent PAPER, choose SCISSORS.\nIf you expect opponent SCISSORS, choose ROCK.\nYour reasoning must match these rules. Never claim SCISSORS beats ROCK, ROCK beats PAPER, or PAPER beats SCISSORS.\n`;
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

function normalizeRpsMove(rawMove: unknown): "ROCK" | "PAPER" | "SCISSORS" | null {
  if (typeof rawMove !== "string") return null;
  const move = rawMove.trim().toUpperCase();
  return move === "ROCK" || move === "PAPER" || move === "SCISSORS" ? move : null;
}

function getRpsCounter(move: "ROCK" | "PAPER" | "SCISSORS"): "ROCK" | "PAPER" | "SCISSORS" {
  if (move === "ROCK") return "PAPER";
  if (move === "PAPER") return "SCISSORS";
  return "ROCK";
}

function extractFirstBalancedJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth++;
    if (char === "}") depth--;

    if (depth === 0) return raw.slice(start, i + 1);
  }

  return null;
}

function parseAgentJson(text: string): ParsedAgentMove {
  let raw = text.trim();

  // Handle fenced markdown JSON blocks if model returns them.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) raw = fenced[1].trim();

  const candidates = [raw];
  const firstBalanced = extractFirstBalancedJsonObject(raw);
  if (firstBalanced) candidates.push(firstBalanced);
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { move?: unknown; reasoning?: unknown; predictedOpponentMove?: unknown; intent?: unknown; confidence?: unknown };
      const move = normalizeParsedMove(parsed.move);
      if (!move) continue;
      return {
        move,
        predictedOpponentMove: normalizeRpsMove(parsed.predictedOpponentMove) ?? undefined,
        intent: typeof parsed.intent === "string" ? parsed.intent.trim() : undefined,
        confidence: typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : undefined,
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "No reasoning provided.",
      };
    } catch {
      // Try next candidate
    }
  }

  throw new Error("INVALID_AGENT_JSON:" + raw.slice(0, 500));
}

async function callAnthropic(systemPrompt: string, userMessage: string): Promise<ParsedAgentMove> {
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

async function callGemini(systemPrompt: string, userMessage: string): Promise<ParsedAgentMove> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");

  const requestedModel = process.env.GEMINI_MODEL;
  const modelCandidates = requestedModel
    ? [requestedModel]
    : ["gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-3-flash-preview"];

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
          maxOutputTokens: 768,
          responseMimeType: "application/json",
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

function enforceRpsPredictionConsistency(gameState: GameState, parsed: ParsedAgentMove): ParsedAgentMove {
  if (gameState.game !== "RPS") return parsed;
  const predicted = normalizeRpsMove(parsed.predictedOpponentMove);
  const chosen = normalizeRpsMove(parsed.move);
  if (!predicted || !chosen) return parsed;

  const correctCounter = getRpsCounter(predicted);
  if (chosen === correctCounter) return parsed;
  if (!gameState.availableMoves.includes(correctCounter)) return parsed;

  return {
    move: correctCounter,
    predictedOpponentMove: predicted,
    intent: parsed.intent ?? "counter-correction",
    confidence: parsed.confidence,
    reasoning: `I read ${predicted}, so ${correctCounter}. ${correctCounter} beats it.`,
  };
}

function getDisplayIntent(ctx: GameState["tacticalContext"], rawIntent?: string): string | undefined {
  if (!rawIntent) return undefined;
  const intent = rawIntent.trim();
  const opponentMoves = ctx?.opponentPreviousMoves ?? [];
  const opponentRepeated = opponentMoves.length >= 2 && opponentMoves.at(-1) === opponentMoves.at(-2);
  const mirroredDraw = !!ctx?.lastRound && ctx.lastRound.outcome === "DRAW" && ctx.lastRound.selfMove === ctx.lastRound.opponentMove;

  if (intent === "punish-repeat" && !opponentRepeated) {
    return mirroredDraw ? "break-mirror" : "punish-read";
  }

  return intent;
}

function buildLastRoundLabel(ctx: GameState["tacticalContext"]): string | null {
  const last = ctx?.lastRound;
  if (!last) return null;

  if (last.outcome === "DRAW" && last.selfMove === last.opponentMove) {
    return `Last: mirror ${last.selfMove}; draw.`;
  }

  const outcomeText = last.outcome === "WIN" ? "won" : last.outcome === "LOSS" ? "lost" : "draw";
  return `Last: ${last.selfMove} vs ${last.opponentMove}; ${outcomeText}.`;
}

function getCharacterActionLine(params: {
  voiceCue?: string;
  intent?: string;
  chosen?: "ROCK" | "PAPER" | "SCISSORS" | null;
  predicted?: "ROCK" | "PAPER" | "SCISSORS" | null;
}): string {
  const voice = params.voiceCue && params.voiceCue !== "Move." ? params.voiceCue.replace(/[.]+$/, "") : "";
  const phrase =
    params.intent === "break-mirror"
      ? "Break the mirror"
      : params.intent === "punish-repeat"
        ? "Punish the pattern"
        : params.intent === "punish-read"
          ? "Punish the read"
          : params.intent === "bait-counter"
            ? "Let them bite"
            : params.intent === "bluff-switch"
              ? "Cut sideways"
              : params.intent === "anti-mirror"
                ? "Answer the angle"
                : params.intent === "match-point-safe"
                  ? "No gift"
                  : params.intent === "resource-denial"
                    ? "Starve the line"
                    : params.intent === "high-risk-read"
                      ? "Take the read"
                      : params.chosen && params.predicted
                        ? `${params.chosen} into ${params.predicted}`
                        : "Move clean";

  return voice ? `${voice}. ${phrase}.` : `${phrase}.`;
}

function composeRpsReasoning(gameState: GameState, parsed: ParsedAgentMove): ParsedAgentMove {
  if (gameState.game !== "RPS") return parsed;
  const ctx = gameState.tacticalContext;
  const chosen = normalizeRpsMove(parsed.move);
  const predicted = normalizeRpsMove(parsed.predictedOpponentMove);
  const displayIntent = getDisplayIntent(ctx, parsed.intent);
  const notes: string[] = [];

  const lastLabel = buildLastRoundLabel(ctx);
  if (lastLabel) notes.push(lastLabel);

  if (chosen && predicted) {
    notes.push(getRpsCounter(predicted) === chosen ? `Read: ${predicted} -> ${chosen}.` : `Read: ${predicted}; ${chosen} misses.`);
  }

  if (displayIntent) {
    notes.push(`Plan: ${displayIntent}${typeof parsed.confidence === "number" ? ` ${parsed.confidence.toFixed(2)}` : ""}.`);
  }

  notes.push(getCharacterActionLine({
    voiceCue: ctx?.characterProfile?.voiceCue,
    intent: displayIntent,
    chosen,
    predicted,
  }));

  return {
    ...parsed,
    intent: displayIntent ?? parsed.intent,
    reasoning: notes.join(" "),
  };
}

function buildDeterministicRecoveryMove(gameState: GameState): ParsedAgentMove | null {
  if (gameState.game !== "RPS") return null;
  const legalMoves = gameState.availableMoves
    .map((move) => normalizeRpsMove(move))
    .filter((move): move is "ROCK" | "PAPER" | "SCISSORS" => !!move);
  if (legalMoves.length === 0) return null;

  const predicted = normalizeRpsMove(gameState.tacticalContext?.strategyAnalysis?.likelyOpponentMove) ?? normalizeRpsMove(gameState.tacticalContext?.lastRound?.opponentMove) ?? "SCISSORS";
  const desired = getRpsCounter(predicted);
  const move = legalMoves.includes(desired) ? desired : legalMoves[0];

  return {
    move,
    predictedOpponentMove: predicted,
    intent: "engine-recovery",
    confidence: gameState.tacticalContext?.strategyAnalysis?.confidence ?? 0.5,
    reasoning:
      move === desired
        ? `I read ${predicted}, so ${move}. ${move} beats it.`
        : `I read ${predicted}, but ${desired} is spent. I choose ${move}.`,
  };
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
  const tacticalMsg = buildTacticalContext(gameState);
  const resourceMsg = gameState.resourceStatus ? `\n[RESOURCE LIMITS]\n${gameState.resourceStatus}\nOnly choose from currently available moves. A move with 0 remaining is illegal. Repeating one move too often makes you predictable and can exhaust that resource.` : "";
  const rulesMsg = buildGameRules(gameState);
  const userMessage = "Game: " + gameState.game + " | Round: " + gameState.round + rulesMsg + "\nCurrently available legal moves: " + gameState.availableMoves.join(", ") + tacticalMsg + resourceMsg + toolContext + "\nMake your move." + tttHint;

  try {
    const isGemini = !!process.env.GEMINI_API_KEY;
    const parsed = isGemini
      ? await callGemini(systemPrompt, userMessage)
      : await callAnthropic(systemPrompt, userMessage);

    const consistent = composeRpsReasoning(gameState, enforceRpsPredictionConsistency(gameState, parsed));

    return {
      move: consistent.move,
      reasoning: consistent.reasoning,
      toolsUsed,
      thinkingMs: Date.now() - start,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[AGENT ENGINE ERROR]", errorMsg);
    const recoveryMove = buildDeterministicRecoveryMove(gameState);
    if (recoveryMove) {
      const consistentRecovery = composeRpsReasoning(gameState, enforceRpsPredictionConsistency(gameState, recoveryMove));
      return {
        move: consistentRecovery.move,
        reasoning: consistentRecovery.reasoning,
        toolsUsed: [...toolsUsed, "ENGINE_RECOVERY"],
        thinkingMs: Date.now() - start,
      };
    }
    const fallbackMove = pickDeterministicFallbackMove(gameState, config);
    return {
      move: fallbackMove,
      reasoning: "Fallback move used due to error: " + errorMsg,
      toolsUsed,
      thinkingMs: Date.now() - start,
    };
  }
}
