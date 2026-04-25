import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createClient() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl || dbUrl.startsWith("file:")) {
    throw new Error(
      "InterHouse requires a Postgres DATABASE_URL. Provision Neon/Vercel Postgres and set DATABASE_URL before running the app.",
    );
  }

  const adapter = new PrismaPg({ connectionString: dbUrl });
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
