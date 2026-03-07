export type RpsMove = "ROCK" | "PAPER" | "SCISSORS";
export type RpsRoundResult = "P1_WIN" | "P2_WIN" | "DRAW";
export type SeriesType = "QUICK" | "BO3" | "BO5";

const SERIES_TARGET_WINS: Record<SeriesType, number> = {
  QUICK: 1,
  BO3: 2,
  BO5: 3,
};

export function resolveRPS(p1: RpsMove, p2: RpsMove): RpsRoundResult {
  if (p1 === p2) return "DRAW";

  const p1Wins =
    (p1 === "ROCK" && p2 === "SCISSORS") ||
    (p1 === "SCISSORS" && p2 === "PAPER") ||
    (p1 === "PAPER" && p2 === "ROCK");

  return p1Wins ? "P1_WIN" : "P2_WIN";
}

export function checkSeriesWinner(
  p1Score: number,
  p2Score: number,
  series: SeriesType
): "P1" | "P2" | null {
  const target = SERIES_TARGET_WINS[series];
  if (p1Score >= target) return "P1";
  if (p2Score >= target) return "P2";
  return null;
}
