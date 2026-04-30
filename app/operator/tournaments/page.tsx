import { createHash } from "node:crypto";

import type { GameType, Prisma, SeriesType } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { advanceTournamentFromMatch, createTournament, seedTournament, settleTournament } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "interhouse_operator";
const GAME_OPTIONS: GameType[] = ["RPS", "TTT", "C4", "CHESS", "CHECKERS"];
const SERIES_OPTIONS: SeriesType[] = ["QUICK", "BO3", "BO5"];

const OPERATOR_TOURNAMENT_INCLUDE = {
  entries: { include: { agent: true }, orderBy: { seed: "asc" as const } },
  matches: {
    include: { match: { include: { participants: { include: { agent: true } } } } },
    orderBy: [{ round: "asc" as const }, { slot: "asc" as const }],
  },
} satisfies Prisma.TournamentInclude;

type OperatorTournament = Prisma.TournamentGetPayload<{
  include: typeof OPERATOR_TOURNAMENT_INCLUDE;
}>;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function operatorCookieValue() {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return null;
  return createHash("sha256").update(`interhouse-operator:${secret}`).digest("hex");
}

async function isOperatorUnlocked() {
  const expected = operatorCookieValue();
  if (!expected) return false;
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === expected;
}

function redirectWith(kind: "notice" | "error", message: string): never {
  redirect(`/operator/tournaments?${kind}=${encodeURIComponent(message)}`);
}

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

function isPowerOfTwo(value: number) {
  return value >= 2 && (value & (value - 1)) === 0;
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...`;
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseAgentIds(raw: string) {
  return [...new Set(raw.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean))];
}

function parseGame(value: string): GameType {
  if (GAME_OPTIONS.includes(value as GameType)) return value as GameType;
  return "RPS";
}

function parseSeries(value: string): SeriesType {
  if (SERIES_OPTIONS.includes(value as SeriesType)) return value as SeriesType;
  return "BO3";
}

async function unlockOperatorAction(formData: FormData) {
  "use server";

  const expected = process.env.INTERNAL_SECRET;
  const provided = formValue(formData, "internalSecret");
  if (!expected || provided !== expected) redirectWith("error", "Invalid operator secret");

  const value = operatorCookieValue();
  if (!value) redirectWith("error", "INTERNAL_SECRET is not configured");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/operator",
    maxAge: 60 * 60 * 8,
  });

  redirectWith("notice", "Operator controls unlocked");
}

async function lockOperatorAction() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirectWith("notice", "Operator controls locked");
}

async function createTournamentAction(formData: FormData) {
  "use server";

  if (!(await isOperatorUnlocked())) redirectWith("error", "Operator unlock required");

  const name = formValue(formData, "name");
  const entryFeeCredits = Number(formValue(formData, "entryFeeCredits") || 0);
  const agentIds = parseAgentIds(formValue(formData, "agentIds"));

  if (!name) redirectWith("error", "Tournament name is required");
  if (!Number.isInteger(entryFeeCredits) || entryFeeCredits < 0) redirectWith("error", "Entry fee must be a non-negative integer");

  try {
    const tournament = await createTournament({
      name,
      game: parseGame(formValue(formData, "game")),
      series: parseSeries(formValue(formData, "series")),
      entryFeeCredits,
      agentIds,
    });
    revalidatePath("/operator/tournaments");
    revalidatePath("/tournaments");
    redirectWith("notice", `Created ${tournament.name}`);
  } catch (error) {
    redirectWith("error", error instanceof Error ? error.message : "Tournament creation failed");
  }
}

async function seedTournamentAction(formData: FormData) {
  "use server";

  if (!(await isOperatorUnlocked())) redirectWith("error", "Operator unlock required");
  const tournamentId = formValue(formData, "tournamentId");

  try {
    await seedTournament(tournamentId);
    revalidatePath("/operator/tournaments");
    revalidatePath("/tournaments");
    redirectWith("notice", "Tournament seeded");
  } catch (error) {
    redirectWith("error", error instanceof Error ? error.message : "Tournament seed failed");
  }
}

async function advanceMatchAction(formData: FormData) {
  "use server";

  if (!(await isOperatorUnlocked())) redirectWith("error", "Operator unlock required");
  const tournamentId = formValue(formData, "tournamentId");
  const matchId = formValue(formData, "matchId");

  try {
    await advanceTournamentFromMatch(matchId, tournamentId);
    revalidatePath("/operator/tournaments");
    revalidatePath("/tournaments");
    redirectWith("notice", "Tournament match advanced");
  } catch (error) {
    redirectWith("error", error instanceof Error ? error.message : "Tournament advance failed");
  }
}

async function advanceReadyMatchesAction(formData: FormData) {
  "use server";

  if (!(await isOperatorUnlocked())) redirectWith("error", "Operator unlock required");
  const tournamentId = formValue(formData, "tournamentId");

  try {
    const ready = await prisma.tournamentMatch.findMany({
      where: {
        tournamentId,
        advancedAt: null,
        match: { status: "COMPLETED", winnerId: { not: null } },
      },
      orderBy: [{ round: "asc" }, { slot: "asc" }],
    });

    for (const item of ready) {
      await advanceTournamentFromMatch(item.matchId, tournamentId);
    }

    revalidatePath("/operator/tournaments");
    revalidatePath("/tournaments");
    redirectWith("notice", `Advanced ${ready.length} ready match${ready.length === 1 ? "" : "es"}`);
  } catch (error) {
    redirectWith("error", error instanceof Error ? error.message : "Bulk advance failed");
  }
}

async function settleTournamentAction(formData: FormData) {
  "use server";

  if (!(await isOperatorUnlocked())) redirectWith("error", "Operator unlock required");
  const tournamentId = formValue(formData, "tournamentId");

  try {
    await settleTournament(tournamentId);
    revalidatePath("/operator/tournaments");
    revalidatePath("/tournaments");
    redirectWith("notice", "Tournament settled");
  } catch (error) {
    redirectWith("error", error instanceof Error ? error.message : "Tournament settlement failed");
  }
}

async function loadOperatorData() {
  const [tournaments, agents] = await Promise.all([
    prisma.tournament.findMany({
      include: OPERATOR_TOURNAMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.agentProfile.findMany({
      select: { id: true, name: true, house: true, credits: true, lockedCredits: true },
      orderBy: [{ wins: "desc" }, { createdAt: "desc" }],
      take: 24,
    }),
  ]);
  return { tournaments, agents };
}

function Notice({ kind, message }: { kind: "notice" | "error"; message?: string }) {
  if (!message) return null;
  const classes = kind === "notice" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-red-500/30 bg-red-500/10 text-red-100";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>{message}</div>;
}

function TournamentActions({ tournament }: { tournament: OperatorTournament }) {
  const canSeed =
    (tournament.status === "DRAFT" || tournament.status === "SEEDED") &&
    tournament.matches.length === 0 &&
    isPowerOfTwo(tournament.entries.length);
  const readyMatches = tournament.matches.filter((item) => item.advancedAt === null && item.match.status === "COMPLETED" && item.match.winnerId);
  const canSettle = tournament.status === "COMPLETED" && Boolean(tournament.winnerAgentId) && !tournament.settledAt;

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-black/20 p-4">
      <div className="flex flex-wrap gap-3">
        <form action={seedTournamentAction}>
          <input type="hidden" name="tournamentId" value={tournament.id} />
          <button
            disabled={!canSeed}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600"
          >
            Seed bracket
          </button>
        </form>

        <form action={advanceReadyMatchesAction}>
          <input type="hidden" name="tournamentId" value={tournament.id} />
          <button
            disabled={readyMatches.length === 0}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600"
          >
            Advance ready ({readyMatches.length})
          </button>
        </form>

        <form action={settleTournamentAction}>
          <input type="hidden" name="tournamentId" value={tournament.id} />
          <button
            disabled={!canSettle}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600"
          >
            Settle prize pool
          </button>
        </form>
      </div>

      {!canSeed && tournament.matches.length === 0 ? (
        <p className="text-xs text-zinc-500">Seed requires a power-of-two field with at least 2 entries.</p>
      ) : null}
      {tournament.settledAt ? <p className="text-xs text-emerald-300">Settled {formatDate(tournament.settledAt)}</p> : null}

      {readyMatches.length > 0 ? (
        <div className="grid gap-2">
          {readyMatches.map((item) => (
            <form key={item.id} action={advanceMatchAction} className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <input type="hidden" name="matchId" value={item.matchId} />
              <span className="text-xs text-zinc-400">
                Round {item.round} / Slot {item.slot} / Winner {shortId(item.match.winnerId ?? "")}
              </span>
              <button className="rounded-md border border-sky-500/40 px-3 py-1.5 text-xs font-medium text-sky-100">
                Advance this match
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default async function OperatorTournamentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const notice = typeof params.notice === "string" ? params.notice : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const unlocked = await isOperatorUnlocked();

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-[#05070C] px-6 py-10 text-zinc-100">
        <div className="mx-auto w-full max-w-xl space-y-6">
          <div className="flex gap-3">
            <Link href="/tournaments" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-100">Public tournaments</Link>
            <Link href="/lobby" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-100">Lobby</Link>
          </div>
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE OPERATOR</p>
            <h1 className="mt-2 text-3xl font-semibold">Tournament Controls</h1>
            <p className="mt-3 text-sm text-zinc-400">Enter the internal operator secret to unlock create, seed, advance, and settle controls. The secret stays server-side and is exchanged for an httpOnly operator cookie.</p>
            <Notice kind="notice" message={notice} />
            <Notice kind="error" message={error} />
            <form action={unlockOperatorAction} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-zinc-300" htmlFor="internalSecret">Internal secret</label>
              <input id="internalSecret" name="internalSecret" type="password" required className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400" />
              <button className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:border-amber-300/70">Unlock operator panel</button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const { tournaments, agents } = await loadOperatorData();

  return (
    <main className="min-h-screen bg-[#05070C] px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-zinc-400">INTERHOUSE OPERATOR</p>
            <h1 className="mt-2 text-3xl font-semibold">Tournament Controls</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">Unlinked admin surface for creating, seeding, advancing, and settling prize-pool brackets.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tournaments" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-100">Public tournaments</Link>
            <Link href="/lobby" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-100">Lobby</Link>
            <form action={lockOperatorAction}>
              <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-100">Lock</button>
            </form>
          </div>
        </header>

        <Notice kind="notice" message={notice} />
        <Notice kind="error" message={error} />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form action={createTournamentAction} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-xl font-semibold">Create tournament</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Name</span>
                <input name="name" required placeholder="Friday Night Zodiac Cup" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400" />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Game</span>
                <select name="game" defaultValue="RPS" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400">
                  {GAME_OPTIONS.map((game) => <option key={game} value={game}>{game}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Series</span>
                <select name="series" defaultValue="BO3" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400">
                  {SERIES_OPTIONS.map((series) => <option key={series} value={series}>{series}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Entry fee credits</span>
                <input name="entryFeeCredits" type="number" min="0" step="1" defaultValue="0" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400" />
              </label>
              <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>Agent IDs, in seed order</span>
                <textarea name="agentIds" rows={6} placeholder="agent_id_1&#10;agent_id_2&#10;agent_id_3&#10;agent_id_4" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-amber-400" />
              </label>
            </div>
            <button className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:border-amber-300/70">Create draft tournament</button>
          </form>

          <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold">Recent agents</h2>
            <p className="mt-1 text-xs text-zinc-500">Copy IDs into the create form. Seed order follows input order.</p>
            <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-1">
              {agents.map((agent) => (
                <div key={agent.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                  <p className="text-sm font-semibold text-zinc-100">{agent.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{agent.house} / {agent.credits} CR / locked {agent.lockedCredits}</p>
                  <code className="mt-2 block break-all text-[11px] text-amber-200">{agent.id}</code>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Existing tournaments</h2>
          {tournaments.map((tournament) => {
            const completed = tournament.matches.filter((item) => item.match.status === "COMPLETED").length;
            return (
              <article key={tournament.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-zinc-300">{tournament.status}</span>
                      <span>{tournament.game} / {tournament.series}</span>
                      <span>{shortId(tournament.id)}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-zinc-100">{tournament.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {tournament.entries.length} entries / {completed}-{tournament.matches.length} matches completed / pool {tournament.prizePoolCredits} CR
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Created {formatDate(tournament.createdAt)}</p>
                  </div>
                  <Link href={`/tournaments/${tournament.id}`} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-100">View public detail</Link>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Entries</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tournament.entries.length > 0 ? tournament.entries.map((entry) => (
                        <span key={entry.id} className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-200">
                          {entry.seed ?? "?"}. {entry.agent.name}
                        </span>
                      )) : <span className="text-sm text-zinc-500">No entries yet.</span>}
                    </div>
                  </div>
                  <TournamentActions tournament={tournament} />
                </div>
              </article>
            );
          })}
          {tournaments.length === 0 ? <p className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-400">No tournaments yet.</p> : null}
        </section>
      </div>
    </main>
  );
}
