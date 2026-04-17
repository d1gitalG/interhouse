import type { SeriesType } from "@prisma/client";

import { checkSeriesWinner } from "./rps-engine";

type SeriesWinner = "P1" | "P2";

export function resolveSeriesState(params: {
  p1Score: number;
  p2Score: number;
  series: SeriesType;
  roundWinner: SeriesWinner | null;
}) {
  const { p1Score, p2Score, series, roundWinner } = params;

  const nextP1Score = p1Score + (roundWinner === "P1" ? 1 : 0);
  const nextP2Score = p2Score + (roundWinner === "P2" ? 1 : 0);
  const seriesWinner =
    roundWinner == null ? null : checkSeriesWinner(nextP1Score, nextP2Score, series);

  return {
    nextP1Score,
    nextP2Score,
    seriesWinner,
    shouldAdvanceRound: seriesWinner == null,
  };
}
