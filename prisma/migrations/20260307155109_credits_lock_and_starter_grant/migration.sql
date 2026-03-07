-- AlterTable
ALTER TABLE "Match" ADD COLUMN "creditsLockedAt" DATETIME;
ALTER TABLE "Match" ADD COLUMN "creditsSettledAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nftMint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "house" TEXT NOT NULL,
    "strategyProfile" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'ROOKIE',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "lockedCredits" INTEGER NOT NULL DEFAULT 0,
    "starterGranted" BOOLEAN NOT NULL DEFAULT false,
    "customSystemPrompt" TEXT,
    "toolsEnabled" JSONB NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AgentProfile" ("createdAt", "credits", "customSystemPrompt", "house", "id", "losses", "name", "nftMint", "ownerId", "strategyProfile", "tier", "toolsEnabled", "updatedAt", "wins", "xp") SELECT "createdAt", "credits", "customSystemPrompt", "house", "id", "losses", "name", "nftMint", "ownerId", "strategyProfile", "tier", "toolsEnabled", "updatedAt", "wins", "xp" FROM "AgentProfile";
DROP TABLE "AgentProfile";
ALTER TABLE "new_AgentProfile" RENAME TO "AgentProfile";
CREATE UNIQUE INDEX "AgentProfile_nftMint_key" ON "AgentProfile"("nftMint");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
