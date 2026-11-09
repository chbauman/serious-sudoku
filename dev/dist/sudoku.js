import { t } from "./i18n.js";
const DEBUG = false;
const LEVEL_COUNT = 7;
const MAX_LEVEL = LEVEL_COUNT - 1;
function levelName(level) {
    return level >= 0 && level < LEVEL_COUNT
        ? t(`level.${level}`)
        : t("level.other", { n: level });
}
function levelNames() {
    return range(LEVEL_COUNT).map(levelName);
}
function congratulation(level) {
    if (level === -2) {
        return { title: t("cong.solver.title"), text: t("cong.solver.text") };
    }
    if (level === -1) {
        return { title: t("cong.own.title"), text: t("cong.own.text") };
    }
    if (level >= MAX_LEVEL) {
        return { title: t("cong.title"), text: t("cong.top", { level: levelName(level) }) };
    }
    return {
        title: t("cong.title"),
        text: t("cong.next", { level: levelName(level), next: levelName(level + 1) }),
    };
}
const T = Array.from(new Array(9), () => new Array(9).fill(0));
const Tsol = Array.from(new Array(9), () => new Array(9).fill(0));
const Tinit = Array.from(new Array(9), () => new Array(9).fill(0));
const Marked = Array.from(new Array(9), () => new Array(9).fill(0));
function deepCopy2D(arr) {
    const arrLen = arr.length;
    let newArr = new Array(arrLen);
    for (let i = 0; i < arrLen; i++) {
        newArr[i] = arr[i].slice();
    }
    return newArr;
}
function deepCopy3D(arr) {
    const arrLen = arr.length;
    let newArr = new Array(arrLen);
    for (let i = 0; i < arrLen; i++) {
        newArr[i] = deepCopy2D(arr[i]);
    }
    return newArr;
}
function range(n) {
    let arr = new Array(n);
    for (let i = 0; i < n; ++i) {
        arr[i] = i;
    }
    return arr;
}
function copyTo2d(srcArr, destArr) {
    const len = srcArr.length;
    for (let i = 0; i < len; i++) {
        destArr[i] = srcArr[i].slice();
    }
}
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
function checkSolved(sud) {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (sud[i][j] == 0) {
                return false;
            }
        }
    }
    return true;
}
function readSudokuFromFile(callback, lvl = MAX_LEVEL) {
    console.log("Loading file");
    const fileName = "./assets/data/ext_lvl_" + lvl.toString() + ".txt";
    fetch(fileName)
        .then((response) => response.text())
        .then((data) => {
        const items = data.split("\n");
        const nItems = items.length - 1;
        const sInd = Math.floor(Math.random() * nItems);
        callback(items[sInd], sInd);
    });
}
function squareLeftEmpty(T, Tinit, minEmpty = 5) {
    for (let b = 0; b < 9; b++) {
        const y0 = 3 * Math.floor(b / 3);
        const x0 = 3 * (b % 3);
        let empty = 0;
        let untouched = true;
        let restDone = true;
        for (let y = 0; y < 9 && untouched && restDone; y++) {
            for (let x = 0; x < 9; x++) {
                const inside = y >= y0 && y < y0 + 3 && x >= x0 && x < x0 + 3;
                if (inside) {
                    if (T[y][x] === 0)
                        empty++;
                    else if (Tinit[y][x] === 0)
                        untouched = false;
                }
                else if (T[y][x] === 0) {
                    restDone = false;
                }
            }
        }
        if (untouched && restDone && empty >= minEmpty)
            return true;
    }
    return false;
}
function gridToString(g) {
    return g.map((r) => r.join("")).join("");
}
function parseSudokuLine(line) {
    const parts = line.trim().split(";");
    if (parts.length !== 3)
        throw new Error("Invalid sudoku line: " + line);
    const toGrid = (str) => {
        const vals = str.trim().split(/\s+/).map(Number);
        if (vals.length !== 81 || vals.some((v) => !(v >= 0 && v <= 9))) {
            throw new Error("Invalid sudoku line: " + line);
        }
        return range(9).map((i) => vals.slice(9 * i, 9 * i + 9));
    };
    return { sud: toGrid(parts[1]), sol: toGrid(parts[2]) };
}
function puzzleToLine(puzzle) {
    if (!/^[0-9]{81}$/.test(puzzle))
        return null;
    const digits = puzzle.split("").map(Number);
    const { count, solution } = solveSudoku(range(9).map((i) => digits.slice(9 * i, 9 * i + 9)));
    if (count !== 1 || solution === null)
        return null;
    return "0;" + digits.join(" ") + ";" + solution.flat().join(" ");
}
function allowed(A, y, x, ignoreSet = false) {
    const res = [];
    const arr = new Array(10).fill(true);
    if (A[y][x] > 0 && !ignoreSet)
        return res;
    for (let i = 0; i < 9; i++)
        arr[A[y][i]] = false;
    for (let i = 0; i < 9; i++)
        arr[A[i][x]] = false;
    for (let i = 0; i < 9; i++)
        arr[A[y - (y % 3) + Math.floor(i / 3)][x - (x % 3) + (i % 3)]] = false;
    for (let i = 1; i < 10; i++)
        if (arr[i])
            res.push(i);
    return res;
}
function solveSudoku(grid, limit = 2) {
    const g = grid.map((row) => row.slice());
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const blocks = new Array(9).fill(0);
    for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
            const v = g[y][x];
            if (v === 0)
                continue;
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
    let solution = null;
    const popcount = (m) => {
        let n = 0;
        for (; m; m &= m - 1)
            n++;
        return n;
    };
    const search = () => {
        let bestY = -1;
        let bestX = -1;
        let bestMask = 0;
        let bestN = 10;
        for (let y = 0; y < 9 && bestN > 0; y++) {
            for (let x = 0; x < 9; x++) {
                if (g[y][x] !== 0)
                    continue;
                const b = Math.floor(y / 3) * 3 + Math.floor(x / 3);
                const mask = ~(rows[y] | cols[x] | blocks[b]) & 0x3fe;
                const n = popcount(mask);
                if (n < bestN) {
                    bestN = n;
                    bestY = y;
                    bestX = x;
                    bestMask = mask;
                    if (n === 0)
                        break;
                }
            }
        }
        if (bestY < 0) {
            count++;
            if (solution === null)
                solution = g.map((row) => row.slice());
            return;
        }
        const b = Math.floor(bestY / 3) * 3 + Math.floor(bestX / 3);
        for (let v = 1; v <= 9 && count < limit; v++) {
            const bit = 1 << v;
            if (!(bestMask & bit))
                continue;
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
function randomLineOrder() {
    return shuffle(range(3)).flatMap((band) => shuffle(range(3)).map((i) => 3 * band + i));
}
function permuteSuds(s, sudokuSol) {
    const transpose = Math.random() < 0.5;
    const digits = shuffle(range(9));
    const rows = randomLineOrder();
    const cols = randomLineOrder();
    for (const grid of [s, sudokuSol]) {
        const old = deepCopy2D(grid);
        for (let i = 0; i < 9; ++i) {
            for (let j = 0; j < 9; ++j) {
                const val = old[rows[i]][cols[j]];
                const valNew = val == 0 ? 0 : digits[val - 1] + 1;
                if (transpose)
                    grid[j][i] = valNew;
                else
                    grid[i][j] = valNew;
            }
        }
    }
}
export { LEVEL_COUNT, MAX_LEVEL, levelName, levelNames, squareLeftEmpty, congratulation, T, Tsol, Tinit, DEBUG, Marked, range, shuffle, deepCopy2D, readSudokuFromFile, parseSudokuLine, puzzleToLine, gridToString, permuteSuds, copyTo2d, allowed, solveSudoku, checkSolved, deepCopy3D, };
//# sourceMappingURL=sudoku.js.map