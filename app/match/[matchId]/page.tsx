"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createEmptyBoard, type TttBoard } from "@/lib/ttt-engine";

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

export default function MatchPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params?.matchId ?? "";
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [joinAgentId, setJoinAgentId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const matchRef = useRef<MatchDetails | null>(null);
  const tickInFlightRef = useRef(false);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

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

  const latestReasoningByAgent = useMemo(() => {
    const output = new Map<string, MatchDetails["moves"][number]>();
    if (!match) return output;
    for (const move of match.moves) {
      output.set(move.agentId, move);
    }
    return output;
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
              <p className="text-xs tracking-[0.3em] text-zinc-400">MATCH {match.id}</p>
              <h1 className="mt-2 text-3xl font-semibold">{match.game} Arena</h1>
              <p className="mt-3 text-sm text-zinc-300">
                {match.series} | {match.status} | Round {match.currentRound} | {match.stakeMode}{" "}
                {match.stakeAmount}
              </p>
              <p className="mt-4 text-sm font-medium text-zinc-200">
                Status: {match.status}
                {match.status === "ACTIVE" ? " (autonomous rounds running)" : ""}
              </p>

              {match.status === "COMPLETED" && winner ? (
                <div
                  className="mt-4 rounded-lg px-4 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: HOUSE_COLORS[winner.house] }}
                >
                  Winner: {winner.name} ({winner.house})
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

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-xl font-semibold">Participants</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {match.participants.map((participant) => (
                  <article key={participant.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{participant.agent.name}</p>
                      <span
                        className="rounded-full px-2 py-1 text-xs font-semibold text-white"
                        style={{ backgroundColor: HOUSE_COLORS[participant.agent.house] }}
                      >
                        {participant.agent.house}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">Score: {participant.score}</p>
                    <p className="text-sm text-zinc-300">Credits: {participant.agent.credits}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
              <h2 className="text-xl font-semibold">Latest Agent Reasoning</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {match.participants.map((participant) => {
                  const lastMove = latestReasoningByAgent.get(participant.agentId);
                  return (
                    <article key={participant.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                      <p className="text-sm font-medium">{participant.agent.name}</p>
                      <p className="mt-2 text-xs text-zinc-400">
                        {lastMove ? `Round ${lastMove.round} | ${lastMove.move}` : "No move yet"}
                      </p>
                      {lastMove?.reasoning === "Fallback move used due to provider response error." ? (
                        <p className="mt-2 inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-300">
                          Provider fallback
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm text-zinc-200">
                        {lastMove?.reasoning ?? "Reasoning not available yet."}
                      </p>
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
                    return (
                      <article key={move.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                        <p className="text-sm font-medium">
                          Round {move.round} | {mover?.name ?? move.agentId} | {move.move}
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">{move.reasoning ?? "No reasoning provided."}</p>
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


