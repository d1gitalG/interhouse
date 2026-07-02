export const TOURNAMENT_ENTRY_CAP_VALUES = [4, 8, 16, 64] as const;
export const DEFAULT_TOURNAMENT_ENTRY_CAP = 64;
export const DEFAULT_TOURNAMENT_MIN_COMPLETED_MATCHES = 0;

export type TournamentEntryCap = (typeof TOURNAMENT_ENTRY_CAP_VALUES)[number];

export type TournamentEligibilityRejectCode =
  | "AGENT_NOT_FOUND"
  | "DUPLICATE_TOURNAMENT_ENTRY"
  | "TOURNAMENT_ENTRY_CAP_REACHED"
  | "AGENT_INELIGIBLE_FOR_PUBLIC_CREDIT_TOURNAMENT";

export type TournamentEligibilityResult =
  | { allowed: true }
  | { allowed: false; reason: TournamentEligibilityRejectCode };

export type TournamentEligibilityAgent = {
  id: string;
  wins: number;
  losses: number;
};

export type TournamentEligibilityConfig = {
  maxEntries?: TournamentEntryCap;
  minCompletedMatches?: number;
};

export type TournamentEligibilityContext = {
  agentIds: string[];
  entryFeeCredits: number;
  existingAgents: TournamentEligibilityAgent[];
  config?: TournamentEligibilityConfig;
};

export function isTournamentEntryCap(value: number): value is TournamentEntryCap {
  return TOURNAMENT_ENTRY_CAP_VALUES.includes(value as TournamentEntryCap);
}

export function checkTournamentEligibility(ctx: TournamentEligibilityContext): TournamentEligibilityResult {
  const maxEntries = ctx.config?.maxEntries ?? DEFAULT_TOURNAMENT_ENTRY_CAP;
  const minCompletedMatches = ctx.config?.minCompletedMatches ?? DEFAULT_TOURNAMENT_MIN_COMPLETED_MATCHES;

  if (new Set(ctx.agentIds).size !== ctx.agentIds.length) {
    return { allowed: false, reason: "DUPLICATE_TOURNAMENT_ENTRY" };
  }

  if (ctx.agentIds.length > maxEntries) {
    return { allowed: false, reason: "TOURNAMENT_ENTRY_CAP_REACHED" };
  }

  const agentsById = new Map(ctx.existingAgents.map((agent) => [agent.id, agent]));
  for (const agentId of ctx.agentIds) {
    const agent = agentsById.get(agentId);
    if (!agent) return { allowed: false, reason: "AGENT_NOT_FOUND" };

    if (ctx.entryFeeCredits > 0 && minCompletedMatches > 0 && agent.wins + agent.losses < minCompletedMatches) {
      return { allowed: false, reason: "AGENT_INELIGIBLE_FOR_PUBLIC_CREDIT_TOURNAMENT" };
    }
  }

  return { allowed: true };
}
