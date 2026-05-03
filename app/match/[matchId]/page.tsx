"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { buildPostMatchStory, deriveCharacterSummary, parseReasoningBeats } from "@/lib/character-presentation";
import { createEmptyBoard, type TttBoard } from "@/lib/ttt-engine";
import { getFormatExplainer, getPublicFormatName, getRpsCounter, getRpsMoveLimit, normalizeRpsMove, type RpsMove } from "@/lib/tournament-presentation";

type House = "RED" | "GREEN" | "BLUE" | "YELLOW";
type MatchStatus = "WAITING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

type MatchDetails = {
  id: string;
  game: "RPS" | "TTT" | "C4" | "CHESS" | "CHECKERS";
  series: "QUICK" | "BO3" | "BO5";
  status: MatchStatus;
  currentRound: number;
  stakeMode: "CREDITS" | "SOL";
  stakeAmount: number;
  solEscrowAddress?: string | null;
  solSettledAt?: string | null;
  winnerId: string | null;
  participants: Array<{
    id: string;
    agentId: string;
    isCreator: boolean;
    score: number;
    agent: {
      id: string;
      name: string;
      house: House;
      credits: number;
      personality?: string | null;
      strategy?: string | null;
      strategyProfile?: string | null;
    };
  }>;
  moves: Array<{
    id: string;
    round: number;
    agentId: string;
    move: string;
    reasoning: string | null;
  }>;
};

type AgentOption = {
  id: string;
  name: string;
  house: House;
};

const HOUSE_COLORS: Record<House, string> = {
  RED: "#DC2626",
  GREEN: "#16A34A",
  BLUE: "#2563EB",
  YELLOW: "#CA8A04",
};

function getMoveUsageBeforeRound(moves: MatchDetails["moves"], agentId: string, round: number) {
  const usage: Record<RpsMove, number> = { ROCK: 0, PAPER: 0, SCISSORS: 0 };

  for (const move of moves) {
    if (move.round >= round) continue;
    const normalized = normalizeRpsMove(move.move);
    if (move.agentId === agentId && normalized) {
      usage[normalized] += 1;
    }
  }

  return usage;
}

export default function MatchPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params?.matchId ?? "";
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [joinAgentId, setJoinAgentId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const matchRef = useRef<MatchDetails | null>(null);
  const tickInFlightRef = useRef(false);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  const toggleReasoning = (agentId: string) => {
    setExpandedReasoning((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!matchId) return;

    setIsLoading(true);
    const source = new EventSource(`/api/matches/${matchId}/spectate`);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as
          | { type: "state" | "complete"; match: MatchDetails }
          | { type: "error"; error: string };

        if (payload.type === "error") {
          setError(payload.error);
          return;
        }

        setMatch(payload.match);
        setError(null);
        setIsLoading(false);

        if (payload.type === "complete") {
          source.close();
        }
      } catch {
        setError("Invalid spectate payload");
        setIsLoading(false);
      }
    };

    source.onerror = () => {
      setError("Spectate connection lost");
      setIsLoading(false);
    };

    return () => {
      source.close();
    };
  }, [matchId]);

  useEffect(() => {
    if (!match || match.status !== "WAITING") return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        const data = (await res.json()) as { agents?: AgentOption[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load agents");
        if (cancelled) return;

        const participantIds = new Set(match.participants.map((participant) => participant.agentId));
        const joinableAgents = (data.agents ?? []).filter((agent) => !participantIds.has(agent.id));
        setAgents(joinableAgents);
        setJoinAgentId((current) => {
          if (current && joinableAgents.some((agent) => agent.id === current)) return current;
          return joinableAgents[0]?.id ?? "";
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load agents");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [match]);

  useEffect(() => {
    if (!matchId) return;

    const interval = setInterval(() => {
      const current = matchRef.current;
      if (!current || current.status !== "ACTIVE" || tickInFlightRef.current) return;

      tickInFlightRef.current = true;
      void (async () => {
        try {
          const res = await fetch(`/api/matches/${matchId}/tick`, { method: "POST" });
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            const apiError = data?.error ?? "Failed to run round tick";
            if (
              apiError !== "MATCH_NOT_ACTIVE" &&
              apiError !== "ROUND_ADVANCED" &&
              apiError !== "ROUND_ALREADY_PROCESSED"
            ) {
              setError(apiError);
            }
          }
        } catch {
          setError("Failed to run round tick");
        } finally {
          tickInFlightRef.current = false;
        }
      })();
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [matchId]);

  const onJoinMatch = async () => {
    if (!joinAgentId) return;

    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentAgentId: joinAgentId }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Failed to join match");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join match");
    } finally {
      setIsJoining(false);
    }
  };

  const winner = useMemo(() => {
    if (!match?.winnerId) return null;
    return match.participants.find((p) => p.agentId === match.winnerId)?.agent ?? null;
  }, [match]);

  const formatName = match ? getPublicFormatName({ game: match.game, series: match.series, entryFeeCredits: match.stakeAmount }) : "";
  const formatExplainer = match ? getFormatExplainer({ game: match.game, series: match.series, entryFeeCredits: match.stakeAmount }) : "";
  const rpsMoveLimit = match ? getRpsMoveLimit(match.series) : 5;

  const escrowStubState = useMemo(() => {
    if (!match) return [];

    const walletState = match.stakeMode === "SOL" ? "Awaiting wallet approval" : "Wallet not required";
    const escrowState = match.solEscrowAddress ? `Escrow ready: ${match.solEscrowAddress}` : "Escrow not initialized";
    const settlementState = match.solSettledAt
      ? `Settled at ${new Date(match.solSettledAt).toLocaleString()}`
      : match.status === "COMPLETED"
        ? "Settlement stub pending winner payout"
        : "Settlement not started";

    return [
      { label: "Wallet", value: walletState },
      { label: "Escrow", value: escrowState },
      { label: "Settlement", value: settlementState },
    ];
  }, [match]);

  const latestReasoningByAgent = useMemo(() => {
    const output = new Map<string, MatchDetails["moves"][number]>();
    if (!match) return output;
    for (const move of match.moves) {
      output.set(move.agentId, move);
    }
    return output;
  }, [match]);

  const postMatchStory = useMemo(() => {
    if (!match || match.status !== "COMPLETED") return null;
    return buildPostMatchStory({
      participants: match.participants,
      moves: match.moves,
      winnerId: match.winnerId,
    });
  }, [match]);

  const resourceCounts = useMemo(() => {
    const counts = new Map<string, Record<string, number>>();
    if (!match || match.game !== "RPS") return counts;

    for (const p of match.participants) {
      const usage = { ROCK: 0, PAPER: 0, SCISSORS: 0 };
      match.moves
        .filter((m) => m.agentId === p.agentId)
        .forEach((m) => {
          const move = m.move.toUpperCase();
          if (move in usage) usage[move as keyof typeof usage]++;
        });
      counts.set(p.agentId, usage);
    }
    return counts;
  }, [match]);

  const tttState = useMemo(() => {
    if (!match || match.game !== "TTT") return null;

    const p1 = match.participants.find((participant) => participant.isCreator) ?? match.participants[0];
    const p2 = match.participants.find((participant) => participant.id !== p1.id) ?? null;
    if (!p2) return null;

    const board: TttBoard = createEmptyBoard();

    const roundMoves = match.moves.filter((move) => move.round === match.currentRound);
    for (let index = 0; index < roundMoves.length; index += 1) {
      const move = roundMoves[index];
      const parsed = move.move.match(/^(\d)\s*,\s*(\d)$/);
      if (!parsed) continue;

      const row = Number(parsed[1]);
      const col = Number(parsed[2]);
      if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
      if (row < 0 || row > 2 || col < 0 || col > 2) continue;
      if (board[row][col] !== "") continue;

      board[row][col] = index % 2 === 0 ? "X" : "O";
    }

    return { board, p1, p2 };
  }, [match]);

  return (
    <main className="min-h-screen bg-[#05070C] px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {isLoading ? <p className="text-sm text-zinc-400">Loading match...</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {!isLoading && !match ? <p className="text-sm text-zinc-400">Match not found.</p> : null}

        {match ? (
          <>
            <header className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs tracking-[0.3em] text-zinc-400">MATCH {match.id}</p>
                  <h1 className="mt-2 text-3xl font-semibold">{match.game} Arena</h1>
                </div>
                <nav className="flex flex-wrap gap-3">
                  <Link href="/lobby" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500">
                    Lobby
                  </Link>
                  <Link href="/tournaments" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:border-amber-300/70">
                    Tournaments
                  </Link>
                </nav>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100">
                  {formatName}
                </span>
                <span className="text-sm text-zinc-300">
                  {match.series} | {match.status} | Round {match.currentRound} | {match.stakeMode} {match.stakeAmount}
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">{formatExplainer}</p>
              <p className="mt-4 text-sm font-medium text-zinc-200">
                Status: {match.status}
                {match.status === "ACTIVE" ? " (autonomous rounds running)" : ""}
              </p>

              <div
                className={`mt-4 rounded-xl border p-4 text-sm ${
                  match.stakeMode === "SOL"
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-50"
                    : "border-zinc-800 bg-zinc-950/70 text-zinc-200"
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold tracking-[0.3em] text-current/70 uppercase">Escrow Roadmap</p>
                    <p className="mt-2 font-medium">
                      {match.stakeMode === "SOL" ? "Solana wallet and escrow integration" : "Future on-chain settlement"}
                    </p>
                    <p className="mt-1 text-current/80">
                      {match.stakeMode === "SOL"
                        ? "SOL matches are currently in preview mode. On-chain wallet approval, escrow funding, and automated settlement are not yet live."
                        : "This match is using the Credits system. The Solana integration represented here is a functional preview of the upcoming on-chain path."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-current/15 bg-[#05070C]/30 p-4 md:min-w-64">
                    <p className="text-sm font-medium">Wallet connection</p>
                    <p className="mt-1 text-sm opacity-60">
                      {match.stakeMode === "SOL" ? "Disconnected (Stub)" : "Not required for Credits"}
                    </p>
                    <button
                      type="button"
                      disabled
                      className="mt-3 w-full rounded-lg border border-current/20 px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
                    >
                      {match.stakeMode === "SOL" ? "Approve Escrow" : "Connect Wallet"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {escrowStubState.map((item) => (
                    <div key={item.label} className="rounded-xl border border-current/15 bg-[#05070C]/30 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-current/70">{item.label}</p>
                      <p className="mt-2 font-medium">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-current/20 px-2 py-1">Funding signature: stub</span>
                  <span className="rounded-full border border-current/20 px-2 py-1">Escrow PDA: placeholder</span>
                  <span className="rounded-full border border-current/20 px-2 py-1">Winner payout: stub</span>
                </div>
              </div>

              {match.status === "COMPLETED" && winner ? (
                <div
                  className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center animate-in fade-in zoom-in duration-500"
                  style={{
                    borderColor: HOUSE_COLORS[winner.house],
                    backgroundColor: `${HOUSE_COLORS[winner.house]}15`,
                  }}
                >
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-2xl"
                    style={{ backgroundColor: HOUSE_COLORS[winner.house] }}
                  >
                    🏆
                  </div>
                  <h2 className="mt-6 text-4xl font-black tracking-tighter text-white uppercase">
                    Series Winner
                  </h2>
                  <p className="mt-2 text-2xl font-bold" style={{ color: HOUSE_COLORS[winner.house] }}>
                    {winner.name}
                  </p>
                  <p className="mt-1 text-sm font-medium tracking-[0.2em] text-zinc-400 uppercase">
                    House {winner.house}
                  </p>
                  {postMatchStory ? (
                    <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-200">{postMatchStory}</p>
                  ) : null}
                  
                  <div className="mt-8 flex gap-4">
                    <div className="rounded-xl border border-white/10 bg-black/40 px-6 py-3">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Final Score</p>
                      <p className="mt-1 text-xl font-mono font-bold">
                        {match.participants.find(p => p.isCreator)?.score} - {match.participants.find(p => !p.isCreator)?.score}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/40 px-6 py-3">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Payout</p>
                      <p className="mt-1 text-xl font-mono font-bold text-emerald-400">
                        +{match.stakeAmount * 2} {match.stakeMode}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {match.status === "WAITING" ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-sm font-medium text-zinc-100">Waiting for opponent</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Join this match with a second agent to start autonomous rounds.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 md:flex-row">
                    <select
                      value={joinAgentId}
                      onChange={(event) => setJoinAgentId(event.target.value)}
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                    >
                      {agents.length === 0 ? <option value="">No eligible agents available</option> : null}
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.house})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={onJoinMatch}
                      disabled={isJoining || !joinAgentId}
                      className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
                    >
                      {isJoining ? "Joining..." : "Join Match"}
                    </button>
                  </div>
                </div>
              ) : null}
            </header>

            {match.game === "RPS" ? (
              <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-zinc-900/70 to-zinc-950 p-6">
                <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-200/80">How to read this fight</p>
                    <h2 className="mt-2 text-xl font-semibold text-zinc-100">Watch the counters, not just the winner.</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      Each agent has {rpsMoveLimit} uses of ROCK, PAPER, and SCISSORS in this format. When a clean counter hits zero, the opponent can create a protected lane.
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Creator role</p>
                    <p className="mt-2 text-sm text-zinc-300">Usually breaks mirror draws directly and sets the first pressure line.</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Challenger role</p>
                    <p className="mt-2 text-sm text-zinc-300">Usually looks for counter-counter pivots and punishes exhausted lanes.</p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-xl font-semibold">Participants</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {match.participants.map((participant) => {
                  const usage = resourceCounts.get(participant.agentId);
                  const MOVE_LIMIT = getRpsMoveLimit(match.series);
                  const character = deriveCharacterSummary(participant.agent);

                  return (
                    <article key={participant.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{participant.agent.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">{participant.isCreator ? "Creator" : "Challenger"}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-200">
                            {participant.isCreator ? "Creator" : "Challenger"}
                          </span>
                          <span
                            className="rounded-full px-2 py-1 text-xs font-semibold text-white"
                            style={{ backgroundColor: HOUSE_COLORS[participant.agent.house] }}
                          >
                            {participant.agent.house}
                          </span>
                        </div>
                      </div>
                      {participant.agent.personality ? (
                        <p className="mt-2 text-xs italic text-zinc-400">&ldquo;{participant.agent.personality}&rdquo;</p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
                          {character.archetype}
                        </span>
                        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
                          flaw: {character.flaw}
                        </span>
                        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-200">
                          “{character.voiceCue}”
                        </span>
                      </div>

                      {usage ? (
                        <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Resource Limits</p>
                          <div className="grid grid-cols-3 gap-2">
                            {["ROCK", "PAPER", "SCISSORS"].map((move) => {
                              const used = usage[move] || 0;
                              const remaining = Math.max(0, MOVE_LIMIT - used);
                              const percent = (used / MOVE_LIMIT) * 100;

                              return (
                                <div key={move} className="space-y-1">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-medium text-zinc-400">{move}</span>
                                    <span className={remaining === 0 ? "text-red-500 font-bold" : "text-zinc-200"}>
                                      {remaining}
                                    </span>
                                  </div>
                                  <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                                    <div
                                      className={`h-full transition-all duration-500 ${
                                        remaining === 0 ? "bg-red-600" : remaining === 1 ? "bg-amber-500" : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3 space-y-1 text-sm text-zinc-300">
                        <p>Score: {participant.score}</p>
                        <p>Credits: {participant.agent.credits}</p>
                        {participant.agent.strategy ? (
                          <p className="mt-2 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
                            <span className="font-semibold uppercase tracking-wider text-zinc-500">Strategy:</span>{" "}
                            {participant.agent.strategy}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-xl font-semibold">Latest Agent Reasoning</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {match.participants.map((participant) => {
                  const lastMove = latestReasoningByAgent.get(participant.agentId);
                  const isExpanded = expandedReasoning.has(participant.agentId);
                  const character = deriveCharacterSummary(participant.agent);
                  const beats = parseReasoningBeats(lastMove?.reasoning);
                  const resourceLimit = getRpsMoveLimit(match.series);
                  const usageBefore = lastMove
                    ? getMoveUsageBeforeRound(match.moves, participant.agentId, lastMove.round)
                    : null;
                  const desiredCounterUsage = beats.readDetail && usageBefore ? usageBefore[beats.readDetail.desiredCounter] : 0;
                  const counterWasExhausted = Boolean(
                    beats.readDetail?.misses && desiredCounterUsage >= resourceLimit
                  );
                  const opponent = match.participants.find((candidate) => candidate.agentId !== participant.agentId);
                  const chosenMove = lastMove ? normalizeRpsMove(lastMove.move) : null;
                  const opponentBestCounter = chosenMove ? getRpsCounter(chosenMove) : null;
                  const opponentUsageBefore = lastMove && opponent
                    ? getMoveUsageBeforeRound(match.moves, opponent.agentId, lastMove.round)
                    : null;
                  const opponentCounterUsage = opponentBestCounter && opponentUsageBefore
                    ? opponentUsageBefore[opponentBestCounter]
                    : 0;
                  const opponentCounterExhausted = Boolean(
                    opponentBestCounter && opponentCounterUsage >= resourceLimit
                  );
                  return (
                    <article key={participant.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{participant.agent.name}</p>
                          <p className="mt-1 text-xs text-zinc-400">
                            {lastMove ? `Round ${lastMove.round} | ${lastMove.move}` : "No move yet"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleReasoning(participant.agentId)}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                        >
                          {isExpanded ? "Collapse" : "Expand"}
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <p className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-300">
                          {character.archetype}
                        </p>
                        {beats.plan ? (
                          <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-200">
                            Plan: {beats.plan}
                          </p>
                        ) : null}
                        {beats.readDetail ? (
                          <>
                            <p className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-200">
                              Read: {beats.readDetail.predicted}
                            </p>
                            <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                              Best counter: {beats.readDetail.desiredCounter}
                            </p>
                            {beats.readDetail.misses ? (
                              <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200">
                                {counterWasExhausted
                                  ? `${beats.readDetail.desiredCounter} exhausted (${desiredCounterUsage}/${resourceLimit})`
                                  : "Counter unavailable"}
                              </p>
                            ) : null}
                            <p
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${
                                beats.readDetail.misses
                                  ? "border-orange-500/40 bg-orange-500/10 text-orange-200"
                                  : "border-teal-500/40 bg-teal-500/10 text-teal-200"
                              }`}
                            >
                              Chose: {beats.readDetail.chosen}
                            </p>
                            {opponentCounterExhausted && opponentBestCounter ? (
                              <>
                                <p className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-1 text-xs font-medium text-fuchsia-200">
                                  Opponent {opponentBestCounter} exhausted ({opponentCounterUsage}/{resourceLimit})
                                </p>
                                <p className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-200">
                                  Resource trap
                                </p>
                              </>
                            ) : null}
                          </>
                        ) : beats.read ? (
                          <p className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-200">
                            Read: {beats.read}
                          </p>
                        ) : null}
                        {lastMove?.reasoning === "Fallback move used due to provider response error." ? (
                          <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-300">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Provider fallback
                          </p>
                        ) : lastMove?.reasoning ? (
                          <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Provider healthy
                          </p>
                        ) : null}
                      </div>

                      <p className={`mt-3 text-sm text-zinc-200 ${isExpanded ? "" : "line-clamp-2"}`}>
                        {beats.action ?? lastMove?.reasoning ?? "Reasoning not available yet."}
                      </p>
                      {isExpanded && beats.last ? <p className="mt-2 text-xs text-zinc-500">{beats.last}</p> : null}
                    </article>
                  );
                })}
              </div>
            </section>

            {match.game === "TTT" && tttState ? (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
                <h2 className="text-xl font-semibold">Board</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  X: <span style={{ color: HOUSE_COLORS[tttState.p1.agent.house] }}>{tttState.p1.agent.name}</span>{" "}
                  | O: <span style={{ color: HOUSE_COLORS[tttState.p2.agent.house] }}>{tttState.p2.agent.name}</span>
                </p>
                <div className="mt-4 grid w-full max-w-xs grid-cols-3 gap-2">
                  {tttState.board.flatMap((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const color =
                        cell === "X"
                          ? HOUSE_COLORS[tttState.p1.agent.house]
                          : cell === "O"
                            ? HOUSE_COLORS[tttState.p2.agent.house]
                            : "#52525B";
                      const backgroundColor = cell === "" ? "#3F3F46" : "#09090B";
                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className="flex h-20 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-2xl font-bold"
                          style={{ color, backgroundColor }}
                        >
                          {cell}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            ) : match.game === "RPS" ? (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
                <h2 className="text-xl font-semibold">Move History</h2>
                {match.moves.length === 0 ? <p className="mt-4 text-sm text-zinc-400">No moves yet.</p> : null}
                <div className="mt-4 space-y-3">
                  {match.moves.map((move) => {
                    const mover = match.participants.find((p) => p.agentId === move.agentId)?.agent;
                    const opponent = match.participants.find((p) => p.agentId !== move.agentId);
                    const beats = parseReasoningBeats(move.reasoning);
                    const resourceLimit = getRpsMoveLimit(match.series);
                    const usageBefore = getMoveUsageBeforeRound(match.moves, move.agentId, move.round);
                    const desiredCounterUsage = beats.readDetail ? usageBefore[beats.readDetail.desiredCounter] : 0;
                    const counterWasExhausted = Boolean(
                      beats.readDetail?.misses && desiredCounterUsage >= resourceLimit
                    );
                    const chosenMove = normalizeRpsMove(move.move);
                    const opponentBestCounter = chosenMove ? getRpsCounter(chosenMove) : null;
                    const opponentUsageBefore = opponent
                      ? getMoveUsageBeforeRound(match.moves, opponent.agentId, move.round)
                      : null;
                    const opponentCounterUsage = opponentBestCounter && opponentUsageBefore
                      ? opponentUsageBefore[opponentBestCounter]
                      : 0;
                    const opponentCounterExhausted = Boolean(
                      opponentBestCounter && opponentCounterUsage >= resourceLimit
                    );

                    return (
                      <article key={move.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                        <p className="text-sm font-medium">
                          Round {move.round} | {mover?.name ?? move.agentId} | {move.move}
                        </p>
                        {beats.readDetail ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-200">
                              Read: {beats.readDetail.predicted}
                            </span>
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                              Best counter: {beats.readDetail.desiredCounter}
                            </span>
                            {beats.readDetail.misses ? (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200">
                                {counterWasExhausted
                                  ? `${beats.readDetail.desiredCounter} exhausted (${desiredCounterUsage}/${resourceLimit})`
                                  : "Counter unavailable"}
                              </span>
                            ) : null}
                            <span
                              className={`rounded-full border px-2 py-1 text-xs font-medium ${
                                beats.readDetail.misses
                                  ? "border-orange-500/40 bg-orange-500/10 text-orange-200"
                                  : "border-teal-500/40 bg-teal-500/10 text-teal-200"
                              }`}
                            >
                              Chose: {beats.readDetail.chosen}
                            </span>
                            {opponentCounterExhausted && opponentBestCounter ? (
                              <>
                                <span className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-1 text-xs font-medium text-fuchsia-200">
                                  Opponent {opponentBestCounter} exhausted ({opponentCounterUsage}/{resourceLimit})
                                </span>
                                <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-200">
                                  Resource trap
                                </span>
                              </>
                            ) : null}
                            {beats.plan ? (
                              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-200">
                                Plan: {beats.plan}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <p className="mt-2 text-sm text-zinc-300">{beats.action ?? move.reasoning ?? "No reasoning provided."}</p>
                        {beats.last ? <p className="mt-1 text-xs text-zinc-500">{beats.last}</p> : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
