/*
  Warnings:

  - You are about to drop the `CreditsAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreditsLedgerEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MatchPlayer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RpsRound` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RpsSeries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `bestOf` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `endedAt` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `joinDeadline` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `ttlSeconds` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `displayName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `house` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - The required column `challengeCode` was added to the `Match` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `game` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `series` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stakeAmount` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stakeMode` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletAddress` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CreditsAccount_userId_key";

-- DropIndex
DROP INDEX "CreditsLedgerEntry_seriesId_createdAt_idx";

-- DropIndex
DROP INDEX "CreditsLedgerEntry_accountId_createdAt_idx";

-- DropIndex
DROP INDEX "MatchPlayer_matchId_slot_key";

-- DropIndex
DROP INDEX "MatchPlayer_matchId_userId_key";

-- DropIndex
DROP INDEX "MatchPlayer_userId_createdAt_idx";

-- DropIndex
DROP INDEX "RpsRound_seriesId_number_key";

-- DropIndex
DROP INDEX "RpsRound_seriesId_createdAt_idx";

-- DropIndex
DROP INDEX "RpsSeries_status_createdAt_idx";

-- DropIndex
DROP INDEX "RpsSeries_matchId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CreditsAccount";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CreditsLedgerEntry";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MatchPlayer";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "RpsRound";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "RpsSeries";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nftMint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "house" TEXT NOT NULL,
    "strategyProfile" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'ROOKIE',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 1000,
    "customSystemPrompt" TEXT,
    "toolsEnabled" JSONB NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MatchParticipant_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Move" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "move" TEXT NOT NULL,
    "reasoning" TEXT,
    "commitHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Move_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "stakeMode" TEXT NOT NULL,
    "stakeAmount" INTEGER NOT NULL,
    "series" TEXT NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "challengeCode" TEXT NOT NULL,
    "winnerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Match" ("createdAt", "id", "status", "updatedAt") SELECT "createdAt", "id", "status", "updatedAt" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE UNIQUE INDEX "Match_challengeCode_key" ON "Match"("challengeCode");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "id") SELECT "createdAt", "id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_nftMint_key" ON "AgentProfile"("nftMint");
