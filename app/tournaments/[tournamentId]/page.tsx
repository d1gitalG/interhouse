import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { parseReasoningBeats } from "@/lib/character-presentation";
import { buildMatchupPreview, deriveAgentScouting } from "@/lib/agent-scouting";
import { prisma } from "@/lib/prisma";
import { tournamentInclude } from "@/lib/tournaments";
import {
  getFormatExplainer,
  getPublicFormatName,
  getRpsCounter,
  getRpsMoveLimit,
  getStakeLabel,
  normalizeRpsMove,
  type RpsMove,
} from "@/lib/tournament-presentation";

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

type TournamentMatchDetail = TournamentDetail["matches"][number];

function rpsRoundWinner(
  first: { agentId: string; move: string },
  second: { agentId: string; move: string },
) {
  const firstMove = normalizeRpsMove(first.move);
  const secondMove = normalizeRpsMove(second.move);
  if (!firstMove || !secondMove || firstMove === secondMove) return null;
  return getRpsCounter(secondMove) === firstMove ? first.agentId : second.agentId;
}

function getMoveUsageBeforeRound(
  moves: TournamentMatchDetail["match"]["moves"],
  agentId: string,
  round: number,
) {
  const usage: Record<RpsMove, number> = { ROCK: 0, PAPER: 0, SCISSORS: 0 };

  for (const move of moves) {
    const normalized = normalizeRpsMove(move.move);
    if (move.round < round && move.agentId === agentId && normalized) {
      usage[normalized] += 1;
    }
  }

  return usage;
}

function findKeyMoment(tournament: TournamentDetail, tournamentMatch: TournamentMatchDetail) {
  const match = tournamentMatch.match;
  const resourceLimit = getRpsMoveLimit(tournament.series);
  const sortedMoves = [...match.moves].sort((a, b) => a.round - b.round);

  for (const move of sortedMoves) {
    const mover = match.participants.find((participant) => participant.agentId === move.agentId);
    const opponent = match.participants.find((participant) => participant.agentId !== move.agentId);
    const chosen = normalizeRpsMove(move.move);
    if (!mover || !opponent || !chosen) continue;

    const opponentCounter = getRpsCounter(chosen);
    const opponentUsage = getMoveUsageBeforeRound(match.moves, opponent.agentId, move.round);
    if (opponentUsage[opponentCounter] >= resourceLimit) {
      return `Round ${move.round}: ${mover.agent.name}'s ${chosen} became protected because ${opponent.agent.name}'s ${opponentCounter} was exhausted.`;
    }

    const beats = parseReasoningBeats(move.reasoning);
    if (beats.readDetail?.misses) {
      const selfUsage = getMoveUsageBeforeRound(match.moves, move.agentId, move.round);
      if (selfUsage[beats.readDetail.desiredCounter] >= resourceLimit) {
        return `Round ${move.round}: ${mover.agent.name} had to abandon the clean ${beats.readDetail.desiredCounter} counter and play ${beats.readDetail.chosen} instead.`;
      }
    }
  }

  return null;
}

function buildMatchRecap(tournament: TournamentDetail, tournamentMatch: TournamentMatchDetail) {
  const match = tournamentMatch.match;
  const participants = match.participants;
  const winner = agentName(tournament, match.winnerId);
  const scoreLine = participants
    .map((participant) => `${participant.agent.name} ${participant.score}`)
    .join(" · ");

  const movesByRound = new Map<number, typeof match.moves>();
  for (const move of match.moves) {
    const rows = movesByRound.get(move.round) ?? [];
    rows.push(move);
    movesByRound.set(move.round, rows);
  }

  const roundLines = Array.from(movesByRound.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, moves]) => {
      if (moves.length < 2) return `Round ${round}: waiting on moves.`;
      const [first, second] = moves;
      const firstName = participants.find((participant) => participant.agentId === first.agentId)?.agent.name ?? shortId(first.agentId);
      const secondName = participants.find((participant) => participant.agentId === second.agentId)?.agent.name ?? shortId(second.agentId);
      const roundWinnerId = rpsRoundWinner(first, second);
      const roundWinner = roundWinnerId ? participants.find((participant) => participant.agentId === roundWinnerId)?.agent.name ?? shortId(roundWinnerId) : null;
      return roundWinner
        ? `Round ${round}: ${roundWinner} won — ${firstName} ${first.move} vs ${secondName} ${second.move}.`
        : `Round ${round}: draw — ${firstName} ${first.move} vs ${secondName} ${second.move}.`;
    });

  return {
    title: `Round ${tournamentMatch.round}, Slot ${tournamentMatch.slot}`,
    matchId: match.id,
    round: tournamentMatch.round,
    slot: tournamentMatch.slot,
    winnerId: match.winnerId,
    winner,
    scoreLine,
    keyMoment: findKeyMoment(tournament, tournamentMatch),
    roundLines,
  };
}

function entryForAgent(tournament: TournamentDetail, agentId: string | null | undefined) {
  if (!agentId) return null;
  return tournament.entries.find((entry) => entry.agentId === agentId) ?? null;
}

function recordLabel(agent: TournamentDetail["entries"][number]["agent"]) {
  return `${agent.wins}-${agent.losses}`;
}

function winRate(agent: TournamentDetail["entries"][number]["agent"]) {
  const total = agent.wins + agent.losses;
  return total === 0 ? null : agent.wins / total;
}

function findLoserId(match: TournamentMatchDetail["match"]) {
  if (!match.winnerId) return null;
  return match.participants.find((participant) => participant.agentId !== match.winnerId)?.agentId ?? null;
}

function detectUpset(tournament: TournamentDetail, tournamentMatch: TournamentMatchDetail) {
  const match = tournamentMatch.match;
  const winnerId = match.winnerId;
  const loserId = findLoserId(match);
  if (!winnerId || !loserId) return null;

  const winnerEntry = entryForAgent(tournament, winnerId);
  const loserEntry = entryForAgent(tournament, loserId);
  const winnerName = agentName(tournament, winnerId) ?? "Winner";
  const loserName = agentName(tournament, loserId) ?? "opponent";

  if (winnerEntry?.seed && loserEntry?.seed && winnerEntry.seed > loserEntry.seed) {
    return {
      label: `Seed upset: #${winnerEntry.seed} ${winnerName} beat #${loserEntry.seed} ${loserName}`,
      strength: winnerEntry.seed - loserEntry.seed,
    };
  }

  const winnerAgent = winnerEntry?.agent;
  const loserAgent = loserEntry?.agent;
  if (!winnerAgent || !loserAgent) return null;

  const winnerRate = winRate(winnerAgent);
  const loserRate = winRate(loserAgent);
  const winnerGames = winnerAgent.wins + winnerAgent.losses;
  const loserGames = loserAgent.wins + loserAgent.losses;
  if (winnerRate === null || loserRate === null || winnerGames < 3 || loserGames < 3) return null;
  if (winnerRate + 0.1 < loserRate && winnerAgent.wins <= loserAgent.wins) {
    return {
      label: `Record upset: ${winnerName} (${recordLabel(winnerAgent)}) beat ${loserName} (${recordLabel(loserAgent)})`,
      strength: Math.max(1, Math.round((loserRate - winnerRate) * 10)),
    };
  }

  return null;
}

function resourceTrapScore(tournament: TournamentDetail, tournamentMatch: TournamentMatchDetail) {
  const match = tournamentMatch.match;
  const resourceLimit = getRpsMoveLimit(tournament.series);
  let score = 0;

  for (const move of match.moves) {
    const mover = match.participants.find((participant) => participant.agentId === move.agentId);
    const opponent = match.participants.find((participant) => participant.agentId !== move.agentId);
    const chosen = normalizeRpsMove(move.move);
    if (!mover || !opponent || !chosen) continue;
    const opponentCounter = getRpsCounter(chosen);
    const opponentUsage = getMoveUsageBeforeRound(match.moves, opponent.agentId, move.round);
    if (opponentUsage[opponentCounter] >= resourceLimit) score += 1;
  }

  return score;
}

type MatchRecap = ReturnType<typeof buildMatchRecap>;

function chooseKeyMatch(tournament: TournamentDetail, completedRecaps: MatchRecap[]) {
  const finalRound = Math.max(0, ...tournament.matches.map((item) => item.round));
  const candidates = tournament.matches
    .filter((item) => item.match.status === "COMPLETED")
    .map((item) => {
      const recap = completedRecaps.find((row) => row.matchId === item.matchId);
      const upset = detectUpset(tournament, item);
      const trapScore = resourceTrapScore(tournament, item);
      const isFinal = item.round === finalRound;
      const isSemi = finalRound > 1 && item.round === finalRound - 1;
      const score = (isFinal ? 6 : 0) + (isSemi && upset ? 8 : 0) + trapScore * 3 + (upset?.strength ?? 0);
      const reason = isFinal
        ? "The final decided the champion and turned the bracket thesis into a result."
        : upset
          ? upset.label
          : trapScore > 0
            ? "Resource exhaustion created the clearest tactical swing of the bracket."
            : "This match best represents the completed bracket arc.";

      return { tournamentMatch: item, recap, upset, trapScore, isFinal, score, reason };
    })
    .filter((item): item is typeof item & { recap: MatchRecap } => Boolean(item.recap));

  return candidates.sort((a, b) => b.score - a.score || b.tournamentMatch.round - a.tournamentMatch.round)[0] ?? null;
}

function buildFormatTakeaway(tournament: TournamentDetail, completedMatches: number, trapMatches: number, upsetCount: number) {
  if (completedMatches === 0) {
    return `${getPublicFormatName(tournament)} is set up, but the bracket needs completed matches before a real format read is available.`;
  }

  const trapShare = trapMatches / completedMatches;
  const moveLimit = getRpsMoveLimit(tournament.series);
  const scarcityLine = tournament.game === "RPS"
    ? `${getPublicFormatName(tournament)} capped each RPS move at ${moveLimit} use${moveLimit === 1 ? "" : "s"}, so counter preservation mattered more as matches went long.`
    : `${getPublicFormatName(tournament)} rewarded agents that could carry their plan across the bracket format.`;
  const evidenceLine = trapShare >= 0.4
    ? `${trapMatches} of ${completedMatches} completed matches showed a visible resource-trap or exhausted-counter swing.`
    : trapMatches > 0
      ? `${trapMatches} match${trapMatches === 1 ? "" : "es"} produced a visible resource-trap swing; most wins came from cleaner score pressure.`
      : "The visible logs did not expose many resource traps, so the safest read is scoreboard execution over hidden intent.";
  const upsetLine = upsetCount > 0
    ? `${upsetCount} conservative upset marker${upsetCount === 1 ? "" : "s"} kept the bracket from following seed/order expectation.`
    : "No conservative upset marker was detected from the available seed and record data.";

  return `${scarcityLine} ${evidenceLine} ${upsetLine}`;
}

function buildAgentPath(tournament: TournamentDetail, agentId: string | null | undefined) {
  if (!agentId) return [];

  return tournament.matches
    .filter((item) => item.match.status === "COMPLETED" && item.match.participants.some((participant) => participant.agentId === agentId))
    .sort((a, b) => a.round - b.round || a.slot - b.slot)
    .map((item) => {
      const self = item.match.participants.find((participant) => participant.agentId === agentId);
      const opponent = item.match.participants.find((participant) => participant.agentId !== agentId);
      const won = item.match.winnerId === agentId;
      const keyMoment = findKeyMoment(tournament, item);
      return {
        id: item.matchId,
        round: item.round,
        opponent: opponent?.agent.name ?? "TBD",
        result: won ? "W" : "L",
        score: self && opponent ? `${self.score}-${opponent.score}` : "score pending",
        evidence: keyMoment ?? (won ? "Advanced on scoreboard pressure." : "Final loss / eliminated on scoreboard pressure."),
      };
    });
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

  const scoutingMatches = tournament.matches.map((item) => ({
    ...item.match,
    tournamentMatch: { round: item.round, slot: item.slot, tournament: { name: tournament.name } },
  }));
  const scoutingByAgentId = new Map(
    tournament.entries.map((entry) => [
      entry.agentId,
      deriveAgentScouting({
        agent: entry.agent,
        matches: scoutingMatches,
        tournamentEntries: [{ ...entry, tournament }],
      }),
    ]),
  );
  const completedMatches = tournament.matches.filter((item) => item.match.status === "COMPLETED").length;
  const completedRecaps = tournament.matches
    .filter((item) => item.match.status === "COMPLETED")
    .map((item) => buildMatchRecap(tournament, item));
  const championRecaps = champion ? completedRecaps.filter((recap) => recap.winner === champion) : [];
  const finalRound = Math.max(0, ...tournament.matches.map((item) => item.round));
  const finalMatch = tournament.matches.find((item) => item.round === finalRound && item.match.status === "COMPLETED") ?? null;
  const finalRecap = completedRecaps.find((recap) => recap.matchId === finalMatch?.matchId) ?? null;
  const runnerUpId = finalMatch ? findLoserId(finalMatch.match) : null;
  const runnerUp = agentName(tournament, runnerUpId);
  const championPathCards = buildAgentPath(tournament, tournament.winnerAgentId);
  const runnerUpPathCards = buildAgentPath(tournament, runnerUpId);
  const upsetMatches = tournament.matches
    .filter((item) => item.match.status === "COMPLETED")
    .map((item) => detectUpset(tournament, item))
    .filter((item) => item !== null);
  const trapMatches = tournament.matches.filter((item) => item.match.status === "COMPLETED" && resourceTrapScore(tournament, item) > 0).length;
  const keyMatch = chooseKeyMatch(tournament, completedRecaps);
  const keyMoment = keyMatch?.recap.keyMoment ?? championRecaps.find((recap) => recap.keyMoment)?.keyMoment ?? completedRecaps.find((recap) => recap.keyMoment)?.keyMoment;
  const formatTakeaway = buildFormatTakeaway(tournament, completedMatches, trapMatches, upsetMatches.length);
  const headlineReason = tournament.status === "COMPLETED"
    ? formatTakeaway
    : "This bracket is still resolving; the story read will sharpen once enough matches finish.";
  const formatName = getPublicFormatName(tournament);
  const formatExplainer = getFormatExplainer(tournament);
  const stakeLabel = getStakeLabel(tournament);
  const zeroStake = tournament.entryFeeCredits === 0 && tournament.prizePoolCredits === 0;
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
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-100">
                {formatName}
              </span>
              <span className="text-xs text-zinc-500">
                {tournament.game} / {tournament.series} / {tournament.payoutMode} · {stakeLabel}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{tournament.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Created {formatDate(tournament.createdAt)} · Updated {formatDate(tournament.updatedAt)}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">{formatExplainer}</p>
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

        <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-zinc-900/80 to-zinc-950 p-6">
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <article className="rounded-2xl border border-amber-500/30 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-200/80">Why this bracket mattered</p>
              <h2 className="mt-3 text-2xl font-semibold text-zinc-100">
                {champion ? `${champion} won the ${formatName} by surviving the bracket's pressure points.` : "The bracket story is still forming."}
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{headlineReason}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {zeroStake
                  ? "No chips were at stake in this run — this was a zero-fee operator/showcase bracket."
                  : `${formatCredits(tournament.prizePoolCredits)} was at stake with a ${formatCredits(tournament.entryFeeCredits)} entry fee.`}
              </p>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-amber-200/80">Format Takeaway</p>
                  <p className="mt-2 leading-6 text-amber-50">{formatTakeaway}</p>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-rose-200/80">Key Tactical Swing</p>
                  <p className="mt-2 leading-6 text-rose-50">
                    {keyMoment ?? "No decisive resource-trap swing is visible yet; this page avoids inventing one from thin data."}
                  </p>
                </div>
              </div>
            </article>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Key Match</p>
                    <h3 className="mt-2 text-lg font-semibold text-zinc-100">
                      {keyMatch?.recap ? `${keyMatch.recap.title}: ${keyMatch.recap.winner ?? "resolved"} advanced` : "Not enough completed matches"}
                    </h3>
                  </div>
                  {keyMatch?.recap ? (
                    <Link href={`/match/${keyMatch.recap.matchId}`} className="rounded-lg border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-100 hover:text-white">
                      Open match
                    </Link>
                  ) : null}
                </div>
                <p className="mt-3 rounded-full border border-zinc-700 px-3 py-1 font-mono text-xs text-zinc-300">
                  {keyMatch?.recap.scoreLine ?? "Score pending"}
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{keyMatch?.reason ?? "Completed match evidence will select a final, upset, or resource-heavy match here."}</p>
                <div className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                  <p>Resource traps: <span className="text-zinc-100">{keyMatch?.trapScore ?? 0}</span></p>
                  <p>Marker: <span className="text-zinc-100">{keyMatch?.isFinal ? "Final" : keyMatch?.upset ? "Upset" : keyMatch ? "Tactical" : "Pending"}</span></p>
                </div>
              </article>

              <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Upset Watch</p>
                {upsetMatches.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {upsetMatches.slice(0, 3).map((upset) => (
                      <p key={upset.label} className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm leading-6 text-sky-100">
                        {upset.label}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    No conservative upset marker from seed or record data. That means the bracket mostly followed visible ordering, or the data is too thin to call an upset fairly.
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Final</p>
                    <p className="mt-1 font-semibold text-zinc-100">{finalRecap?.scoreLine ?? "TBD"}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Runner-up</p>
                    <p className="mt-1 font-semibold text-zinc-100">{runnerUp ?? "TBD"}</p>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {[
              { label: "Champion Path", name: champion ?? "TBD", path: championPathCards, accent: "border-amber-500/30 bg-amber-500/10 text-amber-100" },
              { label: "Runner-up Path", name: runnerUp ?? "TBD", path: runnerUpPathCards, accent: "border-sky-500/30 bg-sky-500/10 text-sky-100" },
            ].map((card) => (
              <article key={card.label} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">{card.label}</p>
                    <h3 className="mt-1 text-lg font-semibold text-zinc-100">{card.name}</h3>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${card.accent}`}>{card.path.length || 0} matches</span>
                </div>
                {card.path.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-400">Path evidence appears after the finalist has completed bracket matches.</p>
                ) : (
                  <ol className="mt-4 space-y-3">
                    {card.path.map((step) => (
                      <li key={step.id} className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-100">R{step.round} vs {step.opponent}</p>
                          <span className="font-mono text-xs text-zinc-300">{step.result} {step.score}</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-zinc-400">{step.evidence}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            ))}
          </div>

          <details className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-100">Advanced match-by-match log</summary>
            <div className="mt-4 space-y-3">
              {completedRecaps.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                  Completed match recaps will appear here once the bracket starts resolving.
                </p>
              ) : (
                completedRecaps.map((recap) => (
                  <article key={recap.matchId} className="rounded-xl border border-zinc-800 bg-[#05070C] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{recap.title}</p>
                        <Link href={`/match/${recap.matchId}`} className="mt-1 block text-sm font-semibold text-zinc-100 hover:text-white">
                          {recap.winner ? `${recap.winner} advanced` : "Match resolved"}
                        </Link>
                      </div>
                      <p className="rounded-full border border-zinc-700 px-3 py-1 font-mono text-xs text-zinc-300">{recap.scoreLine}</p>
                    </div>
                    {recap.keyMoment ? (
                      <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm leading-6 text-rose-100">
                        {recap.keyMoment}
                      </p>
                    ) : null}
                    <ul className="mt-3 space-y-1 text-sm leading-6 text-zinc-300">
                      {recap.roundLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </article>
                ))
              )}
            </div>
          </details>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-xl font-semibold">Entries</h2>
            {tournament.entries.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">No entries have been added to this tournament.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {tournament.entries.map((entry) => {
                  const scouting = scoutingByAgentId.get(entry.agentId);

                  return (
                    <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{entry.agent.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">House {entry.agent.house} · {entry.agent.strategyProfile}</p>
                        </div>
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-xs text-zinc-300">
                          Seed {entry.seed ?? "-"}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-zinc-400">
                        {entry.eliminatedAt ? `Eliminated ${formatDate(entry.eliminatedAt)}` : "Still alive or pending bracket"}
                      </p>
                      {scouting ? (
                        <div className="mt-4 rounded-lg border border-zinc-800 bg-black/30 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Scouting card</p>
                            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                              {scouting.confidence} confidence
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-zinc-300">{scouting.headline}</p>
                          <div className="mt-3 grid gap-2 text-[11px] text-zinc-300">
                            <p><span className="text-zinc-500">Identity:</span> {scouting.tacticalIdentity}</p>
                            <p><span className="text-zinc-500">Watch-out flaw:</span> {scouting.likelyFlaw}</p>
                            <p><span className="text-zinc-500">Best in:</span> {scouting.preferredFormat}</p>
                          </div>
                          {scouting.lowData ? (
                            <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
                              Low-data read: use as context, not a prediction.
                            </p>
                          ) : null}
                          <div className="mt-3 grid gap-2 text-[11px] text-zinc-400">
                            {scouting.backingEvidence.slice(0, 3).map((line) => (
                              <p key={line}>• {line}</p>
                            ))}
                          </div>
                          {scouting.recentMatches.length > 0 ? (
                            <div className="mt-3 space-y-1 text-[11px] text-zinc-500">
                              {scouting.recentMatches.map((match) => (
                                <p key={match.id}>{match.result}: {match.label} — {match.scoreLine}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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
                        const matchupScouting = participants.length === 2
                          ? buildMatchupPreview(
                              scoutingByAgentId.get(participants[0].id) ?? deriveAgentScouting({ agent: tournamentMatch.match.participants[0].agent, matches: scoutingMatches }),
                              scoutingByAgentId.get(participants[1].id) ?? deriveAgentScouting({ agent: tournamentMatch.match.participants[1].agent, matches: scoutingMatches }),
                            )
                          : null;

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

                            {matchupScouting ? (
                              <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[10px] uppercase tracking-widest text-sky-200/80">Matchup preview</p>
                                  <span className="text-[10px] font-semibold text-sky-100">{matchupScouting.confidence} confidence</span>
                                </div>
                                <p className="mt-2 font-mono text-[11px] text-sky-100/90">{matchupScouting.summary}</p>
                                <p className="mt-2 text-[11px] leading-5 text-sky-100/80">{matchupScouting.angles[2]}</p>
                              </div>
                            ) : null}

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
