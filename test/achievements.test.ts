import {
  ACHIEVEMENTS,
  earnedBy,
  importEntries,
  infoOfEntry,
  SolveInfo,
} from "../src/achievements";
import { HistoryEntry } from "../src/history";
import { LEVEL_COUNT } from "../src/sudoku";

const solve = (extra: Partial<SolveInfo> = {}): SolveInfo => ({
  level: 2,
  seconds: 600,
  practice: false,
  helped: false,
  ...extra,
});
const ids = (s: SolveInfo) => earnedBy(s).map((a) => a.id);

test("there is an achievement for every level", () => {
  for (let level = 0; level < LEVEL_COUNT; ++level) {
    expect(ids(solve({ level }))).toContain(`level-${level}`);
  }
  expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
});

test("level, time and pencil marks", () => {
  const top = LEVEL_COUNT - 1;
  expect(ids(solve())).toEqual(["level-2"]); // no facts about the pencil marks: not given
  expect(ids(solve({ pencil: true }))).toEqual(["level-2"]);
  expect(ids(solve({ pencil: false }))).toEqual(["level-2", "no-pencil"]);
  expect(ids(solve({ level: top, pencil: false, seconds: 299 }))).toEqual([
    `level-${top}`,
    `fast-${top}`,
    "no-pencil",
    "no-pencil-top",
  ]);
  // under 5 minutes for every level, not exactly 5 minutes; and an hour
  for (let level = 0; level < LEVEL_COUNT; ++level) {
    expect(ids(solve({ level, seconds: 299 }))).toContain(`fast-${level}`);
    expect(ids(solve({ level, seconds: 300 }))).not.toContain(`fast-${level}`);
  }
  expect(ids(solve({ level: 1, seconds: 299 }))).not.toContain("fast-2");
  expect(ids(solve({ seconds: 3600 }))).not.toContain("marathon");
  expect(ids(solve({ seconds: 3601 }))).toContain("marathon");
});

test("guesses and the last digit", () => {
  expect(ids(solve({ guessDepth: 3 }))).not.toContain("deep");
  expect(ids(solve({ guessDepth: 4 }))).toContain("deep");
  expect(ids(solve({ digitLast: false }))).not.toContain("one-digit");
  expect(ids(solve({ digitLast: true }))).toContain("one-digit");
});

test("practice solves and solves with help earn nothing", () => {
  expect(earnedBy(solve({ practice: true, pencil: false }))).toEqual([]);
  expect(earnedBy(solve({ helped: true, pencil: false, seconds: 7200 }))).toEqual([]);
});

test("the solves of the history give the achievements that need no more facts, with their dates", () => {
  const entry = (level: number, seconds: number, date: string, extra = {}): HistoryEntry => ({
    id: `${level}-1`,
    level,
    seconds,
    date,
    ...extra,
  });
  const store = { unlocked: {} as { [id: string]: string }, imported: false };
  const changed = importEntries(store, [
    entry(1, 250, "2026-01-01T00:00:00.000Z"),
    entry(1, 4000, "2026-01-02T00:00:00.000Z"),
    entry(2, 100, "2026-01-03T00:00:00.000Z", { autoFill: true }), // with help
    entry(3, 100, "2026-01-04T00:00:00.000Z", { practice: true }), // practice
  ]);
  expect(changed).toBe(true);
  expect(store.unlocked).toEqual({
    "level-1": "2026-01-01T00:00:00.000Z",
    "fast-1": "2026-01-01T00:00:00.000Z",
    marathon: "2026-01-02T00:00:00.000Z",
  });
  // nothing new the second time
  expect(importEntries(store, [entry(1, 200, "2026-02-01T00:00:00.000Z")])).toBe(false);
  expect(infoOfEntry(entry(1, 5, "x", { mistakes: true })).helped).toBe(true);
});

test("awarding: only new achievements, once", async () => {
  jest.resetModules();
  const m = await import("../src/achievements");
  const first = await m.awardAchievements(solve({ level: 4, pencil: false }), "2026-03-01T00:00:00.000Z");
  expect(first.map((a) => a.id)).toEqual(["level-4", "no-pencil"]);
  const second = await m.awardAchievements(solve({ level: 4, pencil: false }));
  expect(second).toEqual([]);
  const third = await m.awardAchievements(solve({ level: 5, pencil: true, practice: true }));
  expect(third).toEqual([]);
  const status = await m.achievementStatus();
  expect(status.done.map((d) => d.achievement.id).sort()).toEqual(["level-4", "no-pencil"]);
  expect(status.next.map((a) => a.id)).toEqual(["level-0", "level-1", "level-2"]);
  expect(status.total).toBe(m.ACHIEVEMENTS.length);
});
