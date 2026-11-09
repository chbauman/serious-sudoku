import {
  ACHIEVEMENTS,
  earnedBy,
  importEntries,
  infoOfEntry,
  SolveInfo,
} from "../src/achievements";
import { HistoryEntry } from "../src/history";
import { LEVEL_COUNT, squareLeftEmpty } from "../src/sudoku";

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
  expect(ids(solve({ squareLast: false }))).not.toContain("empty-square");
  expect(ids(solve({ squareLast: true }))).toContain("empty-square");
});

test("one square left empty", () => {
  const full = (): number[][] => Array.from({ length: 9 }, () => new Array(9).fill(5));
  const given = full();
  // the square at the top left: two given digits, the other 7 cells are for the player
  const init = full().map((r) => r.map(() => 0));
  const board = full();
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) board[y][x] = 0;
  }
  board[0][0] = 5;
  board[1][1] = 5;
  init[0][0] = 5;
  init[1][1] = 5;
  expect(squareLeftEmpty(board, init)).toBe(true);
  // the player set a digit in the square
  const touched = board.map((r) => r.slice());
  touched[2][2] = 5;
  expect(squareLeftEmpty(touched, init)).toBe(false);
  // another cell of the rest is still empty
  const open = board.map((r) => r.slice());
  open[8][8] = 0;
  expect(squareLeftEmpty(open, init)).toBe(false);
  // too few empty cells (a trivial last square), the board is complete
  expect(squareLeftEmpty(board, init, 7)).toBe(true);
  expect(squareLeftEmpty(board, init, 8)).toBe(false);
  expect(squareLeftEmpty(given, init)).toBe(false);
});

test("practice solves and solves with help only earn their own achievements", () => {
  expect(ids(solve({ practice: true, pencil: false }))).toEqual(["practice"]);
  expect(ids(solve({ helped: true, fill: true, pencil: false, seconds: 7200 }))).toEqual(["wand"]);
  expect(ids(solve({ helped: true, mistakes: true, level: 0, seconds: 10 }))).toEqual(["detective"]);
  expect(ids(solve({ helped: true, fill: true, mistakes: true, practice: true }))).toEqual([
    "practice",
    "wand",
    "detective",
  ]);
  // without them none of the three
  expect(ids(solve())).not.toContain("practice");
  expect(ids(solve())).not.toContain("wand");
  expect(ids(solve())).not.toContain("detective");
});

test("the solves of the history give the achievements that their facts allow, with their dates", () => {
  const entry = (level: number, seconds: number, date: string, extra = {}): HistoryEntry => ({
    id: `${level}-1`,
    level,
    seconds,
    date,
    ...extra,
  });
  const store = { unlocked: {} as { [id: string]: string } };
  const changed = importEntries(store, [
    entry(1, 250, "2026-01-01T00:00:00.000Z"),
    entry(1, 4000, "2026-01-02T00:00:00.000Z"),
    entry(2, 100, "2026-01-03T00:00:00.000Z", { autoFill: true }), // with help
    entry(3, 100, "2026-01-04T00:00:00.000Z", { practice: true }), // practice
    entry(3, 100, "2026-01-05T00:00:00.000Z", { mistakes: true }),
  ]);
  expect(changed).toBe(true);
  expect(store.unlocked).toEqual({
    "level-1": "2026-01-01T00:00:00.000Z",
    "fast-1": "2026-01-01T00:00:00.000Z",
    marathon: "2026-01-02T00:00:00.000Z",
    wand: "2026-01-03T00:00:00.000Z",
    practice: "2026-01-04T00:00:00.000Z",
    detective: "2026-01-05T00:00:00.000Z",
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
  expect(third.map((a) => a.id)).toEqual(["practice"]);
  const status = await m.achievementStatus();
  expect(status.done.map((d) => d.achievement.id).sort()).toEqual(["level-4", "no-pencil", "practice"]);
  expect(status.next.map((a) => a.id)).toEqual(["level-0", "level-1", "level-2"]);
  expect(status.total).toBe(m.ACHIEVEMENTS.length);
});

test("the unlocked ones: the latest first, the harder one first for the same solve", async () => {
  jest.resetModules();
  const m = await import("../src/achievements");
  await m.awardAchievements(solve({ level: 1, seconds: 100 }), "2026-03-01T00:00:00.000Z");
  await m.awardAchievements(solve({ level: 3, seconds: 200 }), "2026-03-02T00:00:00.000Z");
  const status = await m.achievementStatus();
  expect(status.done.map((d) => d.achievement.id)).toEqual(["fast-3", "level-3", "fast-1", "level-1"]);
});
