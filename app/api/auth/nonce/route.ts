import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET() {
  // Stub: In a real SIWS flow you'd persist nonce keyed by session/address.
  // Here we just return a strong random nonce.
  const nonce = crypto.randomBytes(16).toString("hex");
  return NextResponse.json({ nonce });
}
