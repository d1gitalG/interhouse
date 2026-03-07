import { z } from "zod";

export const RpsMoveSchema = z.enum(["ROCK", "PAPER", "SCISSORS"]);

export const RpsCommitBodySchema = z.object({
  seriesId: z.string().min(1),
  roundNumber: z.number().int().positive(),
  // hex string (sha256 etc). Keep generic.
  commitHash: z.string().min(8),
});

export const RpsRevealBodySchema = z.object({
  seriesId: z.string().min(1),
  roundNumber: z.number().int().positive(),
  move: RpsMoveSchema,
  salt: z.string().min(1),
});

export type RpsCommitBody = z.infer<typeof RpsCommitBodySchema>;
export type RpsRevealBody = z.infer<typeof RpsRevealBodySchema>;
