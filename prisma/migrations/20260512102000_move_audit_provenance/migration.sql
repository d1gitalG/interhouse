-- Persist public-safe move-level provenance for future tournament/match audit exports.
ALTER TABLE "Move" ADD COLUMN "provider" TEXT;
ALTER TABLE "Move" ADD COLUMN "model" TEXT;
ALTER TABLE "Move" ADD COLUMN "modelVersion" TEXT;
ALTER TABLE "Move" ADD COLUMN "agentEngineVersion" TEXT;
ALTER TABLE "Move" ADD COLUMN "systemPromptHash" TEXT;
ALTER TABLE "Move" ADD COLUMN "userPromptHash" TEXT;
ALTER TABLE "Move" ADD COLUMN "promptCommitHash" TEXT;
