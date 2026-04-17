import test from "node:test";
import assert from "node:assert/strict";

import { resolveSeriesState } from "../lib/series-engine";

test("BO3 finalizes once a participant reaches two wins", () => {
  const state = resolveSeriesState({
    p1Score: 1,
    p2Score: 0,
    series: "BO3",
    roundWinner: "P1",
  });

  assert.equal(state.nextP1Score, 2);
  assert.equal(state.nextP2Score, 0);
  assert.equal(state.seriesWinner, "P1");
  assert.equal(state.shouldAdvanceRound, false);
});

test("BO5 draw advances the round without finalizing a winner", () => {
  const state = resolveSeriesState({
    p1Score: 2,
    p2Score: 1,
    series: "BO5",
    roundWinner: null,
  });

  assert.equal(state.nextP1Score, 2);
  assert.equal(state.nextP2Score, 1);
  assert.equal(state.seriesWinner, null);
  assert.equal(state.shouldAdvanceRound, true);
});

test("BO5 keeps the series open before the target wins are reached", () => {
  const state = resolveSeriesState({
    p1Score: 1,
    p2Score: 1,
    series: "BO5",
    roundWinner: "P2",
  });

  assert.equal(state.nextP1Score, 1);
  assert.equal(state.nextP2Score, 2);
  assert.equal(state.seriesWinner, null);
  assert.equal(state.shouldAdvanceRound, true);
});
