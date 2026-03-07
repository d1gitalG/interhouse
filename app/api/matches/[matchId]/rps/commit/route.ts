import { NextResponse } from "next/server";
import { RpsCommitBodySchema } from "@/lib/validators/rps";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RpsCommitBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  const { seriesId, roundNumber, commitHash } = parsed.data;

  // Stubbed auth:
  const user = { id: "stub-user", slot: 1 as const };

  return NextResponse.json({
    ok: true,
    seriesId,
    roundNumber,
    committedBySlot: user.slot,
    commitHash,
    note: "Stub route: wire prisma + TTL enforcement + slot detection.",
  });
}
