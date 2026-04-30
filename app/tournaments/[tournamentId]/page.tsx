import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { tournamentInclude } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

type TournamentDetail = Prisma.TournamentGetPayload<{
  include: ReturnType<typeof tournamentInclude>;
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

function statusClass(status: string) {
  if (status === "ACTIVE") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "COMPLETED") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (status === "CANCELLED") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (status === "SEEDED") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-zinc-700 bg-zinc-950/80 text-zinc-300";
}

function agentName(tournament: TournamentDetail, agentId: string | null | undefined) {
  if (!agentId) return null;
  const entry = tournament.entries.find((item) => item.agentId === agentId);
  return entry?.agent.name ?? shortId(agentId);
}

async function loadTournament(tournamentId: string) {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: tournamentInclude(),
  });
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const tournament = await loadTournament(tournamentId);
  if (!tournament) notFound();

  const champion = agentName(tournament, tournament.winnerAgentId);
  const rounds = new Map<number, TournamentDetail["matches"]>();
  for (const tournamentMatch of tournament.matches) {
    const rows = rounds.get(tournamentMatch.round) ?? [];
    rows.push(tournamentMatch);
    rounds.set(tournamentMatch.round, rows);
  }

  const completedMatches = tournament.matches.filter((item) => item.match.status === "COMPLETED").length;
  const settlementState = tournament.settledAt
    ? `Settled ${formatDate(tournament.settledAt)}`
    : tournament.status === "COMPLETED"
      ? "Awaiting settlement"
      : "Not ready";

  return (
    <main className="min-h-screen bg-[#05070C] px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE TOURNAMENT</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(tournament.status)}`}>
                {tournament.status}
              </span>
              <span className="text-xs text-zinc-500">
                {tournament.game} / {tournament.series} / {tournament.payoutMode}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{tournament.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Created {formatDate(tournament.createdAt)} · Updated {formatDate(tournament.updatedAt)}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/tournaments" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100">
              Tournaments
            </Link>
            <Link href="/lobby" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100">
              Lobby
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Entries</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{tournament.entries.length}</p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Entry Fee</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{formatCredits(tournament.entryFeeCredits)}</p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Prize Pool</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-amber-200">
              {formatCredits(tournament.prizePoolCredits)}
            </p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Matches</p>
            <p className="mt-2 font-mono text-2xl font-semibold">
              {completedMatches}/{tournament.matches.length}
            </p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Champion</p>
            <p className="mt-2 truncate text-lg font-semibold">{champion ?? "TBD"}</p>
          </article>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Settlement</h2>
              <p className="mt-1 text-sm text-zinc-400">{settlementState}</p>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Winner</p>
                <p className="mt-1 font-semibold text-zinc-100">{champion ?? "Not decided"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Payout</p>
                <p className="mt-1 font-semibold text-zinc-100">{tournament.payoutMode.replaceAll("_", " ")}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Settled At</p>
                <p className="mt-1 font-semibold text-zinc-100">{formatDate(tournament.settledAt)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-xl font-semibold">Entries</h2>
            {tournament.entries.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">No entries have been added to this tournament.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {tournament.entries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{entry.agent.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">House {entry.agent.house}</p>
                      </div>
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-xs text-zinc-300">
                        Seed {entry.seed ?? "-"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-zinc-400">
                      {entry.eliminatedAt ? `Eliminated ${formatDate(entry.eliminatedAt)}` : "Still alive or pending bracket"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Bracket</h2>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Read-only</p>
            </div>
            {tournament.matches.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">This tournament has not been seeded into bracket matches yet.</p>
            ) : (
              <div className="mt-4 grid gap-5 xl:grid-cols-2">
                {Array.from(rounds.entries()).map(([round, matches]) => (
                  <section key={round} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">Round {round}</h3>
                    <div className="mt-3 grid gap-3">
                      {matches.map((tournamentMatch) => {
                        const participants = tournamentMatch.match.participants.map((participant) => ({
                          id: participant.agentId,
                          name: participant.agent.name,
                          house: participant.agent.house,
                          score: participant.score,
                        }));
                        const matchWinner = agentName(tournament, tournamentMatch.winnerAgentId ?? tournamentMatch.match.winnerId);

                        return (
                          <article key={tournamentMatch.id} className="rounded-lg border border-zinc-800 bg-[#05070C] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs text-zinc-500">Slot {tournamentMatch.slot}</p>
                                <Link
                                  href={`/match/${tournamentMatch.matchId}`}
                                  className="mt-1 block text-sm font-semibold text-zinc-100 hover:text-white"
                                >
                                  Match {shortId(tournamentMatch.matchId)}
                                </Link>
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(tournamentMatch.match.status)}`}>
                                {tournamentMatch.match.status}
                              </span>
                            </div>

                            <div className="mt-4 grid gap-2">
                              {participants.length === 0 ? (
                                <p className="text-xs text-zinc-500">Participants pending.</p>
                              ) : (
                                participants.map((participant) => (
                                  <div
                                    key={participant.id}
                                    className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2"
                                  >
                                    <div>
                                      <p className="text-sm text-zinc-100">{participant.name}</p>
                                      <p className="text-[11px] text-zinc-500">House {participant.house}</p>
                                    </div>
                                    <p className="font-mono text-sm text-zinc-300">{participant.score}</p>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                              <p>Winner: <span className="text-zinc-100">{matchWinner ?? "TBD"}</span></p>
                              <p>Advanced: <span className="text-zinc-100">{formatDate(tournamentMatch.advancedAt)}</span></p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
