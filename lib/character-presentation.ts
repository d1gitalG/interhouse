export type CharacterHouse = "RED" | "GREEN" | "BLUE" | "YELLOW";
export type CharacterStrategy = "AGGRESSIVE" | "DEFENSIVE" | "CHAOTIC" | "CALCULATED" | "ADAPTIVE";

export type CharacterAgentInput = {
  id?: string;
  name: string;
  house: CharacterHouse;
  strategyProfile?: CharacterStrategy | string | null;
  customSystemPrompt?: string | null;
};

export type CharacterSummary = {
  archetype: string;
  flaw: string;
  voiceCue: string;
};

export type ReasoningBeats = {
  last?: string;
  read?: string;
  plan?: string;
  action?: string;
};

const STRATEGY_BASE: Record<CharacterStrategy, CharacterSummary> = {
  AGGRESSIVE: {
    archetype: "pressure striker",
    flaw: "overcommits",
    voiceCue: "Tempo",
  },
  DEFENSIVE: {
    archetype: "fortress guard",
    flaw: "plays too safe",
    voiceCue: "Hold",
  },
  CHAOTIC: {
    archetype: "volatile feinter",
    flaw: "breaks good patterns",
    voiceCue: "Shift",
  },
  CALCULATED: {
    archetype: "cold tactician",
    flaw: "overcalculates",
    voiceCue: "Measure",
  },
  ADAPTIVE: {
    archetype: "mirror duelist",
    flaw: "overanswers",
    voiceCue: "Answered",
  },
};

function normalizeStrategy(strategy?: string | null): CharacterStrategy {
  if (
    strategy === "AGGRESSIVE" ||
    strategy === "DEFENSIVE" ||
    strategy === "CHAOTIC" ||
    strategy === "CALCULATED" ||
    strategy === "ADAPTIVE"
  ) {
    return strategy;
  }

  return "ADAPTIVE";
}

export function deriveCharacterSummary(agent: CharacterAgentInput): CharacterSummary {
  const base = STRATEGY_BASE[normalizeStrategy(agent.strategyProfile)];
  const text = `${agent.name} ${agent.house} ${agent.customSystemPrompt ?? ""}`.toLowerCase();

  if (/red comet|aries|striker|vanguard|mars/.test(text)) {
    return { archetype: "tempo striker", flaw: "chases tempo", voiceCue: "Tempo" };
  }
  if (/granite crown|capricorn|crown|stone|patient/.test(text)) {
    return { archetype: "stone disciplinarian", flaw: "gets rigid", voiceCue: "Hold" };
  }
  if (/twin static|gemini|static|chaos|chaotic/.test(text)) {
    return { archetype: "volatile feinter", flaw: "abandons patterns", voiceCue: "Static shift" };
  }
  if (/gilded blade|libra|mirror|balance/.test(text)) {
    return { archetype: "mirror duelist", flaw: "overmirrors", voiceCue: "Answered" };
  }
  if (/moon bastion|bastion|fortress|defensive/.test(text)) {
    return { archetype: "fortress", flaw: "misses kill windows", voiceCue: "Shelter" };
  }
  if (/ember jackal|jackal|feint/.test(text)) {
    return { archetype: "feint predator", flaw: "loves bait", voiceCue: "Snap" };
  }
  if (/violet siren|siren|bait/.test(text)) {
    return { archetype: "lure artist", flaw: "overlures", voiceCue: "Come closer" };
  }
  if (/jade tactician|tactician|patient/.test(text)) {
    return { archetype: "resource tactician", flaw: "acts late", voiceCue: "Measure" };
  }
  if (/brass sentinel|sentinel|guard/.test(text)) {
    return { archetype: "gatekeeper", flaw: "holds reads", voiceCue: "Stand" };
  }

  return base;
}

function cleanSentence(value?: string): string | undefined {
  const cleaned = value?.trim().replace(/[.]+$/, "");
  return cleaned || undefined;
}

export function parseReasoningBeats(reasoning?: string | null): ReasoningBeats {
  if (!reasoning) return {};

  const last = reasoning.match(/Last:\s*([^.]*(?:\.[^RrPp]*)?)\s*(?=Read:|Plan:|$)/)?.[1];
  const read = reasoning.match(/Read:\s*([^.]*(?:->|;)[^.]*)\./)?.[1];
  const plan = reasoning.match(/Plan:\s*([^.]*)\./)?.[1];
  const action = reasoning.match(/Plan:[\s\S]*?\.\s*([^.]*(?:\.[^.]*)?)\.?$/)?.[1] ?? reasoning.split(".").slice(-2).join(".");

  return {
    last: cleanSentence(last),
    read: cleanSentence(read),
    plan: cleanSentence(plan),
    action: cleanSentence(action),
  };
}

export type StoryParticipant = {
  agentId: string;
  score: number;
  agent: CharacterAgentInput;
};

export type StoryMove = {
  round: number;
  agentId: string;
  move: string;
  reasoning?: string | null;
};

export function buildPostMatchStory(params: {
  participants: StoryParticipant[];
  moves: StoryMove[];
  winnerId?: string | null;
}): string | null {
  const winner = params.participants.find((participant) => participant.agentId === params.winnerId);
  if (!winner || params.participants.length < 2) return null;

  const loser = params.participants.find((participant) => participant.agentId !== winner.agentId) ?? params.participants[0];
  const winnerCharacter = deriveCharacterSummary(winner.agent);
  const loserCharacter = deriveCharacterSummary(loser.agent);
  const winnerLastMove = [...params.moves].reverse().find((move) => move.agentId === winner.agentId);
  const beats = parseReasoningBeats(winnerLastMove?.reasoning);
  const score = `${winner.score}-${loser.score}`;
  const closingBeat = beats.plan ? `The closing plan was ${beats.plan}.` : beats.action ? `${beats.action}.` : "The final read held.";

  return `${winner.agent.name}, the ${winnerCharacter.archetype}, beat ${loser.agent.name}'s ${loserCharacter.archetype} ${score}. ${closingBeat}`;
}
