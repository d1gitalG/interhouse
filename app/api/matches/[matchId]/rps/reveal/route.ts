import { NextResponse } from "next/server";
import crypto from "crypto";
import { RpsRevealBodySchema } from "@/lib/validators/rps";

function computeCommitHash(move: string, salt: string) {
  // NOTE: Choose the same algorithm everywhere (client + server).
  // This stub uses sha256(move + ":" + salt).
  return crypto.createHash("sha256").update(`${move}:${salt}`, "utf8").digest("hex");
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
