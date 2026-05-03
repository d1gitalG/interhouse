import type { AgentProfile, AgentTier, House, MatchStatus, StrategyProfile, TournamentStatus } from "@prisma/client";

type AgentScoutingProfile = Pick<
  AgentProfile,
  "id" | "name" | "house" | "strategyProfile" | "tier" | "wins" | "losses" | "xp" | "toolsEnabled" | "customSystemPrompt"
>;

type RelatedParticipant = {
  agentId: string;
  score?: number | null;
  agent?: { name: string } | null;
};

type RelatedMatch = {
  id: string;
  status: MatchStatus;
  winnerId?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  participants?: RelatedParticipant[];
  tournamentMatch?: {
    round: number;
    slot: number;
    tournament?: { name: string } | null;
  } | null;
};

type RelatedTournamentEntry = {
  seed?: number | null;
  eliminatedAt?: Date | string | null;
  tournament?: {
    id: string;
    name: string;
    status: TournamentStatus;
    winnerAgentId?: string | null;
    createdAt?: Date | string | null;
  } | null;
};

export type ScoutingRecentMatch = {
  id: string;
  label: string;
  result: "WIN" | "LOSS" | "PENDING";
  scoreLine: string;
};

export type AgentScouting = {
  agentId: string;
  headline: string;
  tacticalIdentity: string;
  likelyFlaw: string;
  preferredFormat: string;
  resourceDiscipline: string;
  trapTendency: string;
  offReadTolerance: string;
  caveat: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  lowData: boolean;
  recordLine: string;
  winRateLabel: string;
  profileSignals: string[];
  promptSignals: string[];
  backingEvidence: string[];
  recentMatches: ScoutingRecentMatch[];
  tournamentHistory: string[];
};

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|_)\w/g, (match) => match.replace("_", " ").toUpperCase());
}

function pct(wins: number, total: number) {
  return total > 0 ? Math.round((wins / total) * 100) : 0;
}

function dateMs(value: Date | string | null | undefined) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function toolsCount(toolsEnabled: AgentProfile["toolsEnabled"]) {
  if (Array.isArray(toolsEnabled)) return toolsEnabled.length;
  return 0;
}

function strategyRead(strategy: StrategyProfile) {
  const reads: Record<StrategyProfile, string> = {
    AGGRESSIVE: "Pressure-first profile that tends to favor initiative over patience.",
    DEFENSIVE: "Stability profile that usually values survival, counters, and mistake reduction.",
    CHAOTIC: "Volatility profile; harder to scout, but harder to trust in long sets.",
    CALCULATED: "Deliberate profile built around measured trades and readable plans.",
    ADAPTIVE: "Adjustment profile that should improve when a set reveals opponent patterns.",
  };
  return reads[strategy];
}

function scoutingTraits(strategy: StrategyProfile, tier: AgentTier, totalMatches: number) {
  const traits: Record<StrategyProfile, Omit<AgentScouting, "agentId" | "headline" | "confidence" | "lowData" | "recordLine" | "winRateLabel" | "profileSignals" | "promptSignals" | "backingEvidence" | "recentMatches" | "tournamentHistory" | "caveat">> = {
    AGGRESSIVE: {
      tacticalIdentity: "Pressure agent: wants initiative and fast leverage.",
      likelyFlaw: "Can overcommit if the opponent absorbs the first read.",
      preferredFormat: "Best read in Quick Clash / short series until longer-form discipline is proven.",
      resourceDiscipline: "Likely spends high-value counters early unless match evidence says otherwise.",
      trapTendency: "Threatens traps by forcing opponents into reactive counters.",
      offReadTolerance: "Lower tolerance: a missed read can snowball quickly.",
    },
    DEFENSIVE: {
      tacticalIdentity: "Counter agent: tries to deny clean wins and wait out mistakes.",
      likelyFlaw: "Can become too passive when forced to create pressure.",
      preferredFormat: "Best read in Championship Series / longer sets where patience matters.",
      resourceDiscipline: "Likely preserves resources and accepts slower lines.",
      trapTendency: "Looks for traps after the opponent exhausts obvious counters.",
      offReadTolerance: "Higher tolerance: defensive plans can survive one bad read.",
    },
    CHAOTIC: {
      tacticalIdentity: "Mix-up agent: values unpredictability and broken rhythm.",
      likelyFlaw: "Volatility can become self-sabotage in scarce-resource spots.",
      preferredFormat: "Best read in short or noisy sets where opponents have little time to adapt.",
      resourceDiscipline: "Unclear discipline; watch for repeated resource burns.",
      trapTendency: "Can stumble into traps or spring them through unexpected lines.",
      offReadTolerance: "Medium tolerance: chaos masks errors but does not erase them.",
    },
    CALCULATED: {
      tacticalIdentity: "Planning agent: prefers measured counters and low-noise decisions.",
      likelyFlaw: "Can be punished by opponents who refuse predictable structure.",
      preferredFormat: "Best read in Scarcity Duel / resource-limited sets where planning is visible.",
      resourceDiscipline: "Likely tracks counter availability and avoids waste.",
      trapTendency: "Strong candidate for deliberate resource-trap setups.",
      offReadTolerance: "Medium-high tolerance if the plan has a fallback.",
    },
    ADAPTIVE: {
      tacticalIdentity: "Adjustment agent: tries to learn the opponent during the set.",
      likelyFlaw: "May start slowly before enough pattern evidence exists.",
      preferredFormat: "Best read in longer series where adaptation has time to pay off.",
      resourceDiscipline: "Likely shifts resource usage as opponent patterns emerge.",
      trapTendency: "Best traps should appear after early rounds reveal habits.",
      offReadTolerance: "High tolerance: missed reads are useful if they improve later decisions.",
    },
  };

  const caveat = totalMatches === 0
    ? "No completed public record yet; this is an archetype read, not a recommendation."
    : totalMatches < 3
      ? "Small public sample; back with caution until more matches confirm the profile."
      : tier === "ROOKIE"
        ? "Enough evidence to discuss, but rookie-tier variance still matters."
        : "Public record and profile fields provide usable backing evidence without revealing private prompts.";

  return { ...traits[strategy], caveat };
}

function tierRead(tier: AgentTier) {
  const reads: Record<AgentTier, string> = {
    ROOKIE: "Rookie-tier public résumé; expect variance until more results land.",
    CONTENDER: "Contender-tier résumé with enough signal to take seriously.",
    CHAMPION: "Champion-tier profile; prior success should shape opponent prep.",
    ELITE: "Elite-tier profile; bracket threat until proven otherwise.",
  };
  return reads[tier];
}

function houseRead(house: House) {
  const reads: Record<House, string> = {
    RED: "Red house marker: tempo and confrontation are likely themes.",
    GREEN: "Green house marker: endurance and incremental edges are likely themes.",
    BLUE: "Blue house marker: analytical control is likely a theme.",
    YELLOW: "Yellow house marker: opportunism and momentum swings are likely themes.",
  };
  return reads[house];
}

function safePromptSignals(prompt: string | null | undefined) {
  if (!prompt?.trim()) return ["No private playbook configured; scouting falls back to public profile fields."];

  const lower = prompt.toLowerCase();
  const signals = ["Private playbook configured; exact instructions are hidden."];

  if (prompt.length > 1200) signals.push("Deep instruction stack: likely has detailed conditional behavior.");
  else if (prompt.length > 350) signals.push("Moderate instruction depth: likely has a few explicit priorities.");
  else signals.push("Compact instruction stack: likely relies heavily on base strategy profile.");

  const categories: string[] = [];
  if (/risk|safe|avoid|conserve|defen[cs]/.test(lower)) categories.push("risk management");
  if (/adapt|learn|pattern|opponent|read/.test(lower)) categories.push("opponent reading");
  if (/random|chaos|mix|unpredict/.test(lower)) categories.push("mix-up behavior");
  if (/aggress|attack|pressure|force/.test(lower)) categories.push("pressure bias");
  if (categories.length > 0) signals.push(`Detected private-playbook emphasis: ${categories.slice(0, 3).join(", ")}.`);

  return signals;
}

function matchLabel(match: RelatedMatch) {
  const tournament = match.tournamentMatch?.tournament?.name;
  const bracket = match.tournamentMatch ? `R${match.tournamentMatch.round} · Slot ${match.tournamentMatch.slot}` : "Match";
  return tournament ? `${tournament} (${bracket})` : bracket;
}

function matchScoreLine(match: RelatedMatch) {
  const participants = match.participants ?? [];
  if (participants.length === 0) return "Participants pending";
  return participants
    .map((participant) => `${participant.agent?.name ?? participant.agentId.slice(0, 8)} ${participant.score ?? 0}`)
    .join(" · ");
}

function recentMatchCards(agentId: string, matches: RelatedMatch[]) {
  return [...matches]
    .filter((match) => match.participants?.some((participant) => participant.agentId === agentId))
    .sort((a, b) => dateMs(b.updatedAt ?? b.createdAt) - dateMs(a.updatedAt ?? a.createdAt))
    .slice(0, 3)
    .map<ScoutingRecentMatch>((match) => ({
      id: match.id,
      label: matchLabel(match),
      result: match.status !== "COMPLETED" || !match.winnerId ? "PENDING" : match.winnerId === agentId ? "WIN" : "LOSS",
      scoreLine: matchScoreLine(match),
    }));
}

function tournamentLines(agentId: string, entries: RelatedTournamentEntry[]) {
  return [...entries]
    .filter((entry) => entry.tournament)
    .sort((a, b) => dateMs(b.tournament?.createdAt) - dateMs(a.tournament?.createdAt))
    .slice(0, 3)
    .map((entry) => {
      const tournament = entry.tournament;
      if (!tournament) return "Tournament entry pending.";
      const result = tournament.winnerAgentId === agentId
        ? "won"
        : entry.eliminatedAt
          ? "eliminated"
          : tournament.status === "COMPLETED"
            ? "finished outside champion slot"
            : "still alive / pending";
      const seed = entry.seed ? `Seed ${entry.seed}` : "Unseeded";
      return `${tournament.name}: ${seed}, ${result}.`;
    });
}

export function deriveAgentScouting(params: {
  agent: AgentScoutingProfile;
  matches?: RelatedMatch[];
  tournamentEntries?: RelatedTournamentEntry[];
}): AgentScouting {
  const { agent } = params;
  const matches = params.matches ?? [];
  const tournamentEntries = params.tournamentEntries ?? [];
  const total = agent.wins + agent.losses;
  const winRate = pct(agent.wins, total);
  const recentMatches = recentMatchCards(agent.id, matches);
  const tournamentHistory = tournamentLines(agent.id, tournamentEntries);
  const lowData = total < 3 && recentMatches.length < 2 && tournamentHistory.length < 1;
  const confidence: AgentScouting["confidence"] = total >= 10 || recentMatches.length >= 3 ? "HIGH" : lowData ? "LOW" : "MEDIUM";
  const toolCount = toolsCount(agent.toolsEnabled);

  const profileSignals = [
    houseRead(agent.house),
    strategyRead(agent.strategyProfile),
    tierRead(agent.tier),
    toolCount > 0 ? `${toolCount} public tool flag${toolCount === 1 ? "" : "s"} enabled.` : "No public tool flags enabled.",
  ];

  const backingEvidence = [
    total > 0 ? `${agent.wins}-${agent.losses} lifetime public record (${winRate}% win rate).` : "No completed public wins/losses recorded yet.",
    agent.xp > 0 ? `${agent.xp.toLocaleString()} XP recorded.` : "No XP signal yet.",
    recentMatches.length > 0 ? `${recentMatches.length} recent match card${recentMatches.length === 1 ? "" : "s"} available.` : "No recent match history available in this view.",
    tournamentHistory.length > 0 ? `${tournamentHistory.length} tournament history note${tournamentHistory.length === 1 ? "" : "s"} available.` : "No tournament history available yet.",
  ];

  const traits = scoutingTraits(agent.strategyProfile, agent.tier, total);

  return {
    agentId: agent.id,
    headline: lowData
      ? `${agent.name} has a ${titleCase(agent.strategyProfile)} public profile, but scouting confidence is low.`
      : `${agent.name}: ${titleCase(agent.strategyProfile)} ${titleCase(agent.tier)} with ${winRate}% public win rate.`,
    ...traits,
    confidence,
    lowData,
    recordLine: total > 0 ? `${agent.wins}W / ${agent.losses}L` : "No public record",
    winRateLabel: total > 0 ? `${winRate}%` : "N/A",
    profileSignals,
    promptSignals: safePromptSignals(agent.customSystemPrompt),
    backingEvidence,
    recentMatches,
    tournamentHistory,
  };
}

export function buildMatchupPreview(first: AgentScouting, second: AgentScouting) {
  const confidence = first.confidence === "LOW" || second.confidence === "LOW" ? "LOW" : first.confidence === "HIGH" && second.confidence === "HIGH" ? "HIGH" : "MEDIUM";
  return {
    confidence,
    summary: `${first.recordLine} vs ${second.recordLine} · ${first.winRateLabel} vs ${second.winRateLabel}`,
    angles: [
      `${first.headline}`,
      `${second.headline}`,
      confidence === "LOW"
        ? "Low-data matchup: treat this as directional, not predictive."
        : `${first.tacticalIdentity} Edge check: ${first.caveat}`,
    ],
  };
}
