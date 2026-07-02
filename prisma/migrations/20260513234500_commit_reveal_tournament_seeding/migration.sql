-- Add public-safe tournament seed provenance fields for IH-066.
CREATE TYPE "TournamentSeedMethod" AS ENUM ('OPERATOR_ENTRY_ORDER', 'COMMIT_REVEAL');

ALTER TABLE "Tournament"
  ADD COLUMN "seedMethod" "TournamentSeedMethod" NOT NULL DEFAULT 'OPERATOR_ENTRY_ORDER',
  ADD COLUMN "seedCommitment" TEXT,
  ADD COLUMN "seedReveal" TEXT,
  ADD COLUMN "seedDerivation" TEXT,
  ADD COLUMN "seededAt" TIMESTAMP(3);
