-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'SEEDED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentPayoutMode" AS ENUM ('WINNER_TAKE_ALL');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "game" "GameType" NOT NULL DEFAULT 'RPS',
    "series" "SeriesType" NOT NULL DEFAULT 'BO3',
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "payoutMode" "TournamentPayoutMode" NOT NULL DEFAULT 'WINNER_TAKE_ALL',
    "entryFeeCredits" INTEGER NOT NULL DEFAULT 0,
    "prizePoolCredits" INTEGER NOT NULL DEFAULT 0,
    "winnerAgentId" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEntry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "seed" INTEGER,
    "eliminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentMatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "winnerAgentId" TEXT,
    "advancedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEntry_tournamentId_agentId_key" ON "TournamentEntry"("tournamentId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEntry_tournamentId_seed_key" ON "TournamentEntry"("tournamentId", "seed");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentMatch_matchId_key" ON "TournamentMatch"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentMatch_tournamentId_round_slot_key" ON "TournamentMatch"("tournamentId", "round", "slot");

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
