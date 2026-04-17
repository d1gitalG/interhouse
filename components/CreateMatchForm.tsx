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
  credits: number;
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
  const isSolStubSelected = stakeMode === "SOL";
  const walletStubSteps = isSolStubSelected
    ? [
        "1. Connect creator wallet (stub)",
        "2. Approve match escrow funding (stub)",
        "3. Release escrow to winner on completion (stub)",
      ]
    : [
        "Wallet remains disconnected in credits mode.",
        "Escrow account creation stays hidden until SOL mode is live.",
        "Credits flow continues to settle off-chain in the current app.",
      ];
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
      if (isSolStubSelected) {
        setErr("SOL escrow is still a UI stub. Switch back to credits to create a live match.");
        return;
      }

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
    <div className="rounded border-none p-0 max-w-none">
      <div className="mt-2 grid grid-cols-2 gap-4">
        <label className="text-sm col-span-2">
          Creator agent
          <select
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
            value={creatorAgentId}
            onChange={(e) => setCreatorAgentId(e.target.value)}
            disabled={isLoadingAgents || agents.length === 0}
          >
            {agents.length === 0 ? <option value="">No agents available</option> : null}
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.house}) — {agent.credits.toLocaleString()} CR
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm col-span-2">
          Opponent agent
          <select
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
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
                {agent.name} ({agent.house}) — {agent.credits.toLocaleString()} CR
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Game
          <select
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
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
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
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
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
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
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-500"
            type="number"
            min={0}
            value={stakeAmount}
            onChange={(e) => setStakeAmount(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm text-sky-50">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-lg">
            <p className="text-xs font-semibold tracking-[0.3em] text-sky-200/80">SOLANA PREVIEW</p>
            <p className="mt-2 font-medium">Wallet connection and escrow stub</p>
            <p className="mt-1 text-sky-100/80">
              Phantom/Backpack connection, signing, and escrow account creation are demo-only in this form.
            </p>
          </div>
          <div className="rounded-xl border border-sky-200/20 bg-[#05070C]/40 p-4 md:min-w-64">
            <p className="text-sm font-medium text-sky-50">Wallet status</p>
            <p className="mt-1 text-sm text-sky-100/70">Disconnected</p>
            <button
              type="button"
              disabled
              className="mt-3 w-full rounded-lg border border-sky-200/20 px-4 py-2 text-sm font-medium text-sky-50 opacity-70"
            >
              Connect Wallet (stub)
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-sky-200/15 bg-[#05070C]/30 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-sky-200/70">Creator wallet</p>
            <p className="mt-2 font-medium text-sky-50">{creator ? `${creator.name} wallet pending` : "Awaiting agent"}</p>
            <p className="mt-1 text-xs text-sky-100/65">No address attached in stub mode.</p>
          </div>
          <div className="rounded-xl border border-sky-200/15 bg-[#05070C]/30 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-sky-200/70">Escrow account</p>
            <p className="mt-2 font-medium text-sky-50">Not initialized</p>
            <p className="mt-1 text-xs text-sky-100/65">Program-derived address and funding step are placeholders.</p>
          </div>
          <div className="rounded-xl border border-sky-200/15 bg-[#05070C]/30 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-sky-200/70">Settlement</p>
            <p className="mt-2 font-medium text-sky-50">Stubbed release</p>
            <p className="mt-1 text-xs text-sky-100/65">Winner payout UI only. No on-chain transfer occurs.</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-sky-200/15 bg-[#05070C]/30 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-200/70">Preview flow</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-sky-100/75">
            {walletStubSteps.map((step) => (
              <span key={step} className="rounded-full border border-sky-200/15 px-2 py-1">
                {step}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-sky-100/70">
            {isSolStubSelected
              ? "SOL mode is preview-only here and will not create a playable escrow-backed match."
              : "Credits mode remains the only live path for playable matches while the wallet stub stays visible."}
          </p>
        </div>
      </div>

      <button
        className="mt-6 w-full rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
        onClick={onCreate}
        disabled={isLoadingAgents || isSubmitting || !creatorAgentId || isSolStubSelected}
      >
        {isSubmitting ? "Creating..." : isSolStubSelected ? "SOL Stub Only" : "Create Direct Match"}
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
