import * as fs from "fs";
import * as path from "path";
// This also runs the module
import {
  T,
  range,
  shuffle,
  deepCopy2D,
  permuteSuds,
  parseSudokuLine,
  gridToString,
  LEVEL_NAMES,
  MAX_LEVEL,
  congratulation,
  solveSudoku,
  levelName,
  copyTo2d,
  allowed,
  checkSolved,
  deepCopy3D,
} from "../src/sudoku";

// Checks if sudoku contains valid values
function checkSudoku(s: number[][]) {
  const n1 = s.length;
  const n2 = s[0].length;
  for (let i = 0; i < n1; ++i) {
    for (let k = 0; k < n2; ++k) {
      let el = s[i][k];
      if (el < 0 || el > 9) {
        return false;
      }
    }
  }
  return true;
}

function generateSampleSud() {
  const sud = Array.from(new Array(9), () => new Array(9).fill(0));
  sud[0] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  sud[1] = [4, 5, 6, 7, 8, 9, 1, 2, 3];
  return sud;
}

test("test T", () => {
  expect(T.length).toBe(9);
  expect(checkSudoku(T)).toBe(true);
});

test("test 3d deep copy", () => {
  const arr1 = [
    [
      [1, 2],
      [4, 5],
    ],
    [
      [3, 3],
      [6, 6],
    ],
  ];
  const arr2 = deepCopy3D(arr1);
  arr1[0][0][0] = 5;
  expect(arr2[0][0][0]).toBe(1);
});

test("test 2d deep copy", () => {
  const arr1 = [
    [1, 2, 3],
    [4, 5, 6],
  ];
  const arr2 = deepCopy2D(arr1);
  arr1[0][0] = 5;
  expect(arr2[0][0]).toBe(1);
});

test("test 2d deep copy 2", () => {
  const arr1 = [
    [1, 2, 3],
    [4, 5, 6],
  ];
  const arr2 = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  copyTo2d(arr1, arr2);
  arr1[0][0] = 5;
  expect(arr2[0][0]).toBe(1);
});

test("test shuffle", () => {
  const arr1 = [1, 2, 3, 4, 5];
  const arr2 = shuffle(arr1);
  const arrSum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  expect(arr2.length).toBe(5);
  expect(arrSum(arr2)).toBe(15);
});

test("test range", () => {
  const arr1 = [0, 1, 2, 3, 4];
  const arr2 = range(5);
  for (let i = 0; i < 5; ++i) {
    expect(arr1[i]).toBe(arr2[i]);
  }
});

test("test permute", () => {
  const sud = generateSampleSud();
  const sud2 = generateSampleSud();
  permuteSuds(sud, sud2);
});

test("test check solved", () => {
  const sud = generateSampleSud();
  expect(checkSolved(sud)).toBe(false);
  const sud2 = Array.from(new Array(9), () => new Array(9).fill(1));
  expect(checkSolved(sud2)).toBe(true);
});

test("test allowed", () => {
  const sud = generateSampleSud();
  const allNums = allowed(sud, 2, 0);
  expect(allNums.length).toBe(3);
});

const sampleLine =
  "1,25,4,4,3,3,3,2,2,2,2;" +
  "0 0 0 0 0 9 5 7 4 7 0 0 0 3 0 0 0 0 5 0 9 0 0 4 0 0 0 0 0 0 0 2 1 7 0 0 0 1 0 0 6 0 0 3 0 8 3 0 7 9 0 6 0 0 0 5 0 0 0 2 0 0 0 0 0 0 6 0 0 8 0 0 9 0 0 0 0 0 0 0 0;" +
  "1 6 3 2 8 9 5 7 4 7 4 2 5 3 6 1 8 9 5 8 9 1 7 4 3 2 6 6 9 5 3 2 1 7 4 8 2 1 7 4 6 8 9 3 5 8 3 4 7 9 5 6 1 2 3 5 8 9 1 2 4 6 7 4 2 1 6 5 7 8 9 3 9 7 6 8 4 3 2 5 1";

test("test parse sudoku line", () => {
  const { sud, sol } = parseSudokuLine(sampleLine);
  expect(sud.length).toBe(9);
  expect(sud[0].slice(5)).toEqual([9, 5, 7, 4]);
  expect(sol[1]).toEqual([7, 4, 2, 5, 3, 6, 1, 8, 9]);
  expect(() => parseSudokuLine("1,2;0 0;0 0")).toThrow();
  expect(() => parseSudokuLine("garbage")).toThrow();
});

test("test permute keeps sudoku consistent with solution", () => {
  for (let k = 0; k < 20; ++k) {
    const { sud, sol } = parseSudokuLine(sampleLine);
    permuteSuds(sud, sol);
    let nSet = 0;
    for (let i = 0; i < 9; ++i) {
      expect(new Set(sol[i]).size).toBe(9);
      expect(new Set(sol.map((r) => r[i])).size).toBe(9);
      for (let j = 0; j < 9; ++j) {
        if (sud[i][j] !== 0) {
          nSet++;
          expect(sud[i][j]).toBe(sol[i][j]);
        }
      }
    }
    expect(nSet).toBe(25);
  }
});

test("level files are consistent", () => {
  const dir = path.join(__dirname, "..", "assets", "data");
  const files = fs.readdirSync(dir).filter((f) => /^ext_lvl_\d+\.txt$/.test(f));
  expect(files.sort()).toEqual(
    range(MAX_LEVEL + 1).map((l) => `ext_lvl_${l}.txt`)
  );
  const swFile = fs.readFileSync(path.join(__dirname, "..", "src", "sw.js"), "utf8");
  expect(swFile).toContain(`length: ${MAX_LEVEL + 1}`);

  const seen = new Set<string>();
  for (let level = 0; level <= MAX_LEVEL; ++level) {
    const lines = fs
      .readFileSync(path.join(dir, `ext_lvl_${level}.txt`), "utf8")
      .split("\n");
    expect(lines.pop()).toBe(""); // file ends with a newline
    expect(lines.length).toBeGreaterThan(100);
    for (const line of lines) {
      expect(Number(line.split(",")[0])).toBe(level);
      const { sud, sol } = parseSudokuLine(line);
      const key = sud.join();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      for (let i = 0; i < 9; ++i) {
        const bi = 3 * Math.floor(i / 3);
        const box = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(
          (j) => sol[bi + Math.floor(j / 3)][3 * (i % 3) + (j % 3)]
        );
        for (const group of [sol[i], sol.map((r) => r[i]), box]) {
          expect([...group].sort().join("")).toBe("123456789");
        }
        for (let j = 0; j < 9; ++j) {
          if (sud[i][j] !== 0) expect(sud[i][j]).toBe(sol[i][j]);
        }
      }
    }
  }
});

test("test grid to string", () => {
  const { sud } = parseSudokuLine(sampleLine);
  const str = gridToString(sud);
  expect(str.length).toBe(81);
  expect(str.slice(0, 18)).toBe("000009574" + "700030000");
  expect(sampleLine.split(";")[1].replace(/ /g, "")).toBe(str);
});

// Number of givens in every row (or column), sorted
const lineCounts = (g: number[][], cols: boolean) =>
  range(9)
    .map((i) => g.filter((r, k) => (cols ? r[i] : g[i][k]) !== 0).length)
    .sort()
    .join();

test("test permute transposes sometimes", () => {
  const original = parseSudokuLine(sampleLine).sud;
  const rowCounts = lineCounts(original, false);
  const colCounts = lineCounts(original, true);
  expect(rowCounts).not.toBe(colCounts); // the sample can tell the two apart
  let transposed = 0;
  const n = 200;
  for (let k = 0; k < n; ++k) {
    const { sud, sol } = parseSudokuLine(sampleLine);
    permuteSuds(sud, sol);
    const counts = lineCounts(sud, false);
    expect([rowCounts, colCounts]).toContain(counts);
    if (counts === colCounts) ++transposed;
  }
  expect(transposed).toBeGreaterThan(n / 4);
  expect(transposed).toBeLessThan((3 * n) / 4);
});

test("test permute without randomness", () => {
  const random = jest.spyOn(Math, "random");
  try {
    // 0.99 never swaps in the shuffles: all permutations are the identity
    random.mockReturnValue(0.99);
    let { sud, sol } = parseSudokuLine(sampleLine);
    const orig = parseSudokuLine(sampleLine);
    permuteSuds(sud, sol);
    expect(sud).toEqual(orig.sud);
    expect(sol).toEqual(orig.sol);

    // The first random number decides about the transposition
    random.mockReset();
    random.mockReturnValueOnce(0.1).mockReturnValue(0.99);
    ({ sud, sol } = parseSudokuLine(sampleLine));
    permuteSuds(sud, sol);
    expect(sud).toEqual(range(9).map((i) => orig.sud.map((r) => r[i])));
    expect(sol).toEqual(range(9).map((i) => orig.sol.map((r) => r[i])));
  } finally {
    random.mockRestore();
  }
});

test("level names", () => {
  expect(LEVEL_NAMES.length).toBe(MAX_LEVEL + 1);
  expect(new Set(LEVEL_NAMES).size).toBe(LEVEL_NAMES.length);
  expect(levelName(0)).toBe(LEVEL_NAMES[0]);
  expect(levelName(MAX_LEVEL)).toBe(LEVEL_NAMES[MAX_LEVEL]);
  // levels that do not exist
  expect(levelName(7)).toBe("Level 7");
});

test("win dialog messages", () => {
  expect(congratulation(0).text).toBe(
    `${LEVEL_NAMES[0]} done. Ready for ${LEVEL_NAMES[1]}?`
  );
  expect(congratulation(MAX_LEVEL - 1).text).toContain(LEVEL_NAMES[MAX_LEVEL]);
  expect(congratulation(MAX_LEVEL).text).toContain("hardest");
  expect(congratulation(-1).title).toBe("Your sudoku is solved");
  expect(congratulation(-2).title).toBe("Solved with the solver");
  for (let level = -2; level <= MAX_LEVEL; ++level) {
    const { title, text } = congratulation(level);
    expect(title.length).toBeGreaterThan(0);
    expect(text).not.toContain("undefined");
  }
});

describe("solver for custom sudokus", () => {
  const dataDir = path.join(__dirname, "..", "assets", "data");
  const emptyGrid = () => range(9).map(() => new Array(9).fill(0));

  test("finds the solution of the sudokus of the level files", () => {
    for (let level = 0; level <= MAX_LEVEL; ++level) {
      const lines = fs
        .readFileSync(path.join(dataDir, `ext_lvl_${level}.txt`), "utf8")
        .split("\n")
        .filter((l) => l.trim());
      for (const line of lines.slice(0, 15)) {
        const { sud, sol } = parseSudokuLine(line);
        const res = solveSudoku(sud);
        expect(res.count).toBe(1);
        expect(res.solution).toEqual(sol);
      }
    }
  });

  test("a solved sudoku has the one solution, the input is not changed", () => {
    const { sud, sol } = parseSudokuLine(
      fs.readFileSync(path.join(dataDir, "ext_lvl_0.txt"), "utf8").split("\n")[0]
    );
    const before = deepCopy2D(sud);
    expect(solveSudoku(sol)).toEqual({ count: 1, solution: sol });
    solveSudoku(sud);
    expect(sud).toEqual(before);
  });

  test("an empty grid and a sudoku with a removed digit pair are not unique", () => {
    expect(solveSudoku(emptyGrid()).count).toBe(2);
    expect(solveSudoku(emptyGrid(), 5).count).toBe(5);
    // two solutions: swap the 1 and 2 in a solved grid, with only these digits missing
    const { sol } = parseSudokuLine(
      fs.readFileSync(path.join(dataDir, "ext_lvl_0.txt"), "utf8").split("\n")[0]
    );
    const g = deepCopy2D(sol);
    // remove all digits 1 and 2: both can be exchanged, so there are at least 2 solutions
    for (const row of g) for (let x = 0; x < 9; x++) if (row[x] <= 2) row[x] = 0;
    expect(solveSudoku(g).count).toBe(2);
  });

  test("contradicting givens and unsolvable sudokus have no solution", () => {
    const twoInRow = emptyGrid();
    twoInRow[0][0] = 5;
    twoInRow[0][4] = 5;
    expect(solveSudoku(twoInRow)).toEqual({ count: 0, solution: null });
    const twoInBlock = emptyGrid();
    twoInBlock[0][0] = 3;
    twoInBlock[2][2] = 3;
    expect(solveSudoku(twoInBlock).count).toBe(0);
    // no conflict in a row, column or block, but cell (0, 8) has no candidate left
    const stuck = emptyGrid();
    [1, 2, 3, 4, 5, 6, 7, 8].forEach((v, i) => (stuck[0][i] = v));
    stuck[1][8] = 9;
    expect(solveSudoku(stuck)).toEqual({ count: 0, solution: null });
  });
});
