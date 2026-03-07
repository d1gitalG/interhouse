-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "address" TEXT NOT NULL,
    "displayName" TEXT,
    "house" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "joinDeadline" DATETIME NOT NULL,
    "bestOf" INTEGER NOT NULL,
    "ttlSeconds" INTEGER NOT NULL,
    "startedAt" DATETIME,
    "endedAt" DATETIME
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "house" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RpsSeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "matchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "bestOf" INTEGER NOT NULL,
    "ttlSeconds" INTEGER NOT NULL,
    "p1Score" INTEGER NOT NULL DEFAULT 0,
    "p2Score" INTEGER NOT NULL DEFAULT 0,
    "winnerSlot" INTEGER,
    "completedAt" DATETIME,
    "settledAt" DATETIME,
    "settleMemo" TEXT,
    "entryFeeCredits" INTEGER NOT NULL DEFAULT 0,
    "potCredits" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RpsSeries_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RpsRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seriesId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "p1Commit" TEXT,
    "p1CommittedAt" DATETIME,
    "p1Move" TEXT,
    "p1Salt" TEXT,
    "p1RevealedAt" DATETIME,
    "p2Commit" TEXT,
    "p2CommittedAt" DATETIME,
    "p2Move" TEXT,
    "p2Salt" TEXT,
    "p2RevealedAt" DATETIME,
    "outcome" TEXT,
    "resolvedAt" DATETIME,
    "winnerSlot" INTEGER,
    CONSTRAINT "RpsRound_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "RpsSeries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditsAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CreditsAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditsLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "seriesId" TEXT,
    "matchId" TEXT,
    "memo" TEXT,
    CONSTRAINT "CreditsLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditsAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE INDEX "Match_type_status_createdAt_idx" ON "Match"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MatchPlayer_userId_createdAt_idx" ON "MatchPlayer"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_userId_key" ON "MatchPlayer"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_slot_key" ON "MatchPlayer"("matchId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "RpsSeries_matchId_key" ON "RpsSeries"("matchId");

-- CreateIndex
CREATE INDEX "RpsSeries_status_createdAt_idx" ON "RpsSeries"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RpsRound_seriesId_createdAt_idx" ON "RpsRound"("seriesId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RpsRound_seriesId_number_key" ON "RpsRound"("seriesId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "CreditsAccount_userId_key" ON "CreditsAccount"("userId");

-- CreateIndex
CREATE INDEX "CreditsLedgerEntry_accountId_createdAt_idx" ON "CreditsLedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditsLedgerEntry_seriesId_createdAt_idx" ON "CreditsLedgerEntry"("seriesId", "createdAt");
