import { NextResponse } from "next/server";
import crypto from "crypto";
import { RpsRevealBodySchema } from "@/lib/validators/rps";

function computeCommitHash(move: string, salt: string) {
  // NOTE: Choose the same algorithm everywhere (client + server).
  // This stub uses sha256(move + ":" + salt).
  return crypto.createHash("sha256").update(`${move}:${salt}`, "utf8").digest("hex");
}

function roundOutcome(p1: "ROCK" | "PAPER" | "SCISSORS", p2: "ROCK" | "PAPER" | "SCISSORS") {
  if (p1 === p2) return { outcome: "DRAW" as const, winnerSlot: null as number | null };
  const p1Wins =
    (p1 === "ROCK" && p2 === "SCISSORS") ||
    (p1 === "PAPER" && p2 === "ROCK") ||
    (p1 === "SCISSORS" && p2 === "PAPER");
  return p1Wins ? { outcome: "P1_WIN" as const, winnerSlot: 1 } : { outcome: "P2_WIN" as const, winnerSlot: 2 };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RpsRevealBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  const { seriesId, roundNumber, move, salt } = parsed.data;

  // Stubbed auth:
  const user = { id: "stub-user", slot: 1 as const };

  const expected = computeCommitHash(move, salt);

  return NextResponse.json({
    ok: true,
    seriesId,
    roundNumber,
    revealedBySlot: user.slot,
    move,
    salt,
    computedCommitHash: expected,
    note: "Stub route: wire prisma commit verification, outcome resolution, draw replay, and per-series settlement.",
  });
}
