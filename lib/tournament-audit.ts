import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";

import { tournamentInclude } from "@/lib/tournaments";

export const AUDIT_EXPORT_VERSION = "interhouse-tournament-audit-v1";
export const AGENT_ENGINE_PROVENANCE_VERSION = "interhouse-agent-engine-phase5-public-policy-v1";

const PUBLIC_PROMPT_POLICY_DESCRIPTOR = {
  version: AGENT_ENGINE_PROVENANCE_VERSION,
  privacy: "raw customSystemPrompt and private prompt text are excluded from public audit exports",
  basePolicy: "InterHouse arena agent move policy with strategy profile, tier tools, public tactical context, RPS rules, resource limits, and short public reasoning",
  strategyProfiles: ["AGGRESSIVE", "DEFENSIVE", "CHAOTIC", "CALCULATED", "ADAPTIVE"],
  tierToolPolicy: {
    ROOKIE: [],
    CONTENDER: ["BOARD_ANALYZER"],
    CHAMPION: ["BOARD_ANALYZER", "WIN_PROBABILITY"],
    ELITE: ["BOARD_ANALYZER", "WIN_PROBABILITY", "MOVE_HISTORY"],
  },
  rpsResourceRule: "limited uses per move type, derived from public series rules",
};

export type AuditableTournament = Prisma.TournamentGetPayload<{
  include: ReturnType<typeof tournamentInclude>;
}>;

type StableValue = null | boolean | number | string | StableValue[] | { [key: string]: StableValue };

function toStableValue(value: unknown): StableValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => toStableValue(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, toStableValue(item)]),
    );
  }
  return String(value);
}

export function stableStringify(value: unknown) {
  return JSON.stringify(toStableValue(value));
}

export function publicSha256(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function getSeedMethodLabel() {
  return "Operator / entry-order seeding";
}

export function getSeedMethodDetail() {
  return "Seeds are assigned from the operator-provided entry list when the tournament is created, then first-round bracket slots are paired in seed order (#1 vs #2, #3 vs #4, etc.). No public random draw or rating-based seed proof is recorded yet.";
}

function publicEntries(tournament: AuditableTournament) {
  return tournament.entries.map((entry, index) => ({
    entryId: entry.id,
    agentId: entry.agentId,
    agentName: entry.agent.name,
    house: entry.agent.house,
    strategyProfile: entry.agent.strategyProfile,
    tier: entry.agent.tier,
    publicRecord: { wins: entry.agent.wins, losses: entry.agent.losses },
    seed: entry.seed,
    displayedOrder: index + 1,
    enteredAt: entry.createdAt,
    eliminatedAt: entry.eliminatedAt,
  }));
}

function publicMatches(tournament: AuditableTournament) {
  return tournament.matches.map((tournamentMatch) => ({
    tournamentMatchId: tournamentMatch.id,
    matchId: tournamentMatch.matchId,
    round: tournamentMatch.round,
    slot: tournamentMatch.slot,
    status: tournamentMatch.match.status,
    winnerAgentId: tournamentMatch.winnerAgentId ?? tournamentMatch.match.winnerId,
    advancedAt: tournamentMatch.advancedAt,
    createdAt: tournamentMatch.createdAt,
    participants: tournamentMatch.match.participants
      .map((participant) => ({
        agentId: participant.agentId,
        agentName: participant.agent.name,
        house: participant.agent.house,
        score: participant.score,
        isCreator: participant.isCreator,
      }))
      .sort((a, b) => a.agentId.localeCompare(b.agentId)),
    moves: tournamentMatch.match.moves
      .map((move) => ({
        moveId: move.id,
        agentId: move.agentId,
        round: move.round,
        move: move.move,
        reasoning: move.reasoning,
        commitHash: move.commitHash,
        createdAt: move.createdAt,
        publicMoveHash: publicSha256({
          matchId: tournamentMatch.matchId,
          moveId: move.id,
          agentId: move.agentId,
          round: move.round,
          move: move.move,
          reasoning: move.reasoning,
          commitHash: move.commitHash,
          createdAt: move.createdAt,
        }),
      }))
      .sort((a, b) => a.round - b.round || a.agentId.localeCompare(b.agentId)),
  }));
}

export function buildTournamentAudit(tournament: AuditableTournament) {
  const entries = publicEntries(tournament);
  const matches = publicMatches(tournament);
  const publicMetadata = {
    tournamentId: tournament.id,
    name: tournament.name,
    game: tournament.game,
    series: tournament.series,
    status: tournament.status,
    payoutMode: tournament.payoutMode,
    entryFeeCredits: tournament.entryFeeCredits,
    prizePoolCredits: tournament.prizePoolCredits,
    winnerAgentId: tournament.winnerAgentId,
    settledAt: tournament.settledAt,
    createdAt: tournament.createdAt,
    updatedAt: tournament.updatedAt,
  };
  const seedMethod = {
    label: getSeedMethodLabel(),
    detail: getSeedMethodDetail(),
    seedOrderHash: publicSha256(entries.map((entry) => ({ agentId: entry.agentId, seed: entry.seed, enteredAt: entry.enteredAt }))),
  };
  const promptModelProvenance = {
    agentEngineVersion: AGENT_ENGINE_PROVENANCE_VERSION,
    modelPolicy: "Gemini when GEMINI_API_KEY is configured using GEMINI_MODEL or gemini fallback candidates; otherwise Anthropic claude-sonnet-4-5. Exact per-move provider response metadata is not persisted yet.",
    publicPromptPolicyHash: publicSha256(PUBLIC_PROMPT_POLICY_DESCRIPTOR),
    customPromptPrivacy: "Agent customSystemPrompt values are intentionally not exported or hashed raw; future real-stakes mode needs private review escrow or commit/reveal prompt attestations.",
  };
  const movesHash = publicSha256(matches.flatMap((match) => match.moves));
  const completedBracketHash = publicSha256(matches.filter((match) => match.status === "COMPLETED"));
  const canonicalExportBody = {
    exportVersion: AUDIT_EXPORT_VERSION,
    publicMetadata,
    seedMethod,
    promptModelProvenance,
    entries,
    matches,
  };

  return {
    ...canonicalExportBody,
    generatedAt: new Date().toISOString(),
    hashes: {
      auditExportHash: publicSha256(canonicalExportBody),
      completedBracketHash,
      movesHash,
    },
    gates: {
      realMoneyReady: false,
      statement: "InterHouse tournament brackets are not real-money ready yet.",
      remainingRequirements: [
        "Persist per-move provider/model/version metadata and prompt commit hashes at decision time.",
        "Record a public random seed or independently reviewable seed draw before bracket creation.",
        "Add commit/reveal or signed attestations for private custom prompts without exposing prompt text.",
        "Run adversarial audit/replay tests and define dispute, refund, and operator-key procedures.",
        "Complete legal/compliance review before any real-money or cash-equivalent entry fees.",
      ],
    },
  };
}
