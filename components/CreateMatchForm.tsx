"use client";

import { useState } from "react";

type Props = {
  type: "SCRIM" | "WAR";
};

export default function CreateMatchForm({ type }: Props) {
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(1);
  const [stakeMode, setStakeMode] = useState<"CREDITS" | "SOL">("CREDITS");
  const [entryFeeCredits, setEntryFeeCredits] = useState<number>(0);
  const [stakeLamports, setStakeLamports] = useState<number>(0);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate() {
    setErr(null);
    setResult(null);

    const res = await fetch("/api/matches", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // TEMP auth: provide any string to become a user.
        "x-address": "dev-user-a",
      },
      body: JSON.stringify({
        type,
        bestOf,
        stakeMode,
        entryFeeCredits: stakeMode === "CREDITS" ? entryFeeCredits : undefined,
        stakeLamports: stakeMode === "SOL" ? stakeLamports : undefined,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error ?? "CREATE_FAILED");
      return;
    }
    setResult(json);
  }

  return (
    <div className="rounded border p-4 max-w-xl">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Series
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={bestOf}
            onChange={(e) => setBestOf(Number(e.target.value) as 1 | 3 | 5)}
          >
            <option value={1}>Quick (BO1)</option>
            <option value={3}>BO3</option>
            <option value={5}>BO5</option>
          </select>
        </label>

        <label className="text-sm">
          Stake mode
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={stakeMode}
            onChange={(e) => setStakeMode(e.target.value as any)}
          >
            <option value="CREDITS">Credits</option>
            <option value="SOL">SOL (coming soon)</option>
          </select>
        </label>

        <label className="text-sm">
          Entry fee (credits)
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            type="number"
            value={entryFeeCredits}
            onChange={(e) => setEntryFeeCredits(Number(e.target.value))}
            disabled={stakeMode !== "CREDITS"}
          />
        </label>

        <label className="text-sm">
          Stake (lamports)
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            type="number"
            value={stakeLamports}
            onChange={(e) => setStakeLamports(Number(e.target.value))}
            disabled={stakeMode !== "SOL"}
          />
        </label>
      </div>

      <button
        className="mt-4 rounded bg-black px-3 py-2 text-white"
        onClick={onCreate}
      >
        Create match
      </button>

      {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      {result && (
        <pre className="mt-3 text-xs bg-gray-100 p-2 rounded overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
