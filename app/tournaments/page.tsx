import type { Prisma } from "@prisma/client";
import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TOURNAMENT_LIST_INCLUDE = {
  entries: { include: { agent: true }, orderBy: { seed: "asc" as const } },
  matches: { include: { match: true }, orderBy: [{ round: "asc" as const }, { slot: "asc" as const }] },
} satisfies Prisma.TournamentInclude;

type TournamentListItem = Prisma.TournamentGetPayload<{
  include: typeof TOURNAMENT_LIST_INCLUDE;
}>;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCredits(value: number) {
  return `${value.toLocaleString()} CR`;
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...`;
}

function getChampionName(tournament: TournamentListItem) {
  if (!tournament.winnerAgentId) return null;
  const winnerEntry = tournament.entries.find((entry) => entry.agentId === tournament.winnerAgentId);
  return winnerEntry?.agent.name ?? shortId(tournament.winnerAgentId);
}

function statusClass(status: TournamentListItem["status"]) {
  if (status === "ACTIVE") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "COMPLETED") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (status === "CANCELLED") return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-zinc-700 bg-zinc-950/80 text-zinc-300";
}

async function loadTournaments() {
  return prisma.tournament.findMany({
    include: TOURNAMENT_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export default async function TournamentsPage() {
  let tournaments: TournamentListItem[] = [];
  let error: string | null = null;

  try {
    tournaments = await loadTournaments();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Failed to load tournaments";
  }

  return (
    <main className="min-h-screen bg-[#05070C] px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE TOURNAMENTS</p>
            <h1 className="mt-2 text-3xl font-semibold">Prize-Pool Tournaments</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Read-only bracket history for recent InterHouse prize-pool tournaments.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/lobby" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100">
              Lobby
            </Link>
            <Link href="/" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100">
              Home
            </Link>
          </div>
        </header>

        {error ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <p className="text-sm font-semibold text-red-200">Unable to load tournaments.</p>
            <p className="mt-2 text-sm text-red-100/80">{error}</p>
          </section>
        ) : null}

        {!error && tournaments.length === 0 ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">No public brackets yet</p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-100">Prize-pool brackets are ready.</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Tournament infrastructure is live, but there are no public tournaments to display yet. Once brackets are
              created, they will appear here with entries, match progress, champions, and settlement state.
            </p>
          </section>
        ) : null}

        {tournaments.length > 0 ? (
          <section className="grid gap-4">
            {tournaments.map((tournament) => {
              const champion = getChampionName(tournament);
              const completedMatches = tournament.matches.filter((item) => item.match.status === "COMPLETED").length;

              return (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.id}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-zinc-600"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(tournament.status)}`}>
                          {tournament.status}
                        </span>
                        <span className="text-xs text-zinc-500">{tournament.game} / {tournament.series}</span>
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-zinc-100">{tournament.name}</h2>
                      <p className="mt-1 text-xs text-zinc-500">Created {formatDate(tournament.createdAt)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 md:min-w-[520px]">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Entries</p>
                        <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">{tournament.entries.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Prize Pool</p>
                        <p className="mt-1 font-mono text-lg font-semibold text-amber-200">
                          {formatCredits(tournament.prizePoolCredits)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Matches</p>
                        <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">
                          {completedMatches}/{tournament.matches.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Winner</p>
                        <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{champion ?? "TBD"}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        ) : null}
      </div>
    </main>
  );
}
