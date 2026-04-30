import { NextResponse } from "next/server";

export function requireInternalSecret(req: Request) {
  const expected = process.env.INTERNAL_SECRET;
  const provided = req.headers.get("x-internal-secret");

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  return null;
}
