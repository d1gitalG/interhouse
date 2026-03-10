"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  type: "SCRIM" | "WAR";
};

type House = "RED" | "GREEN" | "BLUE" | "YELLOW";
type Agent = {
  id: string;
  name: string;
  house: House;
};

export default function CreateMatchForm({ type }: Props) {
  const router = useRouter();
  const [game, setGame] = useState<"RPS" | "TTT">("RPS");
  const [series, setSeries] = useState<"QUICK" | "BO3" | "BO5">("QUICK");
  const [stakeMode, setStakeMode] = useState<"CREDITS" | "SOL">("CREDITS");
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [creatorAgentId, setCreatorAgentId] = useState("");
  const [opponentAgentId, setOpponentAgentId] = useState("");
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        const json = (await res.json()) as { agents?: Agent[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load agents");
        if (cancelled) return;

        const loadedAgents = json.agents ?? [];
        setAgents(loadedAgents);
        setCreatorAgentId((current) => current || loadedAgents[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          setErr(error instanceof Error ? error.message : "Failed to load agents");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAgents(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const creator = agents.find((agent) => agent.id === creatorAgentId) ?? null;
  const opponentOptions = useMemo(() => {
    if (!creator) return [];
    return agents.filter((agent) => {
      if (agent.id === creator.id) return false;
      return type === "SCRIM" ? agent.house === creator.house : agent.house !== creator.house;
    });
  }, [agents, creator, type]);

  useEffect(() => {
    setOpponentAgentId((current) => {
      if (current && opponentOptions.some((agent) => agent.id === current)) return current;
      return opponentOptions[0]?.id ?? "";
    });
  }, [opponentOptions]);

  async function onCreate() {
    setErr(null);
    setCreatedMatchId(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          game,
          series,
          stakeMode,
          stakeAmount,
          creatorAgentId,
          opponentAgentId: opponentAgentId || undefined,
        }),
      });

      const json = (await res.json().catch(() => null)) as { error?: string; match?: { id: string } } | null;
      if (!res.ok) {
        setErr(json?.error ?? "CREATE_FAILED");
        return;
      }

      const matchId = json?.match?.id ?? null;
      setCreatedMatchId(matchId);
      if (matchId) {
        router.push(`/match/${matchId}`);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : "CREATE_FAILED");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded border p-4 max-w-xl">
      <p className="text-xs text-gray-500">Mode: {type}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="text-sm col-span-2">
          Creator agent
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={creatorAgentId}
            onChange={(e) => setCreatorAgentId(e.target.value)}
            disabled={isLoadingAgents || agents.length === 0}
          >
            {agents.length === 0 ? <option value="">No agents available</option> : null}
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.house})
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm col-span-2">
          Opponent agent
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={opponentAgentId}
            onChange={(e) => setOpponentAgentId(e.target.value)}
            disabled={!creator || opponentOptions.length === 0}
          >
            {opponentOptions.length === 0 ? (
              <option value="">
                {creator
                  ? type === "SCRIM"
                    ? "No same-house opponents available"
                    : "No cross-house opponents available"
                  : "Select a creator first"}
              </option>
            ) : null}
            {opponentOptions.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.house})
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Game
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={game}
            onChange={(e) => setGame(e.target.value as "RPS" | "TTT")}
          >
            <option value="RPS">RPS</option>
            <option value="TTT">TTT</option>
          </select>
        </label>

        <label className="text-sm">
          Series
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={series}
            onChange={(e) => setSeries(e.target.value as "QUICK" | "BO3" | "BO5")}
          >
            <option value="QUICK">Quick (BO1)</option>
            <option value="BO3">BO3</option>
            <option value="BO5">BO5</option>
          </select>
        </label>

        <label className="text-sm">
          Stake mode
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={stakeMode}
            onChange={(e) => setStakeMode(e.target.value as "CREDITS" | "SOL")}
          >
            <option value="CREDITS">Credits</option>
            <option value="SOL">SOL (coming soon)</option>
          </select>
        </label>

        <label className="text-sm">
          Stake amount
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            type="number"
            min={0}
            value={stakeAmount}
            onChange={(e) => setStakeAmount(Number(e.target.value))}
          />
        </label>
      </div>

      <button
        className="mt-4 rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        onClick={onCreate}
        disabled={isLoadingAgents || isSubmitting || !creatorAgentId}
      >
        {isSubmitting ? "Creating..." : "Create match"}
      </button>

      {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      {createdMatchId && (
        <div className="mt-3 text-sm text-green-700">
          Match created. <Link href={`/match/${createdMatchId}`}>Open arena</Link>
        </div>
      )}
    </div>
  );
}
