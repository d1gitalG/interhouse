-- Persist public-safe engine override transparency for move audit exports.
ALTER TABLE "Move" ADD COLUMN "rawMove" TEXT;
ALTER TABLE "Move" ADD COLUMN "overrideRule" TEXT;
