import {
  HistoryEntry,
  averageTime,
  bestTime,
  isCounted,
  recordSolve,
} from "../src/history";

const entry = (
  level: number,
  seconds: number,
  autoFill = false,
  practice = false
): HistoryEntry => ({
  id: `${level}-0`,
  level,
  seconds,
  date: "2026-01-01T00:00:00.000Z",
  ...(autoFill ? { autoFill } : {}),
  ...(practice ? { practice } : {}),
});

test("solves with auto-filled pencil marks only count if wanted", () => {
  const e = [entry(1, 100), entry(1, 50, true), entry(1, 200), entry(2, 30, true)];
  expect(isCounted(e[0], false)).toBe(true);
  expect(isCounted(e[1], false)).toBe(false);
  expect(isCounted(e[1], true)).toBe(true);

  expect(bestTime(e, 1, true)).toBe(50);
  expect(bestTime(e, 1, false)).toBe(100);
  expect(bestTime(e, 1)).toBe(50); // everything counts by default
  expect(averageTime(e, 1, true)).toBeCloseTo(350 / 3);
  expect(averageTime(e, 1, false)).toBe(150);

  // a level with only such solves has no counted time
  expect(bestTime(e, 2, false)).toBeNull();
  expect(averageTime(e, 2, false)).toBeNull();
  expect(bestTime(e, 3, false)).toBeNull();
});

test("record solve: auto-fill solves are stored but can not be a best time", async () => {
  // level 7: no stored solves at the start
  let res = await recordSolve(entry(7, 100), false);
  expect(res).toEqual({ previousBest: null, isBest: true, counted: true });

  // faster, but with the magic wand and not counted
  res = await recordSolve(entry(7, 50, true), false);
  expect(res).toEqual({ previousBest: 100, isBest: false, counted: false });

  // the same solve counts if the setting is on
  res = await recordSolve(entry(7, 40, true), true);
  expect(res).toEqual({ previousBest: 50, isBest: true, counted: true });
});

test("practice solves never count for the best and average times", () => {
  const e = [entry(1, 100), entry(1, 20, false, true), entry(1, 30, true, true)];
  expect(isCounted(e[1], true)).toBe(false);
  expect(isCounted(e[2], true)).toBe(false);
  expect(bestTime(e, 1, true)).toBe(100);
  expect(averageTime(e, 1, true)).toBe(100);
  // a level with only practice solves has no time
  expect(bestTime([entry(2, 10, false, true)], 2)).toBeNull();
});

test("record solve: a practice solve is stored, but is not a best time", async () => {
  // level 8: no stored solves at the start
  let res = await recordSolve(entry(8, 100), true);
  expect(res).toEqual({ previousBest: null, isBest: true, counted: true });
  // faster, but practice
  res = await recordSolve(entry(8, 10, false, true), true);
  expect(res).toEqual({ previousBest: 100, isBest: false, counted: false });
  // the practice time is not the best to beat
  res = await recordSolve(entry(8, 90), true);
  expect(res).toEqual({ previousBest: 100, isBest: true, counted: true });
});
