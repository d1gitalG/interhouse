import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const VerifyBodySchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = VerifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }

  // Stub only:
  // - verify signature
  // - upsert User by address (and possibly assign/confirm house)
  // - create session cookie / JWT
  return NextResponse.json({ ok: true, address: parsed.data.address });
}
