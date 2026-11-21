import {
  ACHIEVEMENTS,
  earnedBy,
  importEntries,
  infoOfEntry,
  SolveInfo,
} from "../src/achievements";
import * as fs from "fs";
import * as path from "path";
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
    "no-pencil",
    `level-${top}`,
    "no-pencil-top",
    `fast-${top}`,
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

test("one square left empty: completely empty, a square without a given digit", () => {
  const full = (): number[][] => Array.from({ length: 9 }, () => new Array(9).fill(5));
  const init = full().map((r) => r.map(() => 0));
  // the square at the top left is empty, the rest of the board is filled in
  const board = full();
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) board[y][x] = 0;
  }
  expect(squareLeftEmpty(board, init)).toBe(true);
  // the player set a digit in the square
  const touched = board.map((r) => r.slice());
  touched[2][2] = 5;
  expect(squareLeftEmpty(touched, init)).toBe(false);
  // another cell of the rest is still empty
  const open = board.map((r) => r.slice());
  open[8][8] = 0;
  expect(squareLeftEmpty(open, init)).toBe(false);
  // a given digit in the square: not completely empty (9 cells are required)
  const withGiven = board.map((r) => r.slice());
  withGiven[0][0] = 5;
  const initGiven = init.map((r) => r.slice());
  initGiven[0][0] = 5;
  expect(squareLeftEmpty(withGiven, initGiven)).toBe(false);
  expect(squareLeftEmpty(withGiven, initGiven, 8)).toBe(true);
  // the board is complete
  expect(squareLeftEmpty(full(), init)).toBe(false);
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
  const store = { unlocked: {} as { [id: string]: string }, solved: 0 };
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
  expect(first.map((a) => a.id)).toEqual(["no-pencil", "level-4"]);
  const second = await m.awardAchievements(solve({ level: 4, pencil: false }));
  expect(second).toEqual([]);
  const third = await m.awardAchievements(solve({ level: 5, pencil: true, practice: true }));
  expect(third.map((a) => a.id)).toEqual(["practice"]);
  const status = await m.achievementStatus();
  expect(status.done.map((d) => d.achievement.id).sort()).toEqual(["level-4", "no-pencil", "practice"]);
  expect(status.next.map((a) => a.id)).toEqual(["level-0", "wand", "detective"]);
  expect(status.total).toBe(m.ACHIEVEMENTS.length);
});

test("the unlocked ones: the hardest first, not by date", async () => {
  jest.resetModules();
  const m = await import("../src/achievements");
  await m.awardAchievements(solve({ level: 3, seconds: 200 }), "2026-03-01T00:00:00.000Z");
  await m.awardAchievements(solve({ level: 1, seconds: 100 }), "2026-03-02T00:00:00.000Z");
  const status = await m.achievementStatus();
  // the order of the list (difficulty) reversed, whatever the dates
  expect(status.done.map((d) => d.achievement.id)).toEqual(["fast-3", "level-3", "fast-1", "level-1"]);
  expect(status.done[0].date).toBe("2026-03-01T00:00:00.000Z");
});

test("guesses: none on a high level, the first one, a rejected one", () => {
  // no guess: from Hard on, and only when it is known that there was none
  expect(ids(solve({ level: 3, guessDepth: 0 }))).toContain("no-guess");
  expect(ids(solve({ level: 6, guessDepth: 0 }))).toContain("no-guess");
  expect(ids(solve({ level: 2, guessDepth: 0 }))).not.toContain("no-guess");
  expect(ids(solve({ level: 3, guessDepth: 1 }))).not.toContain("no-guess");
  expect(ids(solve({ level: 3 }))).not.toContain("no-guess"); // unknown (old saved game)
  // first guess
  expect(ids(solve({ guessDepth: 0 }))).not.toContain("first-guess");
  expect(ids(solve({}))).not.toContain("first-guess");
  expect(ids(solve({ guessDepth: 1 }))).toContain("first-guess");
  expect(ids(solve({ guessDepth: 5 }))).toContain("first-guess");
  // rejected a guess
  expect(ids(solve({ rejected: false }))).not.toContain("reject");
  expect(ids(solve({ rejected: true }))).toContain("reject");
});

test("replay", () => {
  expect(ids(solve({ replayed: true }))).toContain("replay");
  expect(ids(solve({ replayed: false }))).not.toContain("replay");
  // like any other solve: not with help
  expect(ids(solve({ replayed: true, helped: true }))).not.toContain("replay");
});

test("an own sudoku only earns its achievement, and only without help", () => {
  const own = (extra: Partial<SolveInfo> = {}): SolveInfo => ({
    level: -1,
    seconds: 0,
    practice: false,
    helped: false,
    own: true,
    pencil: false,
    ...extra,
  });
  expect(ids(own())).toEqual(["own"]);
  expect(ids(own({ helped: true, fill: true }))).toEqual([]);
  // the normal solves never earn it
  expect(ids(solve({ pencil: false }))).not.toContain("own");
});

test("the total of solved sudokus without help: 10, 20, 50, 100", () => {
  for (const [total, expected] of [
    [9, []],
    [10, ["total-10"]],
    [20, ["total-10", "total-20"]],
    [49, ["total-10", "total-20"]],
    [50, ["total-10", "total-20", "total-50"]],
    [100, ["total-10", "total-20", "total-50", "total-100"]],
  ] as [number, string[]][]) {
    expect(ids(solve({ total })).filter((id) => id.startsWith("total-"))).toEqual(expected);
  }
  expect(ids(solve({}))).not.toContain("total-10"); // unknown
  // practice and help: only if they are counted as solved without help, and they are not
  expect(ids(solve({ total: 10, practice: true }))).not.toContain("total-10");
  expect(ids(solve({ total: 10, helped: true }))).not.toContain("total-10");
});

test("the history counts the solves without help, the date is the one of the 10th", () => {
  const entries: HistoryEntry[] = [];
  for (let i = 0; i < 14; i++) {
    const day = String(i + 1).padStart(2, "0");
    entries.push({
      id: `1-${i}`,
      level: 1,
      seconds: 400,
      date: `2026-01-${day}T00:00:00.000Z`,
      // the 3rd and the 5th are with help, the 7th in practice mode: not counted
      ...(i === 2 || i === 4 ? { autoFill: true } : {}),
      ...(i === 6 ? { practice: true } : {}),
    });
  }
  const store = { unlocked: {} as { [id: string]: string }, solved: 0 };
  importEntries(store, entries);
  // 14 - 3 = 11 count, the 10th of them is the 13th entry
  expect(store.solved).toBe(11);
  expect(store.unlocked["total-10"]).toBe("2026-01-13T00:00:00.000Z");
  expect(store.unlocked["total-20"]).toBeUndefined();
  // what was counted before stays when the history has fewer (it keeps only the last ones)
  store.solved = 30;
  importEntries(store, entries.slice(0, 3));
  expect(store.solved).toBe(30);
});

test("awarding counts the solves, also when the history is empty", async () => {
  jest.resetModules();
  const m = await import("../src/achievements");
  let last: string[] = [];
  for (let i = 0; i < 10; i++) {
    last = (await m.awardAchievements(solve({ level: 1 }), `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`)).map((a) => a.id);
  }
  expect(last).toContain("total-10");
  // a practice solve is not counted, 10 more are
  await m.awardAchievements(solve({ practice: true }));
  let res: string[] = [];
  for (let i = 0; i < 10; i++) res = (await m.awardAchievements(solve({ level: 1 }))).map((a) => a.id);
  expect(res).toEqual(["total-20"]);
});

test("the order is the order of difficulty: every achievement once, the first ones are the easy ones", () => {
  const order = ACHIEVEMENTS.map((a) => a.id);
  expect(new Set(order).size).toBe(order.length);
  expect(order.length).toBe(32);
  expect(order.slice(0, 3)).toEqual(["level-0", "practice", "wand"]);
  // the levels and the under 5 minutes ones in the order of the levels
  for (const kind of ["level", "fast"]) {
    const levels = order.filter((id) => id.startsWith(kind + "-")).map((id) => Number(id.split("-")[1]));
    expect(levels).toEqual([0, 1, 2, 3, 4, 5, 6]);
  }
  const totals = order.filter((id) => id.startsWith("total-")).map((id) => Number(id.split("-")[1]));
  expect(totals).toEqual([10, 20, 50, 100]);
  // faster than 5 minutes after solving the level, the top level without pencil marks last but the luck
  expect(order.indexOf("level-3")).toBeLessThan(order.indexOf("fast-3"));
  expect(order.indexOf("level-6")).toBeLessThan(order.indexOf("fast-6"));
  expect(order.indexOf("no-pencil")).toBeLessThan(order.indexOf("no-pencil-top"));
  expect(order.slice(-2)).toEqual(["empty-square", "one-digit"]);
});

test("the table of the README is the list of the achievements", () => {
  const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
  const m = /<!-- achievements:start[^>]*-->\n([\s\S]*?)\n<!-- achievements:end -->/.exec(readme);
  expect(m).not.toBeNull();
  const rows = m![1].split("\n").slice(2); // without the header
  expect(rows).toEqual(
    ACHIEVEMENTS.map((a, i) => `| ${i + 1} | ${a.title()} | ${a.text()} |`)
  );
});
