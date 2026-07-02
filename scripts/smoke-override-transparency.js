#!/usr/bin/env node
/*
  Tournament audit override-transparency smoke.

  Expected use after at least one tournament match has moves:
    SMOKE_BASE_URL=http://localhost:3000 SMOKE_TOURNAMENT_ID=<id> node scripts/smoke-override-transparency.js

  If SMOKE_TOURNAMENT_ID is omitted, the script checks recent tournaments and uses the first audit export with move rows.
*/

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const tournamentId = process.env.SMOKE_TOURNAMENT_ID;
const allowProd = process.env.ALLOW_PROD_TOURNAMENT_SMOKE === "true";

if (/interhouse-five\.vercel\.app/i.test(baseUrl) && !allowProd) {
  throw new Error(
    "Refusing to run tournament smoke against production without ALLOW_PROD_TOURNAMENT_SMOKE=true",
  );
}

async function request(path) {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`GET ${path} ${res.status}: ${text.slice(0, 800)}`);
  }
  return { data, text };
}

function auditMoves(audit) {
  return (audit.matches || []).flatMap((match) => match.moves || []);
}

function assertAudit(audit, rawText, id) {
  if (audit.exportVersion !== "interhouse-tournament-audit-v1") {
    throw new Error(`Unexpected exportVersion for ${id}: ${audit.exportVersion}`);
  }
  if (/customSystemPrompt/i.test(rawText)) {
    throw new Error(`Audit export leaked customSystemPrompt pattern for ${id}`);
  }

  const moves = auditMoves(audit);
  if (moves.length === 0) return false;

  for (const move of moves) {
    if (!Object.prototype.hasOwnProperty.call(move, "rawMove")) {
      throw new Error(`Move ${move.moveId || "unknown"} missing rawMove key`);
    }
    if (!Object.prototype.hasOwnProperty.call(move, "overrideRule")) {
      throw new Error(`Move ${move.moveId || "unknown"} missing overrideRule key`);
    }
  }

  return true;
}

async function auditTournament(id) {
  const { data, text } = await request(`/api/tournaments/${id}/audit`);
  return assertAudit(data, text, id);
}

async function run() {
  console.log(`[smoke] base=${baseUrl}`);

  if (tournamentId) {
    const hasMoves = await auditTournament(tournamentId);
    if (!hasMoves) throw new Error(`Tournament ${tournamentId} audit has no move rows to inspect`);
    console.log("[smoke] PASS", JSON.stringify({ tournamentId }, null, 2));
    return;
  }

  const { data } = await request("/api/tournaments");
  const tournaments = data.tournaments || [];
  for (const tournament of tournaments) {
    if (await auditTournament(tournament.id)) {
      console.log("[smoke] PASS", JSON.stringify({ tournamentId: tournament.id }, null, 2));
      return;
    }
  }

  throw new Error("No recent tournament audit with move rows found; set SMOKE_TOURNAMENT_ID");
}

run().catch((error) => {
  console.error("[smoke] FAIL", error?.stack || error?.message || error);
  process.exit(1);
});
