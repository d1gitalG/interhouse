"use client";

import { useEffect, useState } from "react";

type Agent = {
  id: string;
  name: string;
  house: "RED" | "GREEN" | "BLUE" | "YELLOW";
  strategyProfile: "AGGRESSIVE" | "DEFENSIVE" | "CHAOTIC" | "CALCULATED" | "ADAPTIVE";
  tier: "ROOKIE" | "CONTENDER" | "CHAMPION" | "ELITE";
  wins: number;
  losses: number;
  xp: number;
  credits: number;
  lockedCredits: number;
  createdAt: string;
};

type AgentDetailProps = {
  agentId: string;
  onClose: () => void;
  onDeleted?: () => void;
};

export function AgentDetailModal({ agentId, onClose, onDeleted }: AgentDetailProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load agent");
        setAgent(data.agent);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load agent");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAgent();
  }, [agentId]);

  const onDelete = async () => {
    if (!agent) return;
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "AGENT_IN_ACTIVE_MATCH") {
          throw new Error("Cannot delete agent while they are in an active match.");
        }
        throw new Error(data.error || "Failed to delete agent");
      }

      onDeleted?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete agent");
      setShowConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!agentId) return null;

  const houseColors: Record<string, { text: string; bg: string; border: string; glow: string }> = {
    RED: { text: "#FCA5A5", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.35)", glow: "rgba(239, 68, 68, 0.2)" },
    GREEN: { text: "#86EFAC", bg: "rgba(34, 197, 94, 0.12)", border: "rgba(34, 197, 94, 0.35)", glow: "rgba(34, 197, 94, 0.2)" },
    BLUE: { text: "#93C5FD", bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.35)", glow: "rgba(59, 130, 246, 0.2)" },
    YELLOW: { text: "#FDE047", bg: "rgba(250, 204, 21, 0.12)", border: "rgba(250, 204, 21, 0.35)", glow: "rgba(250, 204, 21, 0.2)" },
  };

  const colors = agent ? houseColors[agent.house] : houseColors.RED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-800 bg-[#0A0C14] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Glow */}
        <div 
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full blur-[100px]"
          style={{ backgroundColor: colors.glow }}
        />

        <button 
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          ✕
        </button>

        {isLoading ? (
          <div className="flex h-96 items-center justify-center">
            <p className="text-sm text-zinc-500 animate-pulse">Loading Agent Profile...</p>
          </div>
        ) : error ? (
          <div className="flex h-96 flex-col items-center justify-center p-8 text-center">
            <p className="text-red-400">{error}</p>
            <button onClick={onClose} className="mt-4 text-sm text-zinc-400 underline">Close</button>
          </div>
        ) : agent ? (
          <div className="p-8">
            <header className="space-y-1">
              <div className="flex items-center gap-2">
                <span 
                  className="rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest"
                  style={{ color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }}
                >
                  HOUSE {agent.house}
                </span>
                <span className="text-[10px] font-bold tracking-widest text-zinc-500">
                  TIER {agent.tier}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-white">{agent.name}</h2>
              <p className="text-xs text-zinc-500 font-mono">ID: {agent.id}</p>
            </header>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">WIN RATE</p>
                <p className="mt-1 text-2xl font-mono font-bold text-white">
                  {agent.wins + agent.losses > 0 
                    ? Math.round((agent.wins / (agent.wins + agent.losses)) * 100)
                    : 0}%
                </p>
                <p className="mt-1 text-[10px] text-zinc-500">{agent.wins}W / {agent.losses}L</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">TOTAL XP</p>
                <p className="mt-1 text-2xl font-mono font-bold text-white">{agent.xp}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Rank #--</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">CREDITS</p>
                <p className="mt-1 text-2xl font-mono font-bold text-white">{agent.credits}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{agent.lockedCredits} Locked</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500">STRATEGY</p>
                <p className="mt-1 text-lg font-bold text-white">{agent.strategyProfile}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Primary Logic</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <p className="text-[10px] font-bold tracking-widest text-zinc-500">HISTORY</p>
              <p className="mt-2 text-xs text-zinc-400">Created {new Date(agent.createdAt).toLocaleDateString()}</p>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button 
                onClick={onClose}
                disabled={isDeleting}
                className="w-full rounded-xl bg-zinc-100 py-3 text-sm font-bold text-zinc-950 hover:bg-white disabled:opacity-50"
              >
                Close Profile
              </button>

              {showConfirmDelete ? (
                <div className="flex gap-2">
                  <button 
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="flex-1 rounded-xl bg-red-600/20 py-2.5 text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-600/30 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button 
                    onClick={() => setShowConfirmDelete(false)}
                    disabled={isDeleting}
                    className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-bold text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowConfirmDelete(true)}
                  disabled={isDeleting}
                  className="w-full py-2 text-[10px] font-bold tracking-widest text-zinc-600 uppercase hover:text-red-400 transition-colors"
                >
                  Terminate Agent Entry
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
