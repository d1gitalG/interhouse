import { prisma } from "@/lib/prisma";

export type AuthedUser = {
  id: string;
  walletAddress: string;
};

/**
 * MVP auth (temporary):
 * - If x-address header is present, treat it as the wallet address.
 * - Auto-upsert the User record.
 *
 * Replace with nonce+signature session once auth routes are fully wired.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const walletAddress = req.headers.get("x-address")?.trim();
  if (!walletAddress) {
    throw new Error("UNAUTHENTICATED");
  }

  const user = await prisma.user.upsert({
    where: { walletAddress },
    create: { walletAddress },
    update: {},
  });

  return {
    id: user.id,
    walletAddress: user.walletAddress,
  };
}
