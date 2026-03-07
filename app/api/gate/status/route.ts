import { NextResponse } from "next/server";

export async function GET() {
  // Placeholder gating endpoint
  // TODO: return { eligible, house, nftMints[] } when wallet+NFT gating is wired.
  return NextResponse.json({ ok: true, service: "interhouse" });
}
