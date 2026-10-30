// Import sudoku module
import {
  LEVEL_NAMES,
  MAX_LEVEL,
  levelName,
  congratulation,
  T,
  DEBUG,
  Marked,
  readSudokuFromFile,
  Tsol,
  Tinit,
  permuteSuds,
  parseSudokuLine,
  gridToString,
  copyTo2d,
  allowed,
  checkSolved,
  deepCopy2D,
  deepCopy3D,
} from "./sudoku.js";
import { storageGet, storageSet, storageRemove } from "./storage.js";
import { settings, loadSettings } from "./settings.js";
import { currentPage } from "./pages.js";
import { HistoryEntry, recordSolve, formatTime } from "./history.js";

// Colors
const col1 = "var(--accent)";
const smallDigCol = "var(--small-dig-bg)";
const rowColSquareForbidCol = "var(--forbid-bg)";
const sameDigCol = "var(--same-bg)";
const hypCol = "var(--hyp)";
const normH = "var(--selected-bg)";
const wrongHypCol = "var(--wrong)";

// State variables
let large = true;
let smallDigsEnabled = true;
let curX = -1;
let curY = 0;
let solAvailable = false;
let inputtingOwnSud = false;
let sudLvl: number;

// Solve time: measured while the game page is visible
let puzzleId: string | null = null; // null for custom sudokus
// The sudoku as in the level file (before shuffling), see gridToString()
let puzzleStr: string | null = null;
// The pencil marks were filled in automatically (the magic wand) in this game
let autoFillUsed = false;
let timing = false;
let elapsedMs = 0;
let lastTick = Date.now();
let choosingHyp = false;
let hypRejectionEnabled = false;

let hyps: any[][][] = [];

// Array with html table cell elements
const Tref: HTMLTableCellElement[][] = Array.from(
  new Array(9),
  () => new Array(9)
);

// Click handlers of the digit buttons, replaced whenever the selected cell changes
const digitHandlers: ((e: Event) => void)[] = [];

// Array with digit buttons
const digits = new Array(10);

// Pencil mark marker arrays
const TsubHTMLTables = Array.from(new Array(9), () => new Array(9));
let TsubBinaryTables: boolean[][][] = Array.from(
  new Array(9),
  () => new Array(9)
);
const TminiCells = Array.from(new Array(9), () => new Array(9));

// Map containing html elements
const htmlButtonDict: Map<string, HTMLElement> = new Map();
const getAssertedButton = (name: string) => {
  const res = htmlButtonDict.get(name);
  if (res === undefined) {
    throw new Error("Undefined button!");
  }
  return res;
};

// Logging
function log(msg: string) {
  if (DEBUG) {
    console.log(msg);
  }
}

// Dialogs (native <dialog> elements)
function openDialog(id: string) {
  const dlg = document.getElementById(id) as HTMLDialogElement;
  if (!dlg.open) dlg.showModal();
}
function closeDialog(id: string) {
  (document.getElementById(id) as HTMLDialogElement).close();
}

// Wires up dialogs: [data-open] opens, [data-close] closes the enclosing
// dialog, clicking the backdrop dismisses (except for persistent dialogs).
function setupDialogs() {
  document.querySelectorAll<HTMLElement>("[data-open]").forEach((el) =>
    el.addEventListener("click", () => openDialog(el.dataset.open!))
  );
  document.querySelectorAll<HTMLElement>("[data-close]").forEach((el) =>
    el.addEventListener("click", () => el.closest("dialog")!.close())
  );
  document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dlg) => {
    const persistent = dlg.hasAttribute("data-persistent");
    dlg.addEventListener("click", (e) => {
      const r = dlg.getBoundingClientRect();
      const outside =
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom;
      if (outside && !persistent) dlg.close();
    });
    if (persistent) dlg.addEventListener("cancel", (e) => e.preventDefault());
  });
}

// Uniform button states (see .active / .disabled in style.css):
// toggle buttons are "active" while their mode is on, any button can be
// disabled.
function setActive(id: string, on: boolean) {
  getAssertedButton(id).classList.toggle("active", on);
}
function setEnabled(id: string, on: boolean) {
  getAssertedButton(id).classList.toggle("disabled", !on);
}

// Change digit input mode (large digits <-> pencil marks)
function toggleLargeSmall() {
  large = !large;
  setActive("mode-but", !large);
}
function enlarge(e: Event | undefined = undefined) {
  if (!large) {
    toggleLargeSmall();
    log("enlarged");
  }
  if (e) e.stopPropagation();
}
function shrink(e: Event | undefined = undefined) {
  if (large) {
    toggleLargeSmall();
    log("shrunken");
  }
  if (e) e.stopPropagation();
}

// Initialize grid
function initGrid(tbl: HTMLTableElement) {
  // Build html structure
  for (let i = 0; i < 9; i++) {
    const row = tbl.insertRow(-1);
    row.className = "gridRow";
    for (let j = 0; j < 9; j++) {
      Tref[i][j] = row.insertCell(-1);
      Tref[i][j].className = "gridCell";
      if (i % 3 == 0) Tref[i][j].className += " topBorder";
      if (i % 3 == 2) Tref[i][j].className += " bottomBorder";
      if (j % 3 == 0) Tref[i][j].className += " leftBorder";
      if (j % 3 == 2) Tref[i][j].className += " rightBorder";
      const y = document.createAttribute("y");
      const x = document.createAttribute("x");
      const click = document.createAttribute("clickable");
      const subTab = document.createElement("table");
      click.value = "0";
      y.value = i.toString();
      x.value = j.toString();
      Tref[i][j].setAttributeNode(y);
      Tref[i][j].setAttributeNode(x);
      Tref[i][j].setAttributeNode(click);

      TminiCells[i][j] = new Array(9);
      subTab.className = "innerTable";
      let subRow: HTMLTableRowElement | null = null;
      let subCell: HTMLTableCellElement;
      for (let k = 0; k < 9; k++) {
        if (k % 3 == 0) {
          subRow = subTab.insertRow(-1);
          subRow.className = "gridRow";
        }
        subCell = subRow!.insertCell(-1);
        subCell.innerHTML = "";
        subCell.className = "subGridCell";
        TminiCells[i][j][k] = subCell;
      }
      Tref[i][j].appendChild(subTab);

      TsubHTMLTables[i][j] = subTab;
      TsubBinaryTables[i][j] = new Array(9).fill(false);
    }
  }

  // Solve timer; the time is saved when the page is hidden
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveGame();
  });
  window.addEventListener("pagehide", saveGame);

  // Load sudoku
  setTimeout(function () {
    loadSettings()
      .then(loadGame)
      .then((loaded) => {
        if (!loaded) loadRandomSud(settings.level);
      });
  }, 250);
}

// Fills the list of the levels (new sudoku dialog), clicking a level loads a
// sudoku of it
function setLevelFun() {
  const ulEl = getAssertedButton("lvl_list");
  LEVEL_NAMES.forEach((name, level) => {
    const li = document.createElement("li");
    li.textContent = name;
    li.addEventListener("click", () => loadRandomSud(level));
    ulEl.appendChild(li);
  });
}

function startHyp(e: Event) {
  hypothesis1();
  e.stopPropagation();
}

// Asks for confirmation before running a destructive action
let pendingConfirm: (() => void) | null = null;
function confirmAction(
  title: string,
  description: string,
  action: () => void
) {
  pendingConfirm = action;
  getAssertedButton("confirm-title").textContent = title;
  getAssertedButton("confirm-desc").textContent = description;
  openDialog("confirm");
}

// "Mark mistakes" and "Solve" need the solution, which custom sudokus lack
function updateToolButtons() {
  setEnabled("check", solAvailable);
  setEnabled("solve", solAvailable);
  getAssertedButton("tools-note").hidden = solAvailable;
}

// While a custom sudoku is entered, the tools button is highlighted and the
// entry in the tools dialog finishes the input; restarting makes no sense then
function updateOwnInputUi() {
  getAssertedButton("own-sud-text").textContent = inputtingOwnSud
    ? "Finish input"
    : "Input own sudoku";
  getAssertedButton("own_sud")
    .querySelector("use")!
    .setAttribute("href", inputtingOwnSud ? "#i-checkmark-circle-outline" : "#i-create-outline");
  setActive("tools-btn", inputtingOwnSud);
  setEnabled("tools-restart", !inputtingOwnSud);
  setEnabled("auto-fill-button", !inputtingOwnSud);
  // The guess buttons make no sense while the digits are entered, the check
  // mark finishes the input instead
  getAssertedButton("but1").hidden = inputtingOwnSud;
  getAssertedButton("but3").hidden = inputtingOwnSud;
  getAssertedButton("finish-input").hidden = !inputtingOwnSud;
}

// Sets functionality to the buttons
function setButtons() {
  setupDialogs();

  // Digit buttons: dispatch to the handler of the clicked digit
  getAssertedButton("digits").addEventListener("click", (e) => {
    const btn = (e.target as Element).closest<HTMLElement>("[id^='digit-']");
    if (btn) pressDigit(Number(btn.id.slice("digit-".length)), e);
  });
  document.addEventListener("keydown", onKeyDown);

  // Undo button
  getAssertedButton("undo-but").addEventListener("click", (e) => {
    undo();
    e.stopPropagation(); // keep the selected cell
  });
  updateUndoButton();

  // Pencil mark toggle
  getAssertedButton("mode-but").addEventListener("click", (e) => {
    if (smallDigsEnabled) large ? shrink() : enlarge();
    e.stopPropagation(); // keep the selected cell
  });
  enableSmallDigs();

  // Restart button
  function restAndClose(e: Event) {
    restart();
    closeDialog("restart");
    e.stopPropagation();
  }
  getAssertedButton("restart_but").addEventListener("click", restAndClose);
  getAssertedButton("tools-restart").addEventListener("click", () => {
    if (inputtingOwnSud) return;
    closeDialog("tools");
    openDialog("restart");
  });

  // Confirmation dialog
  getAssertedButton("confirm-yes").addEventListener("click", (e) => {
    const action = pendingConfirm;
    pendingConfirm = null;
    closeDialog("confirm");
    if (action) action();
    e.stopPropagation();
  });
  getAssertedButton("confirm-cancel").addEventListener("click", (e) => {
    pendingConfirm = null;
    closeDialog("confirm");
    e.stopPropagation();
  });

  // Check mark: finishes the input of a custom sudoku
  getAssertedButton("finish-input").addEventListener("click", () => {
    if (inputtingOwnSud) inputCustomSudoku();
  });
  getAssertedButton("auto-fill-button").addEventListener("click", () => {
    if (inputtingOwnSud) return;
    closeDialog("tools");
    confirmAction(
      "Fill in pencil marks?",
      "Adds all digits that are still possible as pencil marks to every empty cell.",
      () => {
        autoFillUsed = true;
        withUndo(fillSmallDigits);
      }
    );
  });

  // Custom sudoku import: only the first click (clearing the grid) needs
  // confirmation, the second click finishes the input.
  getAssertedButton("own_sud").addEventListener("click", () => {
    closeDialog("tools");
    if (inputtingOwnSud) {
      inputCustomSudoku();
    } else {
      confirmAction(
        "Empty grid?",
        "Add your own sudoku. Current game will be lost.",
        inputCustomSudoku
      );
    }
  });

  // Hypothesis
  enableHyp();
  disableHypRejection();
  getAssertedButton("but3").addEventListener("click", endHyp);

  getAssertedButton("digits").style.display = "none";
  getAssertedButton("digits").style.display = "inline-block";

  // Select levels
  setLevelFun();

  // Tools dialog: each tool asks for confirmation first
  getAssertedButton("check").addEventListener("click", () => {
    if (!solAvailable) return;
    closeDialog("tools");
    confirmAction(
      "Mark mistakes?",
      "Marks every digit that differs from the solution.",
      () => {
        check();
        reselect();
      }
    );
  });
  getAssertedButton("solve").addEventListener("click", () => {
    if (!solAvailable) return;
    closeDialog("tools");
    confirmAction(
      "Solve?",
      "Fills in the solution. The sudoku counts as solved with the solver.",
      solve
    );
  });
  updateToolButtons();
}

function disableHyp() {
  getAssertedButton("but1").onclick = null;
  setEnabled("but1", false);
}
function enableHyp() {
  getAssertedButton("but1").onclick = startHyp;
  setEnabled("but1", true);
}

// Removes digit in mini cell
function resetMiniCell(y: number, x: number, n: number) {
  TminiCells[y][x][n - 1].innerHTML = "";
  TsubBinaryTables[y][x][n - 1] = false;
}
// Puts digit in mini cell
function setMiniCell(y: number, x: number, n: number): void {
  TminiCells[y][x][n - 1].innerHTML = n.toString();
  TsubBinaryTables[y][x][n - 1] = true;
}
// Add small digit if not yet present, else remove it
function toggleMiniCell(y: number, x: number, n: number) {
  const alreadySet = TsubBinaryTables[y][x][n - 1];
  if (alreadySet) {
    TminiCells[y][x][n - 1].innerHTML = "";
  } else {
    TminiCells[y][x][n - 1].innerHTML = n.toString();
  }
  TsubBinaryTables[y][x][n - 1] = !alreadySet;
}

// Removes small digits that become inadmissible after setting
// (y, x) to n.
function eliminateSmallDigs(y: number, x: number, n: number) {
  const xFloor = x - (x % 3);
  const yFloor = y - (y % 3);
  for (let i = 0; i < 9; i++) {
    // Rows and Cols
    resetMiniCell(y, i, n);
    resetMiniCell(i, x, n);
    // Square
    resetMiniCell(yFloor + (i % 3), xFloor + Math.floor(i / 3), n);
  }
}

// Set cell (y, x) with value n (0 for empty cell)
function setCell(
  y: number,
  x: number,
  n: number,
  largeMode = true,
  highlightCells = false,
  removeRed = false
) {
  if (n == 0) {
    // Remove all if only small digits present
    Tref[y][x].innerHTML = "";
    Tref[y][x].appendChild(TsubHTMLTables[y][x]);
    for (let i = 0; i < 9; i++) {
      resetMiniCell(y, x, i + 1);
    }
    Marked[y][x] = 0;
  } else {
    if (largeMode) {
      Tref[y][x].innerHTML = n.toString();
      eliminateSmallDigs(y, x, n);
      if (highlightCells) highlight(y, x);
      if (removeRed) {
        Marked[y][x] = 0;
        Tref[y][x].style.backgroundColor = normH;
      }
    } else {
      toggleMiniCell(y, x, n);
    }
  }
}

// Start choosing hypothesis digit
function hypothesis1() {
  if (!choosingHyp) {
    // Choose hypothesis digit
    log(`Choosing ${hyps.length + 1}-th hypothesis.`);
    disableSmallDigs();
    setActive("but1", true);
    choosingHyp = true;
    log(`Started choosing, curX = ${curX}`);
    if (curX >= 0) {
      clickCell(Tref[curY][curX]);
    }
  } else {
    // Cancel choosing a hypothesis digit
    finishedHypChoosing();
  }
}

function endHyp(e: Event) {
  if (hypRejectionEnabled) {
    withUndo(hypothesis3);
  }
  e.stopPropagation();
}

// Revert to previous hypothesis
function hypothesis3() {
  const nHyps = hyps.length;
  if (nHyps < 1) return;
  const lastHyp = hyps[nHyps - 1];
  log(`N hyps: ${nHyps}`);
  const markCopy = deepCopy2D(Marked);

  // Set fixed digits
  if (nHyps < 2) {
    copyTo2d(Tinit, T);
    updateGrid();
    setClickableTrefT();
  } else {
    copyTo2d(hyps[nHyps - 2][1], T);
    updateGrid();
    setClickableTrefT();
    // TODO: Prev. Hyp
    const y = hyps[nHyps - 2][0][0];
    const x = hyps[nHyps - 2][0][1];
    Tref[y][x].style.color = hypCol;
    Tref[y][x].setAttribute("clickable", "0");
  }
  // Current uncertain digits
  copyTo2d(lastHyp[1], T);
  TsubBinaryTables = lastHyp[2];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (T[i][j] > 0) {
        const m = markCopy[i][j];
        setCell(i, j, T[i][j], true, false);
        if (Tref[i][j].getAttribute("clickable") == "1") {
          Tref[i][j].style.color = col1;
          if (m > 0) {
            Tref[i][j].style.backgroundColor = wrongHypCol;
            Marked[i][j] = 1;
            log(`m is ${m}, setting (${i}, ${j})`);
          }
        }
      } else {
        for (let k = 0; k < 9; k++) {
          if (TsubBinaryTables[i][j][k]) {
            setMiniCell(i, j, k + 1);
          }
        }
      }
    }
  }

  // Select cell
  if (nHyps < 2) {
    elsewhere();
  } else {
    const y = hyps[nHyps - 2][0][0];
    const x = hyps[nHyps - 2][0][1];
    if (markCopy[y][x]) {
      Marked[y][x] = 1;
      Tref[y][x].style.backgroundColor = wrongHypCol;
    }
    clickCell(Tref[y][x]);
  }

  // Remove rejected hypothesis
  hyps.pop();
  if (nHyps == 1) {
    disableHypRejection();
  }
}

// Enable shrink mode
function finishedHypChoosing() {
  if (choosingHyp == false) return;
  log("Stopping hypothesis choosing");
  enableSmallDigs();
  setActive("but1", false);
  choosingHyp = false;
}

// Enable / disable the hypothesis rejection button
function enableHypRejection() {
  setEnabled("but3", true);
  hypRejectionEnabled = true;
}
function disableHypRejection() {
  setEnabled("but3", false);
  hypRejectionEnabled = false;
}

// Checks if any input digits are wrong and sets their background to
// red.
function check() {
  if (solAvailable == false) return;
  console.log("Checking Sudoku: ");
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (T[i][j] != Tsol[i][j] && T[i][j] != 0) {
        console.log(`Cell (${i}, ${j}) is incorrect!`);
        Tref[i][j].style.backgroundColor = wrongHypCol;
        Marked[i][j] = 1;
      }
    }
  }
  saveGame();
}

// Records the solve time (not for custom sudokus and when the solver was used)
// and shows it in the win dialog
function showSolveTime() {
  const text = getAssertedButton("log-txt");
  text.textContent = "";
  if (!timing || puzzleId === null || sudLvl < 0) return;
  timing = false;
  updateTimer();
  const seconds = elapsedMs / 1000;
  const entry: HistoryEntry = {
    id: puzzleId,
    level: sudLvl,
    ...(puzzleStr ? { puzzle: puzzleStr } : {}),
    ...(autoFillUsed ? { autoFill: true } : {}),
    seconds,
    date: new Date().toISOString(),
  };
  recordSolve(entry, settings.countAutoFill).then(
    ({ previousBest, isBest, counted }) => {
      text.textContent =
        `Time: ${formatTime(seconds)}` +
        (!counted
          ? " (auto-filled pencil marks, not counted for the best time)"
          : isBest
          ? previousBest === null
            ? ""
            : " - new best!"
          : ` (best: ${formatTime(previousBest as number)})`);
    }
  );
}

// Shows the level of the sudoku and the running time below the buttons,
// nothing when no clock is running
function updateTimer() {
  getAssertedButton("timer").textContent = timing
    ? `${levelName(sudLvl)} · ${formatTime(elapsedMs / 1000)}`
    : "";
}

// Counts the playing time: only while the game page is visible
function tick() {
  const now = Date.now();
  const delta = Math.min(now - lastTick, 2000);
  lastTick = now;
  if (timing && document.visibilityState === "visible" && currentPage() === "game") {
    elapsedMs += delta;
  }
  updateTimer();
}

// Check if sudoku was solved
function checkSolvedSud() {
  const slvd = checkSolved(T);
  if (!slvd) {
    return;
  }
  clearSavedGame();
  showSolveTime();
  const { title, text } = congratulation(sudLvl);
  getAssertedButton("solved-h").textContent = title;
  getAssertedButton("solved-text").textContent = text;
  openDialog("win");
}

// Refreshes the highlighting / digit buttons of the selected cell
function reselect() {
  if (curX >= 0) clickCell(Tref[curY][curX]);
}

// Undo: snapshots of everything the user can change by entering digits
interface Snapshot {
  T: number[][];
  mini: boolean[][][];
  marked: number[][];
  hyps: any[][][];
  clickable: string[][];
  color: string[][];
  rejectionEnabled: boolean;
}
const MAX_UNDO = 200;
const undoStack: Snapshot[] = [];

function captureState(): Snapshot {
  const cellProp = (f: (c: HTMLTableCellElement) => string) =>
    Tref.map((row) => row.map(f));
  return {
    T: deepCopy2D(T),
    mini: deepCopy3D(TsubBinaryTables),
    marked: deepCopy2D(Marked),
    hyps: hyps.slice(),
    clickable: cellProp((c) => c.getAttribute("clickable") ?? "0"),
    color: cellProp((c) => c.style.color),
    rejectionEnabled: hypRejectionEnabled,
  };
}

// Runs an action and records an undo step if it changed anything
function withUndo(action: () => void) {
  const before = captureState();
  action();
  updateDigitCounts();
  const key = (s: Snapshot) =>
    JSON.stringify([s.T, s.mini, s.marked, s.clickable, s.color, s.hyps.length]);
  if (key(before) !== key(captureState())) {
    undoStack.push(before);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    updateUndoButton();
    saveGame();
  }
}

function updateUndoButton() {
  setEnabled("undo-but", undoStack.length > 0);
}

// Applies a snapshot to the game state and the grid
function applySnapshot(s: Snapshot) {
  copyTo2d(s.T, T);
  TsubBinaryTables = deepCopy3D(s.mini);
  copyTo2d(s.marked, Marked);
  hyps = s.hyps.slice();
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const cell = Tref[i][j];
      if (T[i][j] > 0) {
        cell.textContent = String(T[i][j]);
      } else {
        cell.innerHTML = "";
        cell.appendChild(TsubHTMLTables[i][j]);
        for (let k = 0; k < 9; k++) {
          TminiCells[i][j][k].textContent = TsubBinaryTables[i][j][k]
            ? String(k + 1)
            : "";
        }
      }
      cell.setAttribute("clickable", s.clickable[i][j]);
      cell.style.color = s.color[i][j];
      cell.style.backgroundColor = Marked[i][j] ? wrongHypCol : "";
    }
  }
  if (s.rejectionEnabled) enableHypRejection();
  else disableHypRejection();
  updateDigitCounts();
}

function undo() {
  const s = undoStack.pop();
  updateUndoButton();
  if (!s) return;
  log("Undo");
  finishedHypChoosing();
  applySnapshot(s);
  reselect();
  saveGame();
}

// Persistence: the game survives page reloads (important on mobile)
const SAVE_KEY = "serious-sudoku:game:v1";

interface SavedGame extends Snapshot {
  Tinit: number[][];
  Tsol: number[][];
  sudLvl: number;
  solAvailable: boolean;
  puzzleId: string | null;
  puzzle?: string | null;
  autoFill?: boolean;
  elapsed: number;
}

// Whether a grid has any digit (a sudoku that is loaded has givens)
const hasDigits = (g: number[][]) => g.some((r) => r.some((v) => v !== 0));

function saveGame() {
  // Grids that are being typed in are not saved, nor is the state before the
  // first sudoku is loaded (the page can be hidden or closed by then)
  if (inputtingOwnSud || !hasDigits(Tinit)) return;
  try {
    const game: SavedGame = {
      ...captureState(),
      Tinit,
      Tsol,
      sudLvl,
      solAvailable,
      puzzleId,
      puzzle: puzzleStr,
      autoFill: autoFillUsed,
      elapsed: elapsedMs,
    };
    storageSet(SAVE_KEY, JSON.stringify(game));
  } catch (e) {
    log("Could not save the game");
  }
}

function clearSavedGame() {
  storageRemove(SAVE_KEY);
}

const isGrid = (a: any, depth = 2): boolean =>
  Array.isArray(a) &&
  a.length == 9 &&
  a.every((r) => (depth > 1 ? isGrid(r, depth - 1) : true));

// Restores the saved game, returns false if there is none (or it is invalid)
async function loadGame(): Promise<boolean> {
  try {
    const raw = await storageGet(SAVE_KEY);
    if (!raw) return false;
    const g = JSON.parse(raw) as SavedGame;
    const valid =
      isGrid(g.T) &&
      isGrid(g.Tinit) &&
      hasDigits(g.Tinit) &&
      isGrid(g.Tsol) &&
      isGrid(g.marked) &&
      isGrid(g.clickable) &&
      isGrid(g.color) &&
      isGrid(g.mini, 3) &&
      g.mini.every((r) => r.every((c) => c.length == 9)) &&
      Array.isArray(g.hyps) &&
      !checkSolved(g.T);
    if (!valid) return false;
    copyTo2d(g.Tinit, Tinit);
    copyTo2d(g.Tsol, Tsol);
    sudLvl = g.sudLvl;
    solAvailable = g.solAvailable;
    puzzleId = typeof g.puzzleId === "string" ? g.puzzleId : null;
    puzzleStr = typeof g.puzzle === "string" ? g.puzzle : null;
    autoFillUsed = g.autoFill === true;
    elapsedMs = typeof g.elapsed === "number" ? g.elapsed : 0;
    timing = puzzleId !== null && sudLvl >= 0;
    updateTimer();
    updateToolButtons();
    applySnapshot(g);
    setHypButtons();
    if (hyps.length > 0) enableHypRejection();
    unhighlightAll();
    return true;
  } catch (e) {
    return false;
  }
}

// Press a digit button (0 = clear) as if it was clicked
function pressDigit(d: number, e: Event) {
  withUndo(() => digitHandlers[d]?.(e));
}

// Keyboard support
function onKeyDown(e: KeyboardEvent) {
  if (currentPage() !== "game" || document.querySelector("dialog[open]")) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }
  if (mod || e.altKey) return;

  const arrows: { [key: string]: [number, number] } = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  if (e.key in arrows) {
    e.preventDefault();
    if (curX < 0) {
      clickCell(Tref[0][0]);
    } else {
      const [dy, dx] = arrows[e.key];
      const ny = Math.min(8, Math.max(0, curY + dy));
      const nx = Math.min(8, Math.max(0, curX + dx));
      clickCell(Tref[ny][nx]);
    }
  } else if (/^[1-9]$/.test(e.key)) {
    pressDigit(Number(e.key), e);
  } else if (e.key === "Delete" || e.key === "Backspace" || e.key === "0") {
    e.preventDefault();
    pressDigit(0, e);
  }
}

// Executed when cell is clicked
function clickCell(cell: HTMLTableCellElement) {
  unhighlightAll();
  const c = Number(cell.getAttribute("clickable"));
  const y = Number(cell.getAttribute("y"));
  const x = Number(cell.getAttribute("x"));
  const numSet = T[y][x] > 0;
  if (numSet) {
    // If number in cell is set
    highlight(y, x);
  } else {
    if (Marked[y][x] == 0) {
      Tref[y][x].style.backgroundColor = normH;
    }
  }
  curY = y;
  curX = x;
  const clickable = c == 1;
  if (clickable) {
    // If Cell is clickable
    digitHandlers.length = 0;
    // Enable all digits that are admissible
    const allowedArray = allowed(T, y, x, clickable);
    const d = new Array(10).fill(false);
    for (let i = 0; i < allowedArray.length; i++) d[allowedArray[i]] = true;
    if (numSet) {
      // Set the currently set number button to clickable
      d[T[y][x]] = true;
    }
    d[0] = true;
    for (let i = 0; i < 10; i++) {
      if (d[i]) {
        const v = i;
        digits[i].style.color = col1;
        digits[i].style.borderColor = col1;
        if (!choosingHyp || v == 0) {
          digitHandlers[i] = (e) => {
            log("Setting digit");
            if (large || v == 0) {
              T[y][x] = v;
              if (v == 0) {
                Tref[y][x].style.color = "var(--fg)";
              } else {
                Tref[y][x].style.color = col1;
              }
            }
            setCell(y, x, v, large, true, true);
            if (v == 0) {
              clickCell(Tref[y][x]); // Depth one recursion
            } else if (large) {
              unhighlightAll();
              highlight(y, x);
            }
            checkSolvedSud();
            e.stopPropagation();
          };
        } else {
          digitHandlers[i] = (e) => {
            // Save current version
            if (!choosingHyp) {
              e.stopPropagation();
              return;
            }
            log("Saving current state");
            const tCopy = deepCopy2D(T);
            const tSubBinaryTablesCopy = deepCopy3D(TsubBinaryTables);
            const hypTuple = [[y, x], tCopy, tSubBinaryTablesCopy];
            hyps.push(hypTuple);
            setClickableTrefT();
            T[y][x] = v;
            Tref[y][x].style.color = hypCol;
            Tref[y][x].setAttribute("clickable", "0");
            setCell(y, x, v, large, true);
            clickCell(Tref[y][x]); // Depth one recursion
            finishedHypChoosing();
            enableHypRejection();
            checkSolvedSud();
            log("Saved current.");
            e.stopPropagation();
          };
        }
      } else {
        digits[i].style.color = "var(--disabled)";
        digits[i].style.borderColor = "var(--disabled)";
        digitHandlers[i] = (e) => {
          log("Cannot set this number!");
          e.stopPropagation();
        };
      }
    }
  } else {
    digitHandlers.length = 0;
    for (let i = 0; i < 10; i++) {
      digits[i].style.color = "var(--disabled)";
      digits[i].style.borderColor = "var(--disabled)";
    }
    //elsewhere();
  }
}

// When the user clicks anywhere
function elsewhere() {
  log("Elsewhere");
  if (curX >= 0) {
    digitHandlers.length = 0;
    curX = -1;
    unhighlightAll();
    for (let i = 0; i < digits.length; ++i) {
      digits[i].style.color = "var(--disabled)";
      digits[i].style.borderColor = "var(--disabled)";
      digitHandlers[i] = (e) => {
        log("Neet to select a cell first.");
        e.stopPropagation();
      };
    }
  }
}

function setIfNotMarked(y: number, x: number) {
  if (Marked[y][x] == 0) {
    Tref[y][x].style.backgroundColor = rowColSquareForbidCol;
  }
}

// Highlight the current cell and all same numbers in grid
function highlight(y: number, x: number) {
  log("highlighting");
  const currDig = T[y][x];
  const xFloor = x - (x % 3);
  const yFloor = y - (y % 3);
  for (let i = 0; i < 9; i++) {
    setIfNotMarked(y, i);
    setIfNotMarked(i, x);
    setIfNotMarked(yFloor + (i % 3), xFloor + Math.floor(i / 3));
    for (let j = 0; j < 9; j++) {
      if (T[i][j] == currDig) {
        if (Marked[i][j] == 0) {
          Tref[i][j].style.backgroundColor = sameDigCol;
        }
      }
      if (T[i][j] == 0 && TsubBinaryTables[i][j][currDig - 1]) {
        Tref[i][j].style.backgroundColor = smallDigCol;
      }
    }
  }
  if (Marked[y][x] == 0) {
    Tref[y][x].style.backgroundColor = normH;
  }
}

// Unhighlights all cells
function unhighlightAll() {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (Marked[i][j] == 0) {
        Tref[i][j].style.backgroundColor = "";
      }
    }
  }
}

// Shows on each digit button how many of the digit are set in the grid, and
// crosses out the digits that are all set (nine times)
function updateDigitCounts() {
  const counts = new Array(10).fill(0);
  for (const row of T) for (const v of row) counts[v]++;
  for (let d = 1; d <= 9; d++) {
    const btn = digits[d];
    if (!btn) continue;
    btn.querySelector(".count")!.textContent = String(counts[d]);
    btn.classList.toggle("done", counts[d] >= 9);
    btn.title = `${counts[d]} of 9 set`;
  }
}

// Sets layout according to T
// Removes marks where T is not set (= 0)
function updateGrid(removeMarks = true) {
  log("Updating grid...");
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const currVal = T[i][j];
      const currMark = Marked[i][j];
      setCell(i, j, currVal, true, false);
      if (!removeMarks || (currVal > 0 && currMark != 0)) {
        Marked[i][j] = 1;
      }
      Tref[i][j].style.color = "";
      if (Marked[i][j] == 0) {
        Tref[i][j].style.backgroundColor = "";
      }
    }
  }
  updateDigitCounts();
}

// Makes the cells clickable
function setClickableTrefT() {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (T[i][j] == 0) Tref[i][j].setAttribute("clickable", "1");
      else {
        Tref[i][j].setAttribute("clickable", "0");
        Tref[i][j].style.color = "";
      }
    }
  }
}

// Sets the sudoku to the one specified with the string 'ret_sud'.
function setSudFromStr(retSud: string, index: number) {
  closeDialog("newGrid");
  openDialog("waiting");

  const { sud, sol } = parseSudokuLine(retSud);
  copyTo2d(sud, T);
  copyTo2d(sol, Tsol);
  puzzleStr = gridToString(sud);
  autoFillUsed = false;

  // Shuffle
  permuteSuds(T, Tsol);
  copyTo2d(T, Tinit);
  puzzleId = `${sudLvl}-${index}`;
  elapsedMs = 0;
  timing = true;
  updateTimer();
  elsewhere();
  if (!solAvailable) solAvailable = true;
  updateToolButtons();
  updateGrid();
  setClickableTrefT();
  clearHyps();
  closeDialog("waiting");
  saveGame();
}

// Disables the pencil mark toggle (forces large digit mode)
function disableSmallDigs() {
  log("Disabled pencil mark toggle");
  enlarge();
  smallDigsEnabled = false;
  setEnabled("mode-but", false);
}
// Enables the pencil mark toggle
function enableSmallDigs() {
  smallDigsEnabled = true;
  setEnabled("mode-but", true);
}

// Lets the user input a custom sudoku
function inputCustomSudoku() {
  if (!inputtingOwnSud) {
    log("Own Input");
    puzzleId = null;
    puzzleStr = null;
    timing = false;
    updateTimer();
    elsewhere();
    clearHyps();
    disableHyp();

    // Toggle State and Button color
    inputtingOwnSud = true;
    solAvailable = false;
    updateToolButtons();
    updateOwnInputUi();

    // Remove current sudoku
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        T[i][j] = 0;
        setCell(i, j, 0, true, false);
        Tref[i][j].style.color = "";
        Tref[i][j].style.backgroundColor = "";
        Tref[i][j].setAttribute("clickable", "1");
      }
    }
    updateDigitCounts();
    disableSmallDigs();
  } else {
    log("Done inputting own sudoku!");
    enableHyp();
    sudLvl = -1;

    // Toggle State
    inputtingOwnSud = false;
    updateOwnInputUi();

    // Activate small numbers and set set numbers to unclickable
    copyTo2d(T, Tinit);
    setClickableTrefT();
    enableSmallDigs();
    saveGame();
  }
}

// Reads a random sudoku from the file and loads it.
function loadRandomSud(lvl = MAX_LEVEL) {
  if (inputtingOwnSud) {
    inputCustomSudoku();
  }
  sudLvl = lvl;
  readSudokuFromFile(setSudFromStr, lvl);
  log(`Loaded sudoku with level ${lvl}`);
}

// Setup hypothesis buttons
function setHypButtons() {
  setActive("but1", false);
  setEnabled("but1", true);
  setEnabled("but3", false);
}

// Sets the current sudoku to the solution.
function solve() {
  if (solAvailable == false) return;
  sudLvl = -2;
  timing = false;
  updateTimer();
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (T[i][j] == 0) {
        T[i][j] = Tsol[i][j];
        setCell(i, j, T[i][j]);
        Tref[i][j].style.color = "var(--disabled)";
      } else if (T[i][j] != Tsol[i][j]) {
        T[i][j] = Tsol[i][j];
        setCell(i, j, T[i][j]);
        Tref[i][j].style.color = "var(--disabled)";
        Tref[i][j].style.backgroundColor = "var(--same-bg)";
      }
    }
  }
  clearHyps();
  setHypButtons();
  updateDigitCounts();
  saveGame();
}

function clearHyps() {
  log("Clearing hypotheses");
  undoStack.length = 0;
  updateUndoButton();
  hyps = [];
  choosingHyp = false;
  setActive("but1", false);
  disableHypRejection();
}

// Restart
function restart() {
  if (inputtingOwnSud) {
    inputCustomSudoku();
  }
  log("Restarting");
  elapsedMs = 0;
  autoFillUsed = false;
  timing = puzzleId !== null && sudLvl >= 0;
  updateTimer();
  elsewhere();
  unhighlightAll();
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (Tinit[i][j] == 0) {
        Tref[i][j].setAttribute("clickable", "1");
        T[i][j] = 0;
        Tref[i][j].style.backgroundColor = "";
        Tref[i][j].style.color = "";
        setCell(i, j, 0);
      }
    }
  }
  clearHyps();
  setHypButtons();
  updateDigitCounts();
  saveGame();
}

// Autofill
function fillSmallDigits() {
  log("Autofilling...");
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (T[i][j] == 0) {
        // Enable all digits that are admissible
        const a = allowed(T, i, j);
        for (let k = 0; k < a.length; k++) {
          setMiniCell(i, j, a[k]);
        }
      }
    }
  }
  unhighlightAll();
  reselect();
}

// Export
export {
  enlarge,
  shrink,
  initGrid,
  htmlButtonDict,
  col1,
  digits,
  loadRandomSud,
  setButtons,
  log,
  elsewhere,
  clickCell,
};
