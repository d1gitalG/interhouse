import { z } from "zod";

export const MatchTypeSchema = z.enum(["SCRIM", "WAR"]);

// Tabs: "scrim" and "war" in UI; API uses MatchType values.
export const MatchesListQuerySchema = z.object({
  type: MatchTypeSchema.optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

export const CreateMatchBodySchema = z.object({
  type: MatchTypeSchema,
  // allowed best-of: quick (1), bo3 (3), bo5 (5)
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  // stake mode is visible in UI from day 1
  stakeMode: z.enum(["CREDITS", "SOL"]),
  // optional entry fee/pot mechanics (credits)
  entryFeeCredits: z.number().int().nonnegative().optional(),
  // optional stake (SOL mode). Keep as lamports in API.
  stakeLamports: z.number().int().nonnegative().optional(),
});

export const JoinMatchBodySchema = z.object({
  matchId: z.string().min(1),
});

// For route params
export const MatchIdParamSchema = z.object({
  matchId: z.string().min(1),
});

export type MatchesListQuery = z.infer<typeof MatchesListQuerySchema>;
export type CreateMatchBody = z.infer<typeof CreateMatchBodySchema>;
export type JoinMatchBody = z.infer<typeof JoinMatchBodySchema>;
