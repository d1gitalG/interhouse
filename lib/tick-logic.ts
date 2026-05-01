import type { Prisma } from "@prisma/client";
import { getAgentMove } from "./agent-engine";
import { applySeriesRoundOutcome, finalizeMatchWinner } from "./match-engine";
import { prisma } from "./prisma";
import { resolveRPS, type RpsMove } from "./rps-engine";
import {
  checkWinner as checkTttWinner,
  createEmptyBoard,
  getAvailableMoves as getTttAvailableMoves,
  type TttBoard,
  validateMove as validateTttMove,
} from "./ttt-engine";

const MATCH_INCLUDE = {
  participants: { include: { agent: true } },
  moves: { orderBy: { createdAt: "asc" as const } },
} as const;

type MatchWithRelations = Prisma.MatchGetPayload<{
  include: typeof MATCH_INCLUDE;
}>;

function toRpsMove(rawMove: string): RpsMove | null {
  const normalized = rawMove.toUpperCase();
  if (normalized === "ROCK" || normalized === "PAPER" || normalized === "SCISSORS") {
    return normalized;
  }
  return null;
}

function parseTttMove(rawMove: string): { row: number; col: number } | null {
  const match = rawMove.trim().match(/^(\d)\s*,\s*(\d)$/);
  if (!match) return null;
  const row = Number(match[1]);
  const col = Number(match[2]);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (row < 0 || row > 2 || col < 0 || col > 2) return null;
  return { row, col };
}

function serializeTttMove(move: { row: number; col: number }): string {
  return `${move.row},${move.col}`;
}

function buildTttBoardFromMoves(roundMoves: Array<{ move: string }>): TttBoard | null {
  const board = createEmptyBoard();
  for (let index = 0; index < roundMoves.length; index += 1) {
    const parsed = parseTttMove(roundMoves[index]?.move ?? "");
    if (!parsed) return null;
    if (!validateTttMove(board, parsed.row, parsed.col)) return null;
    const mark = index % 2 === 0 ? "X" : "O";
    board[parsed.row][parsed.col] = mark;
  }
  return board;
}

function toAgentConfig(participant: MatchWithRelations["participants"][number]) {
  return {
    strategyProfile: participant.agent.strategyProfile,
    tier: participant.agent.tier,
    toolsEnabled: Array.isArray(participant.agent.toolsEnabled)
      ? participant.agent.toolsEnabled.map((tool) => String(tool))
      : [],
    customSystemPrompt: participant.agent.customSystemPrompt ?? undefined,
    agentName: participant.agent.name,
    house: participant.agent.house,
  } as const;
}

function getTargetWins(series: MatchWithRelations["series"]): number {
  if (series === "QUICK") return 1;
  if (series === "BO5") return 3;
  return 2;
}

function outcomeForSelf(selfMove: RpsMove, opponentMove: RpsMove): "WIN" | "LOSS" | "DRAW" {
  if (selfMove === opponentMove) return "DRAW";
  const selfWins =
    (selfMove === "ROCK" && opponentMove === "SCISSORS") ||
    (selfMove === "SCISSORS" && opponentMove === "PAPER") ||
    (selfMove === "PAPER" && opponentMove === "ROCK");
  return selfWins ? "WIN" : "LOSS";
}

function getRpsMoveRowsForAgent(params: {
  moves: MatchWithRelations["moves"];
  selfAgentId: string;
  opponentAgentId: string;
}) {
  const rows = [] as Array<{
    round: number;
    selfMove: RpsMove;
    opponentMove: RpsMove;
    outcome: "WIN" | "LOSS" | "DRAW";
  }>;
  const rounds = [...new Set(params.moves.map((move) => move.round))].sort((a, b) => a - b);

  for (const round of rounds) {
    const self = params.moves.find((move) => move.round === round && move.agentId === params.selfAgentId);
    const opponent = params.moves.find((move) => move.round === round && move.agentId === params.opponentAgentId);
    const selfMove = self ? toRpsMove(self.move) : null;
    const opponentMove = opponent ? toRpsMove(opponent.move) : null;
    if (!selfMove || !opponentMove) continue;
    rows.push({
      round,
      selfMove,
      opponentMove,
      outcome: outcomeForSelf(selfMove, opponentMove),
    });
  }

  return rows;
}

function buildRepetitionWarning(label: "You" | "Opponent", moves: string[]): string | undefined {
  if (moves.length < 2) return undefined;
  const lastMove = moves[moves.length - 1];
  let streak = 0;
  for (let i = moves.length - 1; i >= 0; i -= 1) {
    if (moves[i] !== lastMove) break;
    streak += 1;
  }
  if (streak >= 2) {
    return `${label} repeated ${lastMove} ${streak} rounds in a row.`;
  }
  return undefined;
}

function getRpsCounter(move: RpsMove): RpsMove {
  if (move === "ROCK") return "PAPER";
  if (move === "PAPER") return "SCISSORS";
  return "ROCK";
}

function buildSymmetryAdvice(params: {
  rows: Array<{ selfMove: RpsMove; opponentMove: RpsMove; outcome: "WIN" | "LOSS" | "DRAW" }>;
  isCreator: boolean;
}): string | undefined {
  const last = params.rows.at(-1);
  if (!last || last.outcome !== "DRAW" || last.selfMove !== last.opponentMove) return undefined;

  const lastSharedMove = last.selfMove;
  const firstOrderCounter = getRpsCounter(lastSharedMove);
  const secondOrderCounter = getRpsCounter(firstOrderCounter);

  if (params.isCreator) {
    return `Shared ${lastSharedMove} draw detected. As CREATOR, take the first asymmetry lane: choose the direct breaker ${firstOrderCounter}. Avoid mirroring or overthinking into ${secondOrderCounter}.`;
  }

  return `Shared ${lastSharedMove} draw detected. As CHALLENGER, assume the creator's obvious break is ${firstOrderCounter}; take the counter-counter lane ${secondOrderCounter}. Avoid matching the creator's direct breaker.`;
}

function summarizeMoveCounts(moves: RpsMove[]): string {
  const counts = { ROCK: 0, PAPER: 0, SCISSORS: 0 } satisfies Record<RpsMove, number>;
  for (const move of moves) counts[move] += 1;
  return `ROCK ${counts.ROCK}, PAPER ${counts.PAPER}, SCISSORS ${counts.SCISSORS}`;
}

function mostCommonMove(moves: RpsMove[]): RpsMove | null {
  if (moves.length === 0) return null;
  const counts = { ROCK: 0, PAPER: 0, SCISSORS: 0 } satisfies Record<RpsMove, number>;
  for (const move of moves) counts[move] += 1;
  return (Object.entries(counts) as Array<[RpsMove, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function getIntentBias(strategyProfile: string, isCreator: boolean): string[] {
  if (strategyProfile === "AGGRESSIVE") return ["high-risk-read", "bait-counter", "break-symmetry"];
  if (strategyProfile === "DEFENSIVE") return ["match-point-safe", "resource-denial", "punish-repeat"];
  if (strategyProfile === "CALCULATED") return ["punish-repeat", "resource-denial", "anti-mirror"];
  if (strategyProfile === "ADAPTIVE") return ["anti-mirror", "bait-counter", "punish-repeat"];
  return isCreator ? ["bluff-switch", "high-risk-read", "break-symmetry"] : ["anti-mirror", "bluff-switch", "bait-counter"];
}

type DuelistTraits = {
  aggression: number;
  discipline: number;
  adaptability: number;
  deception: number;
  volatility: number;
  composure: number;
};

type DuelistCharacter = {
  archetype: string;
  traits: DuelistTraits;
  flaw: string;
  voiceCue: string;
  behaviorBias: string;
};

function clampTrait(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tuneTraits(base: DuelistTraits, patch: Partial<DuelistTraits>): DuelistTraits {
  return {
    aggression: clampTrait(patch.aggression ?? base.aggression),
    discipline: clampTrait(patch.discipline ?? base.discipline),
    adaptability: clampTrait(patch.adaptability ?? base.adaptability),
    deception: clampTrait(patch.deception ?? base.deception),
    volatility: clampTrait(patch.volatility ?? base.volatility),
    composure: clampTrait(patch.composure ?? base.composure),
  };
}

function buildDuelistCharacter(agent: MatchWithRelations["participants"][number]["agent"]): DuelistCharacter {
  let traits: DuelistTraits =
    agent.strategyProfile === "AGGRESSIVE"
      ? { aggression: 86, discipline: 38, adaptability: 58, deception: 48, volatility: 62, composure: 45 }
      : agent.strategyProfile === "DEFENSIVE"
        ? { aggression: 34, discipline: 82, adaptability: 54, deception: 38, volatility: 28, composure: 78 }
        : agent.strategyProfile === "CALCULATED"
          ? { aggression: 48, discipline: 88, adaptability: 62, deception: 42, volatility: 22, composure: 84 }
          : agent.strategyProfile === "ADAPTIVE"
            ? { aggression: 56, discipline: 62, adaptability: 86, deception: 62, volatility: 46, composure: 64 }
            : { aggression: 62, discipline: 28, adaptability: 62, deception: 76, volatility: 88, composure: 34 };

  const text = `${agent.name} ${agent.house} ${agent.customSystemPrompt ?? ""}`.toLowerCase();
  let archetype = `${agent.strategyProfile.toLowerCase()} duelist`;
  let flaw = "has no obvious flaw yet";
  let voiceCue = "Move.";
  let behaviorBias = "Let strategy lead, but keep a distinct temperament.";

  if (/red comet|aries|striker|vanguard|mars/.test(text)) {
    traits = tuneTraits(traits, { aggression: traits.aggression + 10, discipline: traits.discipline - 12, volatility: traits.volatility + 8, composure: traits.composure - 8 });
    archetype = "tempo striker";
    flaw = "overcommit: hates passive lines and may chase tempo after setbacks";
    voiceCue = "Tempo.";
    behaviorBias = "Prefer pressure, fast counters, and momentum even when a safer line exists.";
  } else if (/granite crown|capricorn|bastion|crown|stone|patient/.test(text)) {
    traits = tuneTraits(traits, { aggression: traits.aggression - 8, discipline: traits.discipline + 10, volatility: traits.volatility - 12, composure: traits.composure + 10 });
    archetype = "stone disciplinarian";
    flaw = "rigidity: can become readable if the opponent survives the first punish";
    voiceCue = "Hold.";
    behaviorBias = "Prefer patient punish-repeat, resource denial, and low-noise match-point lines.";
  } else if (/twin static|gemini|static|chaos|chaotic/.test(text)) {
    traits = tuneTraits(traits, { deception: traits.deception + 8, volatility: traits.volatility + 12, discipline: traits.discipline - 10 });
    archetype = "volatile feinter";
    flaw = "chaos-break: may abandon a good pattern to stay unreadable";
    voiceCue = "Static shift.";
    behaviorBias = "Prefer bluff-switch and sudden reversals, especially after a clean win.";
  } else if (/gilded blade|libra|mirror|balance/.test(text)) {
    traits = tuneTraits(traits, { adaptability: traits.adaptability + 8, deception: traits.deception + 4, discipline: traits.discipline + 2 });
    archetype = "mirror duelist";
    flaw = "overmirror: can answer the opponent so hard it becomes predictable";
    voiceCue = "Answered.";
    behaviorBias = "Prefer anti-mirror and bait-counter lines that answer the opponent's style.";
  } else if (/moon bastion|bastion|fortress|defensive/.test(text)) {
    traits = tuneTraits(traits, { discipline: traits.discipline + 8, composure: traits.composure + 8, aggression: traits.aggression - 8 });
    archetype = "fortress";
    flaw = "turtle: can play too safe and miss a kill window";
    voiceCue = "Shelter.";
    behaviorBias = "Prefer safe counters, match-point survival, and avoiding low-confidence bluffs.";
  } else if (/ember jackal|jackal|feint/.test(text)) {
    traits = tuneTraits(traits, { aggression: 72, deception: 82, volatility: 74, discipline: 38 });
    archetype = "feint predator";
    flaw = "bait addiction: may choose the stylish trap over the clean answer";
    voiceCue = "Snap.";
    behaviorBias = "Prefer bait-counter and bluff-switch lines that punish overfit opponents.";
  } else if (/violet siren|siren|bait/.test(text)) {
    traits = tuneTraits(traits, { adaptability: 78, deception: 86, volatility: 54, composure: 66 });
    archetype = "lure artist";
    flaw = "overlure: may spend too long setting traps";
    voiceCue = "Come closer.";
    behaviorBias = "Prefer bait-counter, second-order reads, and trap setups.";
  } else if (/jade tactician|tactician|patient/.test(text)) {
    traits = tuneTraits(traits, { discipline: 88, adaptability: 68, deception: 46, volatility: 22, composure: 82 });
    archetype = "resource tactician";
    flaw = "overcalculate: can be late to obvious aggression";
    voiceCue = "Measure.";
    behaviorBias = "Prefer resource-denial, punish-repeat, and disciplined counters.";
  } else if (/brass sentinel|sentinel|fortress/.test(text)) {
    traits = tuneTraits(traits, { aggression: 32, discipline: 84, composure: 82, volatility: 24 });
    archetype = "gatekeeper";
    flaw = "stubborn guard: may hold a defensive read too long";
    voiceCue = "Stand.";
    behaviorBias = "Prefer match-point-safe, resource-denial, and low-risk answers.";
  }

  return { archetype, traits, flaw, voiceCue, behaviorBias };
}

function applyCharacterIntentBias(intents: string[], character: DuelistCharacter): string[] {
  const preferred = [...intents];
  const addFront = (intent: string) => {
    if (!preferred.includes(intent)) preferred.unshift(intent);
  };
  if (character.traits.volatility >= 70) addFront("bluff-switch");
  if (character.traits.deception >= 72) addFront("bait-counter");
  if (character.traits.discipline >= 78) addFront("resource-denial");
  if (character.traits.aggression >= 78) addFront("high-risk-read");
  if (character.traits.adaptability >= 78) addFront("anti-mirror");
  if (character.traits.composure >= 76) addFront("match-point-safe");
  return preferred;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(input: string): number {
  return hashString(input) / 0xffffffff;
}

function normalizeWeights(weights: Record<RpsMove, number>): Record<RpsMove, number> {
  const total = weights.ROCK + weights.PAPER + weights.SCISSORS || 1;
  return {
    ROCK: weights.ROCK / total,
    PAPER: weights.PAPER / total,
    SCISSORS: weights.SCISSORS / total,
  };
}

function buildOpeningPriors(agent: MatchWithRelations["participants"][number]["agent"]): Record<RpsMove, number> {
  const weights: Record<RpsMove, number> =
    agent.strategyProfile === "AGGRESSIVE"
      ? { ROCK: 0.42, PAPER: 0.33, SCISSORS: 0.25 }
      : agent.strategyProfile === "DEFENSIVE"
        ? { ROCK: 0.26, PAPER: 0.42, SCISSORS: 0.32 }
        : agent.strategyProfile === "CALCULATED"
          ? { ROCK: 0.32, PAPER: 0.36, SCISSORS: 0.32 }
          : agent.strategyProfile === "ADAPTIVE"
            ? { ROCK: 0.30, PAPER: 0.34, SCISSORS: 0.36 }
            : { ROCK: 0.34, PAPER: 0.33, SCISSORS: 0.33 };

  const text = `${agent.name} ${agent.house} ${agent.customSystemPrompt ?? ""}`.toLowerCase();
  const bump = (move: RpsMove, amount: number) => {
    weights[move] += amount;
  };

  if (/aries|striker|vanguard|red|comet|mars|pressure|aggress/.test(text)) bump("ROCK", 0.08);
  if (/libra|mirror|gilded|balance|adaptive|counter|analyst|virgo|oracle/.test(text)) bump("PAPER", 0.08);
  if (/scorpio|shadow|predator|stealth|bait|chaos|chaotic|trick/.test(text)) bump("SCISSORS", 0.08);

  return normalizeWeights(weights);
}

function chooseWeightedMove(weights: Record<RpsMove, number>, seed: string): { move: RpsMove; weight: number } {
  const roll = seededUnit(seed);
  const rockCutoff = weights.ROCK;
  const paperCutoff = weights.ROCK + weights.PAPER;
  if (roll < rockCutoff) return { move: "ROCK", weight: weights.ROCK };
  if (roll < paperCutoff) return { move: "PAPER", weight: weights.PAPER };
  return { move: "SCISSORS", weight: weights.SCISSORS };
}

function formatOpeningPriors(weights: Record<RpsMove, number>): string {
  return `ROCK ${(weights.ROCK * 100).toFixed(0)}%, PAPER ${(weights.PAPER * 100).toFixed(0)}%, SCISSORS ${(weights.SCISSORS * 100).toFixed(0)}%`;
}

function buildRpsStrategyAnalysis(params: {
  matchId: string;
  rows: Array<{ selfMove: RpsMove; opponentMove: RpsMove; outcome: "WIN" | "LOSS" | "DRAW" }>;
  self: MatchWithRelations["participants"][number];
  opponent: MatchWithRelations["participants"][number];
  selfCharacter: DuelistCharacter;
  selfUsage: Record<RpsMove, number>;
  opponentUsage: Record<RpsMove, number>;
  moveLimit: number;
  targetWins: number;
}) {
  const opponentMoves = params.rows.map((row) => row.opponentMove);
  const selfMoves = params.rows.map((row) => row.selfMove);
  const lastRound = params.rows.at(-1);
  const openingPriors = buildOpeningPriors(params.opponent.agent);
  const openingRead = chooseWeightedMove(openingPriors, `${params.matchId}:${params.self.agentId}:${params.opponent.agentId}:opening-prior`);
  const opponentFavorite = mostCommonMove(opponentMoves);
  const defaultPrediction = opponentFavorite ?? lastRound?.opponentMove ?? openingRead.move;

  const lastSharedDraw = lastRound?.outcome === "DRAW" && lastRound.selfMove === lastRound.opponentMove ? lastRound.selfMove : null;
  const firstOrderCounter = lastSharedDraw ? getRpsCounter(lastSharedDraw) : getRpsCounter(lastRound?.opponentMove ?? defaultPrediction);
  const secondOrderCounter = getRpsCounter(firstOrderCounter);
  const punishSecondOrder = getRpsCounter(secondOrderCounter);

  const recentAfterDrawMoves: RpsMove[] = [];
  for (let i = 1; i < params.rows.length; i += 1) {
    if (params.rows[i - 1]?.outcome === "DRAW") recentAfterDrawMoves.push(params.rows[i].opponentMove);
  }
  const afterDrawFavorite = mostCommonMove(recentAfterDrawMoves);

  let likelyOpponentMove = afterDrawFavorite ?? defaultPrediction;
  let confidence = opponentMoves.length >= 4 ? 0.56 : 0.48;
  if (params.rows.length === 0) {
    likelyOpponentMove = openingRead.move;
    confidence = Math.min(0.55, Math.max(0.42, openingRead.weight + 0.1));
  } else if (lastSharedDraw) {
    likelyOpponentMove = params.self.isCreator ? secondOrderCounter : firstOrderCounter;
    confidence = params.rows.length >= 2 ? 0.64 : 0.54;
  } else if (afterDrawFavorite) {
    confidence = 0.62;
  } else if (opponentFavorite && opponentMoves.filter((move) => move === opponentFavorite).length >= 2) {
    confidence = 0.58;
  }

  const recommendedIntents = applyCharacterIntentBias([...getIntentBias(params.self.agent.strategyProfile, params.self.isCreator)], params.selfCharacter);
  if (params.rows.length === 0 && !recommendedIntents.includes("bluff-switch")) recommendedIntents.push("bluff-switch");
  if (lastSharedDraw && !recommendedIntents.includes("bait-counter")) recommendedIntents.unshift("bait-counter");
  if (opponentMoves.slice(-2).length === 2 && opponentMoves.slice(-2).every((move) => move === opponentMoves.at(-1)) && !recommendedIntents.includes("punish-repeat")) {
    recommendedIntents.unshift("punish-repeat");
  }

  const selfRemaining = (move: RpsMove) => params.moveLimit - params.selfUsage[move];
  const directCounter = getRpsCounter(likelyOpponentMove);
  const scarceSelf = (Object.entries(params.selfUsage) as Array<[RpsMove, number]>).filter(([, used]) => params.moveLimit - used <= 1).map(([move]) => move);
  const scarceOpponent = (Object.entries(params.opponentUsage) as Array<[RpsMove, number]>).filter(([, used]) => params.moveLimit - used <= 1).map(([move]) => move);

  const selfScore = params.self.score;
  const opponentScore = params.opponent.score;
  const scorePressure = selfScore + 1 >= params.targetWins
    ? params.selfCharacter.traits.aggression >= 78
      ? "You are at match point; your character wants to press, but do not throw away the crown."
      : "You are at match point; avoid cute reads unless confidence is high."
    : opponentScore + 1 >= params.targetWins
      ? params.selfCharacter.traits.volatility >= 70
        ? "Opponent is at match point; your character may swing hard, but choose a readable flaw on purpose."
        : "Opponent is at match point; prefer a robust counter over a low-confidence bluff."
      : "No one is at match point; controlled bluffing is acceptable.";

  return {
    opponentProfile: params.rows.length === 0
      ? `Opening scout: ${params.opponent.agent.name} leans ${formatOpeningPriors(openingPriors)}. Your read: ${openingRead.move}.`
      : `Opponent counts: ${summarizeMoveCounts(opponentMoves)}. Your counts: ${summarizeMoveCounts(selfMoves)}. Opening lean: ${formatOpeningPriors(openingPriors)}. After-draw: ${afterDrawFavorite ?? "not enough data"}.`,
    likelyOpponentMove,
    confidence,
    recommendedIntents: recommendedIntents.slice(0, 4),
    firstOrderRead: lastRound
      ? `If opponent repeats/anchors on ${lastRound.opponentMove}, direct counter is ${getRpsCounter(lastRound.opponentMove)}.`
      : `No prior move; use the opening scout, not a universal default.`,
    secondOrderRead: lastSharedDraw
      ? `Shared ${lastSharedDraw} draw creates layers: obvious break is ${firstOrderCounter}; opponent may counter that with ${secondOrderCounter}; punish that counter-counter with ${punishSecondOrder}.`
      : params.rows.length === 0
        ? `Low confidence: pick a persona opener, safe balance, or bluff. The scout is not certainty.`
        : `If opponent expects your direct counter ${directCounter}, they may counter-counter with ${getRpsCounter(directCounter)}; consider whether to bait that.` ,
    resourcePressure: `Direct counter to likely ${likelyOpponentMove} is ${directCounter}; you have ${selfRemaining(directCounter)} ${directCounter} left. Scarce for you: ${scarceSelf.join(", ") || "none"}. Scarce for opponent: ${scarceOpponent.join(", ") || "none"}.`,
    scorePressure,
    exploitWarning: selfMoves.length >= 2 && selfMoves.at(-1) === selfMoves.at(-2)
      ? `You repeated ${selfMoves.at(-1)} twice; opponent may be setting a trap for it.`
      : params.selfCharacter.flaw.includes("overcommit") && lastRound?.outcome === "LOSS"
        ? "Your overcommit flaw is active after a loss; pressure is tempting but exploitable."
        : params.selfCharacter.flaw.includes("overmirror") && opponentMoves.length >= 1
          ? "Your overmirror flaw is active; answering their style too literally can become your pattern."
          : undefined,
  };
}

function formatRpsResourceStatus(params: {
  selfUsage: Record<"ROCK" | "PAPER" | "SCISSORS", number>;
  opponentUsage: Record<"ROCK" | "PAPER" | "SCISSORS", number>;
  moveLimit: number;
}) {
  const remaining = (usage: Record<"ROCK" | "PAPER" | "SCISSORS", number>) =>
    `ROCK ${params.moveLimit - usage.ROCK}/${params.moveLimit}, PAPER ${params.moveLimit - usage.PAPER}/${params.moveLimit}, SCISSORS ${params.moveLimit - usage.SCISSORS}/${params.moveLimit}`;

  return `Your remaining move resources: ${remaining(params.selfUsage)}. Opponent remaining move resources: ${remaining(params.opponentUsage)}.`;
}

function buildRpsTacticalContext(params: {
  match: MatchWithRelations;
  self: MatchWithRelations["participants"][number];
  opponent: MatchWithRelations["participants"][number];
  selfUsage: Record<RpsMove, number>;
  opponentUsage: Record<RpsMove, number>;
  moveLimit: number;
}) {
  const rows = getRpsMoveRowsForAgent({
    moves: params.match.moves,
    selfAgentId: params.self.agentId,
    opponentAgentId: params.opponent.agentId,
  });
  const selfPreviousMoves = rows.map((row) => row.selfMove);
  const opponentPreviousMoves = rows.map((row) => row.opponentMove);
  const lastRound = rows.at(-1);
  const initiativeRole = params.self.isCreator ? "CREATOR" as const : "CHALLENGER" as const;
  const targetWins = getTargetWins(params.match.series);
  const characterProfile = buildDuelistCharacter(params.self.agent);

  return {
    selfAgentId: params.self.agentId,
    opponentAgentId: params.opponent.agentId,
    initiativeRole,
    selfScore: params.self.score,
    opponentScore: params.opponent.score,
    targetWins,
    selfPreviousMoves,
    opponentPreviousMoves,
    lastRound,
    repetitionWarning: buildRepetitionWarning("You", selfPreviousMoves),
    opponentRepetitionWarning: buildRepetitionWarning("Opponent", opponentPreviousMoves),
    symmetryAdvice: buildSymmetryAdvice({ rows, isCreator: params.self.isCreator }),
    characterProfile,
    strategyAnalysis: buildRpsStrategyAnalysis({
      matchId: params.match.id,
      rows,
      self: params.self,
      opponent: params.opponent,
      selfCharacter: characterProfile,
      selfUsage: params.selfUsage,
      opponentUsage: params.opponentUsage,
      moveLimit: params.moveLimit,
      targetWins,
    }),
  };
}

export async function processMatchTick(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: MATCH_INCLUDE,
  });

  if (!match) throw new Error("MATCH_NOT_FOUND");
  if (match.status !== "ACTIVE") throw new Error("MATCH_NOT_ACTIVE");
  if (match.participants.length !== 2) throw new Error("MATCH_NOT_READY");

  const p1 = match.participants.find((p) => p.isCreator) ?? match.participants[0];
  const p2 = match.participants.find((p) => p.id !== p1.id) ?? null;
  if (!p2) throw new Error("INVALID_PARTICIPANTS");

  const round = match.currentRound;
  const moveHistory = match.moves.map((move) => ({
    agentId: move.agentId,
    move: move.move,
    round: move.round,
  }));

  if (match.game === "RPS") {
    const MOVE_LIMIT = match.series === "BO3" ? 2 : match.series === "BO5" ? 4 : 5;
    const getAvailableRpsMoves = (agentId: string) => {
      const usage = { ROCK: 0, PAPER: 0, SCISSORS: 0 };
      match.moves.filter(m => m.agentId === agentId).forEach(m => {
        const move = m.move.toUpperCase();
        if (move in usage) usage[move as keyof typeof usage]++;
      });
      
      const available = ["ROCK", "PAPER", "SCISSORS"].filter(m => usage[m as keyof typeof usage] < MOVE_LIMIT);
      return { available, usage };
    };

    const p1Resources = getAvailableRpsMoves(p1.agentId);
    const p2Resources = getAvailableRpsMoves(p2.agentId);

    // If somehow both run out of all moves (shouldn't happen with 5x3=15 rounds), 
    // but good to have a safety. 
    if (p1Resources.available.length === 0 || p2Resources.available.length === 0) {
      return await prisma.$transaction(async (tx) => {
        await tx.match.update({
          where: { id: match.id },
          data: { status: 'CANCELLED' }
        });
        return { outcome: 'STALEMATE_EXHAUSTED', round };
      });
    }

    const [p1Result, p2Result] = await Promise.all([
      getAgentMove({ 
        game: "RPS", 
        round, 
        availableMoves: p1Resources.available, 
        moveHistory,
        tacticalContext: buildRpsTacticalContext({ match, self: p1, opponent: p2, selfUsage: p1Resources.usage, opponentUsage: p2Resources.usage, moveLimit: MOVE_LIMIT }),
        resourceStatus: formatRpsResourceStatus({ selfUsage: p1Resources.usage, opponentUsage: p2Resources.usage, moveLimit: MOVE_LIMIT })
      }, toAgentConfig(p1)),
      getAgentMove({ 
        game: "RPS", 
        round, 
        availableMoves: p2Resources.available, 
        moveHistory,
        tacticalContext: buildRpsTacticalContext({ match, self: p2, opponent: p1, selfUsage: p2Resources.usage, opponentUsage: p1Resources.usage, moveLimit: MOVE_LIMIT }),
        resourceStatus: formatRpsResourceStatus({ selfUsage: p2Resources.usage, opponentUsage: p1Resources.usage, moveLimit: MOVE_LIMIT })
      }, toAgentConfig(p2)),
    ]);

    const p1Move = toRpsMove(p1Result.move);
    const p2Move = toRpsMove(p2Result.move);
    
    // Strict enforcement: Ensure the move is in the allowed list
    if (p1Move && !p1Resources.available.includes(p1Move)) {
      throw new Error(`AGENT_P1_ATTEMPTED_EXHAUSTED_MOVE: ${p1Move}`);
    }
    if (p2Move && !p2Resources.available.includes(p2Move)) {
      throw new Error(`AGENT_P2_ATTEMPTED_EXHAUSTED_MOVE: ${p2Move}`);
    }

    if (!p1Move || !p2Move) throw new Error("INVALID_RPS_MOVE");

    return await prisma.$transaction(async (tx) => {
      const existingRoundMoves = await tx.move.findMany({
        where: { matchId: match.id, round },
        select: { id: true },
      });
      if (existingRoundMoves.length > 0) throw new Error("ROUND_ALREADY_PROCESSED");

      await tx.move.create({ data: { matchId: match.id, agentId: p1.agentId, round, move: p1Move, reasoning: p1Result.reasoning } });
      await tx.move.create({ data: { matchId: match.id, agentId: p2.agentId, round, move: p2Move, reasoning: p2Result.reasoning } });

      const roundOutcome = resolveRPS(p1Move, p2Move);
      await applySeriesRoundOutcome({
        tx,
        matchId: match.id,
        series: match.series,
        stakeMode: match.stakeMode,
        p1: p1,
        p2: p2,
        roundWinner: roundOutcome === "P1_WIN" ? "P1" : roundOutcome === "P2_WIN" ? "P2" : null,
      });

      return { outcome: roundOutcome, round };
    });
  } else if (match.game === "TTT") {
    const roundMoves = match.moves.filter((move) => move.round === round);
    const preTickBoard = buildTttBoardFromMoves(roundMoves.map((move) => ({ move: move.move })));
    if (!preTickBoard) throw new Error("INVALID_TTT_STATE");

    const isP1Turn = roundMoves.length % 2 === 0;
    const currentPlayer = isP1Turn ? p1 : p2;
    const availableMoves = getTttAvailableMoves(preTickBoard);

    if (availableMoves.length === 0) throw new Error("INVALID_TTT_STATE");

    const agentResult = await getAgentMove(
      { game: "TTT", round, board: preTickBoard, availableMoves: availableMoves.map((move) => serializeTttMove(move)), moveHistory },
      toAgentConfig(currentPlayer)
    );

    return await prisma.$transaction(async (tx) => {
      const parsedMove = parseTttMove(agentResult.move);
      if (!parsedMove || !validateTttMove(preTickBoard, parsedMove.row, parsedMove.col)) {
        const opponent = isP1Turn ? p2 : p1;
        await tx.matchParticipant.update({ where: { id: opponent.id }, data: { score: { increment: 1 } } });
        await finalizeMatchWinner({ tx, matchId: match.id, stakeMode: match.stakeMode, winnerAgentId: opponent.agentId, loserAgentId: currentPlayer.agentId });
        return { outcome: "TTT_FORFEIT", round };
      }

      await tx.move.create({ data: { matchId: match.id, agentId: currentPlayer.agentId, round, move: serializeTttMove(parsedMove), reasoning: agentResult.reasoning } });

      const mark = isP1Turn ? "X" : "O";
      preTickBoard[parsedMove.row][parsedMove.col] = mark;
      const boardResult = checkTttWinner(preTickBoard);

      if (boardResult === null) return { outcome: "TTT_ONGOING", round };
      if (boardResult === "DRAW") {
        await tx.match.update({ where: { id: match.id }, data: { currentRound: { increment: 1 } } });
        return { outcome: "TTT_DRAW", round };
      }

      const roundWinnerLabel: "P1" | "P2" = boardResult === "X" ? "P1" : "P2";
      await applySeriesRoundOutcome({ tx, matchId: match.id, series: match.series, stakeMode: match.stakeMode, p1, p2, roundWinner: roundWinnerLabel });
      return { outcome: roundWinnerLabel === "P1" ? "TTT_P1_WIN" : "TTT_P2_WIN", round };
    });
  }

  throw new Error("UNSUPPORTED_GAME");
}
