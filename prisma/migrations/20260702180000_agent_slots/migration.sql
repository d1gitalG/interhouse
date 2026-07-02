-- Add BYO agent slot allowance for public agent creation.
ALTER TABLE "User" ADD COLUMN "agentSlots" INTEGER NOT NULL DEFAULT 1;
