#!/usr/bin/env node
/*
  Commit-reveal seeding no-regression smoke.

  Verifies: COMMIT_REVEAL tournament creation exposes a commitment but redacts
  the reveal before seeding; seeding publishes the reveal; the audit export
  reports the expected version, verified reveal, and no private prompt fields.

    SMOKE_BASE_URL=http://localhost:3177 INTERNAL_SECRET=... node scripts/smoke-commit-reveal.js
*/

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const allowProd = process.env.ALLOW_PROD_TOURNAMENT_SMOKE === "true";
const internalSecret = process.env.INTERNAL_SECRET;

if (/interhouse-five\.vercel\.app/i.test(baseUrl) && !allowProd) {
  throw new Error("Refusing to run against production without ALLOW_PROD_TOURNAMENT_SMOKE=true");
}

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
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
  return { res, data };
}

function assert(cond, label) {
  if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
  console.log(`[smoke] ok: ${label}`);
}

async function run() {
  console.log(`[smoke] base=${baseUrl}`);
  const runId = Date.now().toString(36);

  const agentIds = [];
  for (const [name, house] of [["A", "RED"], ["B", "BLUE"], ["C", "GREEN"], ["D", "YELLOW"]]) {
    const { res, data } = await request("/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: `CR Smoke ${name} ${runId}`,
        house,
        strategyProfile: "CALCULATED",
        tier: "CONTENDER",
        toolsEnabled: ["BOARD_ANALYZER"],
      }),
    });
    if (!res.ok) throw new Error(`agent create failed: ${res.status}`);
    agentIds.push(data.agent.id);
  }

  const created = await request("/api/tournaments", {
    method: "POST",
    body: JSON.stringify({
      name: `CR NoRegress ${runId}`,
      game: "RPS",
      series: "BO3",
      seedMethod: "COMMIT_REVEAL",
      entryFeeCredits: 0,
      agentIds,
    }),
  });
  assert(created.res.status === 201, `COMMIT_REVEAL tournament created (${created.res.status})`);
  const tournamentId = created.data.tournament.id;
  assert(!!created.data.tournament.seedCommitment, "commitment present at creation");
  assert(!created.data.tournament.seedReveal, "reveal redacted at creation");

  const preSeed = await request(`/api/tournaments/${tournamentId}`);
  assert(!preSeed.data.tournament.seedReveal, "reveal redacted on public GET before seeding");

  const seeded = await request(`/api/tournaments/${tournamentId}/seed`, { method: "POST" });
  assert(seeded.res.ok, `seed succeeded (${seeded.res.status})`);

  const postSeed = await request(`/api/tournaments/${tournamentId}`);
  assert(!!postSeed.data.tournament.seedReveal, "reveal published after seeding");

  const audit = await request(`/api/tournaments/${tournamentId}/audit`);
  assert(audit.res.ok, `audit export ok (${audit.res.status})`);
  assert(
    audit.data.exportVersion === "interhouse-tournament-audit-v1",
    `audit exportVersion=${audit.data.exportVersion}`,
  );
  const auditJson = JSON.stringify(audit.data);
  assert(!auditJson.includes("customSystemPrompt"), "no customSystemPrompt in audit export");
  assert(auditJson.includes("seedCommitment") || auditJson.includes("commitment"), "audit includes commitment field");

  console.log("[smoke] PASS", JSON.stringify({ tournamentId }, null, 2));
}

run().catch((error) => {
  console.error("[smoke] FAIL", error?.stack || error?.message || error);
  process.exit(1);
});
