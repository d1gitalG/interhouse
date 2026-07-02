#!/usr/bin/env node
/*
  Tournament eligibility / anti-spam smoke.

  Expected use AFTER tournament schema has been pushed to the target DB and the app is running:
    SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-tournament-eligibility.js

  Production guard:
    This script refuses to hit interhouse-five.vercel.app unless ALLOW_PROD_TOURNAMENT_SMOKE=true.
*/

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const entryFeeCredits = Number(process.env.TOURNAMENT_ENTRY_FEE || 25);
const allowProd = process.env.ALLOW_PROD_TOURNAMENT_SMOKE === "true";
const internalSecret = process.env.INTERNAL_SECRET;

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
  return { res, data, text };
}

async function ok(path, options = {}) {
  const result = await request(path, options);
  if (!result.res.ok) {
    throw new Error(`${options.method || "GET"} ${path} ${result.res.status}: ${result.text.slice(0, 800)}`);
  }
  return result.data;
}

function post(path, body = {}) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: internalSecret ? { "x-internal-secret": internalSecret } : undefined,
  });
}

async function postOk(path, body = {}) {
  const result = await post(path, body);
  if (!result.res.ok) {
    throw new Error(`POST ${path} ${result.res.status}: ${result.text.slice(0, 800)}`);
  }
  return result.data;
}

async function createAgent(index, runId) {
  const houses = ["RED", "BLUE", "GREEN", "YELLOW"];
  const strategies = ["AGGRESSIVE", "CALCULATED", "DEFENSIVE", "CHAOTIC"];
  const { agent } = await postOk("/api/agents", {
    name: `Smoke Eligibility ${runId}-${index}`,
    house: houses[index % houses.length],
    strategyProfile: strategies[index % strategies.length],
    tier: "CONTENDER",
    toolsEnabled: ["BOARD_ANALYZER", "MOVE_HISTORY"],
    customSystemPrompt: "Smoke-test tournament eligibility entrant. Keep decisions concise and legal.",
  });
  return agent;
}

async function getAgentsById(ids) {
  const { agents } = await ok("/api/agents");
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  return ids.map((id) => {
    const agent = byId.get(id);
    if (!agent) throw new Error(`Missing agent after smoke: ${id}`);
    return agent;
  });
}

async function tournamentSnapshot() {
  const { tournaments } = await ok("/api/tournaments");
  return {
    count: tournaments.length,
    prizePoolCredits: tournaments.reduce((total, tournament) => total + tournament.prizePoolCredits, 0),
  };
}

function assertCreditsUnchanged(before, after) {
  for (const agent of after) {
    const initial = before.find((candidate) => candidate.id === agent.id);
    if (!initial) throw new Error(`Unexpected agent in credit comparison: ${agent.id}`);
    if (agent.credits !== initial.credits || agent.lockedCredits !== initial.lockedCredits) {
      throw new Error(
        `${agent.name} credits changed after rejected create: credits ${initial.credits}->${agent.credits}, locked ${initial.lockedCredits}->${agent.lockedCredits}`,
      );
    }
  }
}

function assertTournamentSnapshotUnchanged(before, after, label) {
  if (after.count !== before.count || after.prizePoolCredits !== before.prizePoolCredits) {
    throw new Error(
      `${label} changed tournament state after rejection: count ${before.count}->${after.count}, prizePool ${before.prizePoolCredits}->${after.prizePoolCredits}`,
    );
  }
}

async function expectTournamentReject(label, body, expectedStatus, expectedError) {
  const beforeSnapshot = await tournamentSnapshot();
  const trackedIds = [...new Set(body.agentIds || [])];
  const beforeAgents = await getAgentsById(trackedIds);
  const result = await post("/api/tournaments", body);
  if (result.res.status !== expectedStatus || result.data?.error !== expectedError) {
    throw new Error(
      `${label} wrong rejection: got ${result.res.status} ${JSON.stringify(result.data)}, expected ${expectedStatus} ${expectedError}`,
    );
  }
  const afterAgents = await getAgentsById(trackedIds);
  const afterSnapshot = await tournamentSnapshot();
  assertCreditsUnchanged(beforeAgents, afterAgents);
  assertTournamentSnapshotUnchanged(beforeSnapshot, afterSnapshot, label);
  console.log(`[smoke] ${label} rejected status=${result.res.status} error=${result.data.error}`);
}

async function run() {
  const runId = Date.now().toString(36);
  console.log(`[smoke] base=${baseUrl}`);
  console.log(`[smoke] creating eligibility agents, entryFee=${entryFeeCredits}`);

  const agents = [];
  for (let i = 0; i < 5; i += 1) agents.push(await createAgent(i + 1, runId));
  const agentIds = agents.map((agent) => agent.id);

  const eligibleInitial = await getAgentsById(agentIds.slice(0, 4));
  const { tournament: created } = await postOk("/api/tournaments", {
    name: `Smoke Eligibility OK ${runId}`,
    game: "RPS",
    series: "BO3",
    entryFeeCredits,
    maxEntries: 4,
    agentIds: agentIds.slice(0, 4),
  });
  if (created.entries.length !== 4 || created.prizePoolCredits !== entryFeeCredits * 4) {
    throw new Error(`Eligible create produced wrong tournament state: entries=${created.entries.length} prizePool=${created.prizePoolCredits}`);
  }
  const eligibleAfter = await getAgentsById(agentIds.slice(0, 4));
  for (const agent of eligibleAfter) {
    const before = eligibleInitial.find((candidate) => candidate.id === agent.id);
    const expectedCredits = before.credits - entryFeeCredits;
    if (agent.credits !== expectedCredits) {
      throw new Error(`${agent.name} entry fee debit mismatch: got ${agent.credits}, expected ${expectedCredits}`);
    }
  }
  console.log(`[smoke] eligible create ok tournament=${created.id} prizePool=${created.prizePoolCredits}`);

  await expectTournamentReject(
    "duplicate-in-request",
    {
      name: `Smoke Eligibility Duplicate ${runId}`,
      game: "RPS",
      series: "BO3",
      entryFeeCredits,
      maxEntries: 4,
      agentIds: [agentIds[0], agentIds[0], agentIds[1], agentIds[2]],
    },
    400,
    "DUPLICATE_TOURNAMENT_ENTRY",
  );

  await expectTournamentReject(
    "over-cap",
    {
      name: `Smoke Eligibility Cap ${runId}`,
      game: "RPS",
      series: "BO3",
      entryFeeCredits,
      maxEntries: 4,
      agentIds,
    },
    409,
    "TOURNAMENT_ENTRY_CAP_REACHED",
  );

  console.log("[smoke] PASS", JSON.stringify({
    eligibleTournamentId: created.id,
    duplicateRejected: true,
    overCapRejected: true,
    rejectedCreatesLeftCreditsAndPrizePoolsUnchanged: true,
  }, null, 2));
}

run().catch((error) => {
  console.error("[smoke] FAIL", error?.stack || error?.message || error);
  process.exit(1);
});
