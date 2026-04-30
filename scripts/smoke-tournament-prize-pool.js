#!/usr/bin/env node
/*
  4-agent winner-take-all tournament smoke.

  Expected use AFTER tournament schema has been pushed to the target DB and the app is running:
    SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-tournament-prize-pool.js

  Production guard:
    This script refuses to hit interhouse-five.vercel.app unless ALLOW_PROD_TOURNAMENT_SMOKE=true.
*/

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const entryFeeCredits = Number(process.env.TOURNAMENT_ENTRY_FEE || 25);
const allowProd = process.env.ALLOW_PROD_TOURNAMENT_SMOKE === "true";

if (/interhouse-five\.vercel\.app/i.test(baseUrl) && !allowProd) {
  throw new Error(
    "Refusing to run tournament smoke against production without ALLOW_PROD_TOURNAMENT_SMOKE=true",
  );
}

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} ${res.status}: ${text.slice(0, 800)}`);
  }
  return data;
}

function post(path, body = {}) {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

async function createAgent(index, runId) {
  const houses = ["RED", "BLUE", "GREEN", "YELLOW"];
  const strategies = ["AGGRESSIVE", "CALCULATED", "DEFENSIVE", "CHAOTIC"];
  const { agent } = await post("/api/agents", {
    name: `Smoke Prize ${runId}-${index}`,
    house: houses[index % houses.length],
    strategyProfile: strategies[index % strategies.length],
    tier: "CONTENDER",
    toolsEnabled: ["BOARD_ANALYZER", "MOVE_HISTORY"],
    customSystemPrompt: "Smoke-test tournament entrant. Keep decisions concise and legal.",
  });
  return agent;
}

async function getAgentsById(ids) {
  const { agents } = await request("/api/agents");
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  return ids.map((id) => {
    const agent = byId.get(id);
    if (!agent) throw new Error(`Missing agent after smoke: ${id}`);
    return agent;
  });
}

async function getTournament(tournamentId) {
  const { tournament } = await request(`/api/tournaments/${tournamentId}`);
  return tournament;
}

async function tickMatchToCompletion(matchId) {
  for (let i = 0; i < 16; i += 1) {
    const { match } = await post(`/api/matches/${matchId}/tick`, {});
    if (match.status === "COMPLETED") return match;
  }
  throw new Error(`Match did not complete within tick budget: ${matchId}`);
}

async function run() {
  const runId = Date.now().toString(36);
  console.log(`[smoke] base=${baseUrl}`);
  console.log(`[smoke] creating 4 agents, entryFee=${entryFeeCredits}`);

  const entrants = [];
  for (let i = 0; i < 4; i += 1) entrants.push(await createAgent(i + 1, runId));
  const entrantIds = entrants.map((agent) => agent.id);
  const initial = await getAgentsById(entrantIds);

  const { tournament: created } = await post("/api/tournaments", {
    name: `Smoke WTA ${runId}`,
    game: "RPS",
    series: "BO3",
    entryFeeCredits,
    agentIds: entrantIds,
  });
  console.log(`[smoke] tournament=${created.id} prizePool=${created.prizePoolCredits}`);

  const afterCreate = await getAgentsById(entrantIds);
  for (const agent of afterCreate) {
    const before = initial.find((candidate) => candidate.id === agent.id);
    const expected = before.credits - entryFeeCredits;
    if (agent.credits !== expected) {
      throw new Error(`Entry fee did not debit once for ${agent.name}: got ${agent.credits}, expected ${expected}`);
    }
  }

  await post(`/api/tournaments/${created.id}/seed`, {});

  const advanced = new Set();
  let tournament = await getTournament(created.id);
  for (let guard = 0; guard < 8 && tournament.status !== "COMPLETED"; guard += 1) {
    const runnable = tournament.matches.filter(
      (tm) => tm.match.status === "ACTIVE" && !advanced.has(tm.matchId),
    );
    if (runnable.length === 0) {
      throw new Error(`No runnable tournament matches while status=${tournament.status}`);
    }
    for (const tm of runnable) {
      const completed = await tickMatchToCompletion(tm.matchId);
      if (completed.stakeAmount !== 0) {
        throw new Error(`Tournament match ${tm.matchId} used non-zero stake ${completed.stakeAmount}`);
      }
      await post(`/api/tournaments/${created.id}/advance`, { matchId: tm.matchId });
      advanced.add(tm.matchId);
      console.log(`[smoke] advanced r${tm.round}s${tm.slot} winner=${completed.winnerId}`);
    }
    tournament = await getTournament(created.id);
  }

  if (tournament.status !== "COMPLETED" || !tournament.winnerAgentId) {
    throw new Error(`Tournament did not complete: status=${tournament.status}`);
  }

  await post(`/api/tournaments/${created.id}/settle`, {});
  const afterFirstSettle = await getAgentsById(entrantIds);
  await post(`/api/tournaments/${created.id}/settle`, {});
  const afterSecondSettle = await getAgentsById(entrantIds);

  const prizePool = entryFeeCredits * entrantIds.length;
  for (const agent of afterSecondSettle) {
    const before = initial.find((candidate) => candidate.id === agent.id);
    const afterOne = afterFirstSettle.find((candidate) => candidate.id === agent.id);
    if (agent.credits !== afterOne.credits || agent.lockedCredits !== afterOne.lockedCredits) {
      throw new Error(`Settlement is not idempotent for ${agent.name}`);
    }
    const isWinner = agent.id === tournament.winnerAgentId;
    const expectedCredits = before.credits - entryFeeCredits + (isWinner ? prizePool : 0);
    if (agent.credits !== expectedCredits) {
      throw new Error(
        `${agent.name} wrong credits: got ${agent.credits}, expected ${expectedCredits} (${isWinner ? "winner" : "loser"})`,
      );
    }
    if (agent.lockedCredits !== before.lockedCredits) {
      throw new Error(`${agent.name} stranded lockedCredits: got ${agent.lockedCredits}, expected ${before.lockedCredits}`);
    }
  }

  const winner = afterSecondSettle.find((agent) => agent.id === tournament.winnerAgentId);
  console.log("[smoke] PASS", JSON.stringify({
    tournamentId: created.id,
    winner: winner?.name,
    winnerAgentId: tournament.winnerAgentId,
    prizePool,
    entrants: afterSecondSettle.map((agent) => ({
      name: agent.name,
      credits: agent.credits,
      lockedCredits: agent.lockedCredits,
    })),
  }, null, 2));
}

run().catch((error) => {
  console.error("[smoke] FAIL", error?.stack || error?.message || error);
  process.exit(1);
});
