const DEBUG = false;

// Names of the levels, from the easiest (level 0) to the hardest. The levels
// are the numbers of the files assets/data/ext_lvl_<level>.txt (see
// scripts/make-levels.mjs), so a new name needs a new file.
const LEVEL_NAMES = [
  "Beginner",
  "Easy",
  "Medium",
  "Hard",
  "Expert",
  "Master",
  "Grandmaster",
];

// Highest level of the sudokus (levels are 0 to MAX_LEVEL)
const MAX_LEVEL = LEVEL_NAMES.length - 1;

// Name of a level (levels that do not exist are shown as "Level <n>")
function levelName(level: number): string {
  return LEVEL_NAMES[level] ?? `Level ${level}`;
}

// Message of the win dialog. level: the level of the sudoku that was solved,
// -1 for a custom sudoku, -2 if the solver was used.
function congratulation(level: number): { title: string; text: string } {
  if (level === -2) {
    return { title: "Solved with the solver", text: "Try the next one without it." };
  }
  if (level === -1) {
    return { title: "Your sudoku is solved", text: "Well done." };
  }
  if (level >= MAX_LEVEL) {
    return {
      title: "Solved!",
      text: `${levelName(level)} is the hardest level. There is nothing left to beat.`,
    };
  }
  return {
    title: "Solved!",
    text: `${levelName(level)} done. Ready for ${levelName(level + 1)}?`,
  };
}

// Arrays to store the current sudoku
// T stores the currently set numbers
const T: number[][] = Array.from(new Array(9), () => new Array(9).fill(0));
// Tsol stores the solution if available
const Tsol: number[][] = Array.from(new Array(9), () => new Array(9).fill(0));
// Tinit stores the initial sudoku
const Tinit: number[][] = Array.from(new Array(9), () => new Array(9).fill(0));

// 0: Normal
// 1: Wrong (checked)
// 2: Current Hypothesis
// 3: Current Hypothesis Wrong (checked)
const Marked: number[][] = Array.from(new Array(9), () => new Array(9).fill(0));

// 2D and 3D array deep copy functions
function deepCopy2D(arr: any[][]): any[][] {
  const arrLen = arr.length;
  let newArr = new Array(arrLen);
  for (let i = 0; i < arrLen; i++) {
    newArr[i] = arr[i].slice();
  }
  return newArr;
}
function deepCopy3D(arr: any[][][]): any[][][] {
  const arrLen = arr.length;
  let newArr = new Array(arrLen);
  for (let i = 0; i < arrLen; i++) {
    newArr[i] = deepCopy2D(arr[i]);
  }
  return newArr;
}

/** Create an array with numbers from 0 to n-1 */
function range(n: number): number[] {
  let arr = new Array(n);
  for (let i = 0; i < n; ++i) {
    arr[i] = i;
  }
  return arr;
}
function copyTo2d(srcArr: any[][], destArr: any[][]) {
  const len = srcArr.length;
  for (let i = 0; i < len; i++) {
    destArr[i] = srcArr[i].slice();
  }
}

// Shuffle array
function shuffle(array: any[]): any[] {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Maybe not sufficient, checks if all digits are set
function checkSolved(sud: number[][]) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (sud[i][j] == 0) {
        return false;
      }
    }
  }
  return true;
}

// Reads a random sudoku from the file and loads it.
function readSudokuFromFile(
  callback: (s: string, index: number) => void,
  lvl = MAX_LEVEL
) {
  console.log("Loading file");
  const fileName = "../assets/data/ext_lvl_" + lvl.toString() + ".txt";
  fetch(fileName)
    .then((response) => response.text())
    .then((data) => {
      const items = data.split("\n");
      const nItems = items.length - 1;
      const sInd = Math.floor(Math.random() * nItems);
      callback(items[sInd], sInd);
    });
}

// The grid as a string of its 81 digits, row by row (0 = empty)
function gridToString(g: number[][]): string {
  return g.map((r) => r.join("")).join("");
}

// Parses a line of a level file: "<description>;<puzzle>;<solution>" where
// puzzle and solution are the 81 space separated cell values (0 = empty),
// row by row (the format of the generator in sudoku-cpp).
function parseSudokuLine(line: string): { sud: number[][]; sol: number[][] } {
  const parts = line.trim().split(";");
  if (parts.length !== 3) throw new Error("Invalid sudoku line: " + line);
  const toGrid = (str: string) => {
    const vals = str.trim().split(/\s+/).map(Number);
    if (vals.length !== 81 || vals.some((v) => !(v >= 0 && v <= 9))) {
      throw new Error("Invalid sudoku line: " + line);
    }
    return range(9).map((i) => vals.slice(9 * i, 9 * i + 9));
  };
  return { sud: toGrid(parts[1]), sol: toGrid(parts[2]) };
}

// Finds all numbers that can be set in cell (x, y)
function allowed(A: number[][], y: number, x: number, ignoreSet = false) {
  const res: number[] = [];
  const arr: boolean[] = new Array(10).fill(true);
  if (A[y][x] > 0 && !ignoreSet) return res;
  for (let i = 0; i < 9; i++) arr[A[y][i]] = false;
  for (let i = 0; i < 9; i++) arr[A[i][x]] = false;
  for (let i = 0; i < 9; i++)
    arr[A[y - (y % 3) + Math.floor(i / 3)][x - (x % 3) + (i % 3)]] = false;
  for (let i = 1; i < 10; i++) if (arr[i]) res.push(i);
  return res;
}

// Solves a sudoku (0 = empty) by backtracking, always filling the cell with the
// fewest candidates. Stops after `limit` solutions, so the count is exact up to
// the limit (2 is enough to tell whether the solution is unique). The solution
// is the first one found, null if there is none. Contradicting givens give 0.
function solveSudoku(
  grid: number[][],
  limit = 2
): { count: number; solution: number[][] | null } {
  const g = grid.map((row) => row.slice());
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const blocks = new Array(9).fill(0);
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const v = g[y][x];
      if (v === 0) continue;
      const bit = 1 << v;
      const b = Math.floor(y / 3) * 3 + Math.floor(x / 3);
      if (!(v >= 1 && v <= 9) || (rows[y] | cols[x] | blocks[b]) & bit) {
        return { count: 0, solution: null };
      }
      rows[y] |= bit;
      cols[x] |= bit;
      blocks[b] |= bit;
    }
  }

  let count = 0;
  let solution: number[][] | null = null;
  const popcount = (m: number) => {
    let n = 0;
    for (; m; m &= m - 1) n++;
    return n;
  };
  const search = () => {
    // Cell with the fewest candidates
    let bestY = -1;
    let bestX = -1;
    let bestMask = 0;
    let bestN = 10;
    for (let y = 0; y < 9 && bestN > 0; y++) {
      for (let x = 0; x < 9; x++) {
        if (g[y][x] !== 0) continue;
        const b = Math.floor(y / 3) * 3 + Math.floor(x / 3);
        const mask = ~(rows[y] | cols[x] | blocks[b]) & 0x3fe;
        const n = popcount(mask);
        if (n < bestN) {
          bestN = n;
          bestY = y;
          bestX = x;
          bestMask = mask;
          if (n === 0) break;
        }
      }
    }
    if (bestY < 0) {
      count++;
      if (solution === null) solution = g.map((row) => row.slice());
      return;
    }
    const b = Math.floor(bestY / 3) * 3 + Math.floor(bestX / 3);
    for (let v = 1; v <= 9 && count < limit; v++) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      g[bestY][bestX] = v;
      rows[bestY] |= bit;
      cols[bestX] |= bit;
      blocks[b] |= bit;
      search();
      g[bestY][bestX] = 0;
      rows[bestY] &= ~bit;
      cols[bestX] &= ~bit;
      blocks[b] &= ~bit;
    }
  };
  search();
  return { count, solution };
}

// Random order of the 9 rows (or columns) that keeps the bands (stacks):
// the 3 bands are shuffled, and the 3 lines within each band.
function randomLineOrder(): number[] {
  return shuffle(range(3)).flatMap((band) =>
    shuffle(range(3)).map((i) => 3 * band + i)
  );
}

// Shuffles the sudoku s and its solution sudokuSol (in place) with the same
// random transformation, which keeps the solution valid and the sudoku as hard
// as it was: the digits are relabeled, the rows are shuffled within their
// bands and the bands among each other, the same for the columns and stacks,
// and the grid is transposed with probability 1/2. These are all symmetries
// of the sudoku rules.
function permuteSuds(s: number[][], sudokuSol: number[][]) {
  const transpose = Math.random() < 0.5;
  const digits = shuffle(range(9));
  const rows = randomLineOrder();
  const cols = randomLineOrder();

  for (const grid of [s, sudokuSol]) {
    const old = deepCopy2D(grid);
    for (let i = 0; i < 9; ++i) {
      for (let j = 0; j < 9; ++j) {
        const val = old[rows[i]][cols[j]];
        const valNew = val == 0 ? 0 : digits[val - 1] + 1; // 0 = empty
        if (transpose) grid[j][i] = valNew;
        else grid[i][j] = valNew;
      }
    }
  }
}

// Export
export {
  LEVEL_NAMES,
  MAX_LEVEL,
  levelName,
  congratulation,
  T,
  Tsol,
  Tinit,
  DEBUG,
  Marked,
  range,
  shuffle,
  deepCopy2D,
  readSudokuFromFile,
  parseSudokuLine,
  gridToString,
  permuteSuds,
  copyTo2d,
  allowed,
  solveSudoku,
  checkSolved,
  deepCopy3D,
};
