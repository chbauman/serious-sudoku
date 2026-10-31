import { LEVEL_NAMES, MAX_LEVEL, levelName, congratulation, T, DEBUG, Marked, readSudokuFromFile, Tsol, Tinit, permuteSuds, parseSudokuLine, gridToString, copyTo2d, allowed, solveSudoku, checkSolved, deepCopy2D, deepCopy3D, } from "./sudoku.js";
import { storageGet, storageSet, storageRemove } from "./storage.js";
import { settings, loadSettings } from "./settings.js";
import { currentPage } from "./pages.js";
import { recordSolve, formatTime } from "./history.js";
const col1 = "var(--accent)";
const smallDigCol = "var(--small-dig-bg)";
const rowColSquareForbidCol = "var(--forbid-bg)";
const sameDigCol = "var(--same-bg)";
const hypCol = "var(--hyp)";
const normH = "var(--selected-bg)";
const wrongHypCol = "var(--wrong)";
let large = true;
let smallDigsEnabled = true;
let curX = -1;
let curY = 0;
let solAvailable = false;
let inputtingOwnSud = false;
let sudLvl;
let puzzleId = null;
let puzzleStr = null;
let autoFillUsed = false;
let timing = false;
let elapsedMs = 0;
let lastTick = Date.now();
let choosingHyp = false;
let hypRejectionEnabled = false;
let hyps = [];
const Tref = Array.from(new Array(9), () => new Array(9));
const digitHandlers = [];
const digits = new Array(10);
const TsubHTMLTables = Array.from(new Array(9), () => new Array(9));
let TsubBinaryTables = Array.from(new Array(9), () => new Array(9));
const TminiCells = Array.from(new Array(9), () => new Array(9));
const htmlButtonDict = new Map();
const getAssertedButton = (name) => {
    const res = htmlButtonDict.get(name);
    if (res === undefined) {
        throw new Error("Undefined button!");
    }
    return res;
};
function log(msg) {
    if (DEBUG) {
        console.log(msg);
    }
}
function openDialog(id) {
    const dlg = document.getElementById(id);
    if (!dlg.open)
        dlg.showModal();
}
function closeDialog(id) {
    document.getElementById(id).close();
}
function setupDialogs() {
    document.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => openDialog(el.dataset.open)));
    document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", () => el.closest("dialog").close()));
    document.querySelectorAll("dialog").forEach((dlg) => {
        const persistent = dlg.hasAttribute("data-persistent");
        dlg.addEventListener("click", (e) => {
            const r = dlg.getBoundingClientRect();
            const outside = e.clientX < r.left ||
                e.clientX > r.right ||
                e.clientY < r.top ||
                e.clientY > r.bottom;
            if (outside && !persistent)
                dlg.close();
        });
        if (persistent)
            dlg.addEventListener("cancel", (e) => e.preventDefault());
    });
}
function setActive(id, on) {
    getAssertedButton(id).classList.toggle("active", on);
}
function setEnabled(id, on) {
    getAssertedButton(id).classList.toggle("disabled", !on);
}
function toggleLargeSmall() {
    large = !large;
    setActive("mode-but", !large);
}
function enlarge(e = undefined) {
    if (!large) {
        toggleLargeSmall();
        log("enlarged");
    }
    if (e)
        e.stopPropagation();
}
function shrink(e = undefined) {
    if (large) {
        toggleLargeSmall();
        log("shrunken");
    }
    if (e)
        e.stopPropagation();
}
function initGrid(tbl) {
    for (let i = 0; i < 9; i++) {
        const row = tbl.insertRow(-1);
        row.className = "gridRow";
        for (let j = 0; j < 9; j++) {
            Tref[i][j] = row.insertCell(-1);
            Tref[i][j].className = "gridCell";
            if (i % 3 == 0)
                Tref[i][j].className += " topBorder";
            if (i % 3 == 2)
                Tref[i][j].className += " bottomBorder";
            if (j % 3 == 0)
                Tref[i][j].className += " leftBorder";
            if (j % 3 == 2)
                Tref[i][j].className += " rightBorder";
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
            let subRow = null;
            let subCell;
            for (let k = 0; k < 9; k++) {
                if (k % 3 == 0) {
                    subRow = subTab.insertRow(-1);
                    subRow.className = "gridRow";
                }
                subCell = subRow.insertCell(-1);
                subCell.innerHTML = "";
                subCell.className = "subGridCell";
                TminiCells[i][j][k] = subCell;
            }
            Tref[i][j].appendChild(subTab);
            TsubHTMLTables[i][j] = subTab;
            TsubBinaryTables[i][j] = new Array(9).fill(false);
        }
    }
    setInterval(tick, 1000);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden")
            saveGame();
    });
    window.addEventListener("pagehide", saveGame);
    setTimeout(function () {
        loadSettings()
            .then(loadGame)
            .then((loaded) => {
            if (!loaded)
                loadRandomSud(settings.level);
        });
    }, 250);
}
function setLevelFun() {
    const ulEl = getAssertedButton("lvl_list");
    LEVEL_NAMES.forEach((name, level) => {
        const li = document.createElement("li");
        li.textContent = name;
        li.addEventListener("click", () => loadRandomSud(level));
        ulEl.appendChild(li);
    });
}
function startHyp(e) {
    hypothesis1();
    e.stopPropagation();
}
let pendingConfirm = null;
function confirmAction(title, description, action) {
    pendingConfirm = action;
    getAssertedButton("confirm-title").textContent = title;
    getAssertedButton("confirm-desc").textContent = description;
    openDialog("confirm");
}
let customSolution = null;
function analyseCustomSudoku(forSolve) {
    if (solAvailable)
        return true;
    if (!isCustomSudoku())
        return false;
    const { count, solution } = solveSudoku(Tinit);
    if (count === 1 && solution !== null) {
        copyTo2d(solution, Tsol);
        solAvailable = true;
        customSolution = null;
        updateToolButtons();
        saveGame();
        return true;
    }
    if (count === 0) {
        showInfo("No solution", "This sudoku cannot be solved. Check the digits you entered.");
    }
    else if (forSolve) {
        customSolution = solution;
        confirmAction("Not unique", "This sudoku has more than one solution. Fill in one of them?", () => solve(customSolution));
    }
    else {
        customSolution = solution;
        confirmAction("Not unique", "This sudoku has more than one solution. Mistakes are marked against one of them, so a marked digit may be right in another solution. Mark anyway?", () => {
            check(customSolution);
            reselect();
        });
    }
    return false;
}
function showInfo(title, text) {
    getAssertedButton("info-title").textContent = title;
    getAssertedButton("info-desc").textContent = text;
    openDialog("info");
}
function isCustomSudoku() {
    return puzzleId === null && !inputtingOwnSud && hasDigits(Tinit);
}
function updateToolButtons() {
    const available = solAvailable || isCustomSudoku();
    setEnabled("check", available);
    setEnabled("solve", available);
}
function updateOwnInputUi() {
    getAssertedButton("own-sud-text").textContent = inputtingOwnSud
        ? "Finish input"
        : "Input own sudoku";
    getAssertedButton("own_sud")
        .querySelector("use")
        .setAttribute("href", inputtingOwnSud ? "#i-checkmark-circle-outline" : "#i-create-outline");
    setActive("tools-btn", inputtingOwnSud);
    setEnabled("tools-restart", !inputtingOwnSud);
    setEnabled("auto-fill-button", !inputtingOwnSud);
    getAssertedButton("but1").hidden = inputtingOwnSud;
    getAssertedButton("but3").hidden = inputtingOwnSud;
    getAssertedButton("finish-input").hidden = !inputtingOwnSud;
}
function setButtons() {
    setupDialogs();
    getAssertedButton("digits").addEventListener("click", (e) => {
        const btn = e.target.closest("[id^='digit-']");
        if (btn)
            pressDigit(Number(btn.id.slice("digit-".length)), e);
    });
    document.addEventListener("keydown", onKeyDown);
    getAssertedButton("undo-but").addEventListener("click", (e) => {
        undo();
        e.stopPropagation();
    });
    updateUndoButton();
    getAssertedButton("mode-but").addEventListener("click", (e) => {
        if (smallDigsEnabled)
            large ? shrink() : enlarge();
        e.stopPropagation();
    });
    enableSmallDigs();
    function restAndClose(e) {
        restart();
        closeDialog("restart");
        e.stopPropagation();
    }
    getAssertedButton("restart_but").addEventListener("click", restAndClose);
    getAssertedButton("tools-restart").addEventListener("click", () => {
        if (inputtingOwnSud)
            return;
        closeDialog("tools");
        openDialog("restart");
    });
    getAssertedButton("confirm-yes").addEventListener("click", (e) => {
        const action = pendingConfirm;
        pendingConfirm = null;
        closeDialog("confirm");
        if (action)
            action();
        e.stopPropagation();
    });
    getAssertedButton("confirm-cancel").addEventListener("click", (e) => {
        pendingConfirm = null;
        closeDialog("confirm");
        e.stopPropagation();
    });
    getAssertedButton("finish-input").addEventListener("click", () => {
        if (inputtingOwnSud)
            inputCustomSudoku();
    });
    getAssertedButton("auto-fill-button").addEventListener("click", () => {
        if (inputtingOwnSud)
            return;
        closeDialog("tools");
        confirmAction("Fill in pencil marks?", "Adds all digits that are still possible as pencil marks to every empty cell.", () => {
            autoFillUsed = true;
            withUndo(fillSmallDigits);
        });
    });
    getAssertedButton("own_sud").addEventListener("click", () => {
        closeDialog("tools");
        if (inputtingOwnSud) {
            inputCustomSudoku();
        }
        else {
            confirmAction("Empty grid?", "Add your own sudoku. Current game will be lost.", inputCustomSudoku);
        }
    });
    enableHyp();
    disableHypRejection();
    getAssertedButton("but3").addEventListener("click", endHyp);
    getAssertedButton("digits").style.display = "none";
    getAssertedButton("digits").style.display = "inline-block";
    setLevelFun();
    getAssertedButton("check").addEventListener("click", () => {
        closeDialog("tools");
        if (!analyseCustomSudoku(false))
            return;
        confirmAction("Mark mistakes?", "Marks every digit that differs from the solution.", () => {
            check();
            reselect();
        });
    });
    getAssertedButton("solve").addEventListener("click", () => {
        closeDialog("tools");
        if (!analyseCustomSudoku(true))
            return;
        confirmAction("Solve?", "Fills in the solution. The sudoku counts as solved with the solver.", () => solve());
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
function resetMiniCell(y, x, n) {
    TminiCells[y][x][n - 1].innerHTML = "";
    TsubBinaryTables[y][x][n - 1] = false;
}
function setMiniCell(y, x, n) {
    TminiCells[y][x][n - 1].innerHTML = n.toString();
    TsubBinaryTables[y][x][n - 1] = true;
}
function toggleMiniCell(y, x, n) {
    const alreadySet = TsubBinaryTables[y][x][n - 1];
    if (alreadySet) {
        TminiCells[y][x][n - 1].innerHTML = "";
    }
    else {
        TminiCells[y][x][n - 1].innerHTML = n.toString();
    }
    TsubBinaryTables[y][x][n - 1] = !alreadySet;
}
function eliminateSmallDigs(y, x, n) {
    const xFloor = x - (x % 3);
    const yFloor = y - (y % 3);
    for (let i = 0; i < 9; i++) {
        resetMiniCell(y, i, n);
        resetMiniCell(i, x, n);
        resetMiniCell(yFloor + (i % 3), xFloor + Math.floor(i / 3), n);
    }
}
function setCell(y, x, n, largeMode = true, highlightCells = false, removeRed = false) {
    if (n == 0) {
        Tref[y][x].innerHTML = "";
        Tref[y][x].appendChild(TsubHTMLTables[y][x]);
        for (let i = 0; i < 9; i++) {
            resetMiniCell(y, x, i + 1);
        }
        Marked[y][x] = 0;
    }
    else {
        if (largeMode) {
            Tref[y][x].innerHTML = n.toString();
            eliminateSmallDigs(y, x, n);
            if (highlightCells)
                highlight(y, x);
            if (removeRed) {
                Marked[y][x] = 0;
                Tref[y][x].style.backgroundColor = normH;
            }
        }
        else {
            toggleMiniCell(y, x, n);
        }
    }
}
function hypothesis1() {
    if (!choosingHyp) {
        log(`Choosing ${hyps.length + 1}-th hypothesis.`);
        disableSmallDigs();
        setActive("but1", true);
        choosingHyp = true;
        log(`Started choosing, curX = ${curX}`);
        if (curX >= 0) {
            clickCell(Tref[curY][curX]);
        }
    }
    else {
        finishedHypChoosing();
    }
}
function endHyp(e) {
    if (hypRejectionEnabled) {
        withUndo(hypothesis3);
    }
    e.stopPropagation();
}
function hypothesis3() {
    const nHyps = hyps.length;
    if (nHyps < 1)
        return;
    const lastHyp = hyps[nHyps - 1];
    log(`N hyps: ${nHyps}`);
    const markCopy = deepCopy2D(Marked);
    if (nHyps < 2) {
        copyTo2d(Tinit, T);
        updateGrid();
        setClickableTrefT();
    }
    else {
        copyTo2d(hyps[nHyps - 2][1], T);
        updateGrid();
        setClickableTrefT();
        const y = hyps[nHyps - 2][0][0];
        const x = hyps[nHyps - 2][0][1];
        Tref[y][x].style.color = hypCol;
        Tref[y][x].setAttribute("clickable", "0");
    }
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
            }
            else {
                for (let k = 0; k < 9; k++) {
                    if (TsubBinaryTables[i][j][k]) {
                        setMiniCell(i, j, k + 1);
                    }
                }
            }
        }
    }
    if (nHyps < 2) {
        elsewhere();
    }
    else {
        const y = hyps[nHyps - 2][0][0];
        const x = hyps[nHyps - 2][0][1];
        if (markCopy[y][x]) {
            Marked[y][x] = 1;
            Tref[y][x].style.backgroundColor = wrongHypCol;
        }
        clickCell(Tref[y][x]);
    }
    hyps.pop();
    if (nHyps == 1) {
        disableHypRejection();
    }
}
function finishedHypChoosing() {
    if (choosingHyp == false)
        return;
    log("Stopping hypothesis choosing");
    enableSmallDigs();
    setActive("but1", false);
    choosingHyp = false;
}
function enableHypRejection() {
    setEnabled("but3", true);
    hypRejectionEnabled = true;
}
function disableHypRejection() {
    setEnabled("but3", false);
    hypRejectionEnabled = false;
}
function check(solution = null) {
    const sol = solution ?? Tsol;
    if (solution === null && solAvailable == false)
        return;
    console.log("Checking Sudoku: ");
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (T[i][j] != sol[i][j] && T[i][j] != 0) {
                console.log(`Cell (${i}, ${j}) is incorrect!`);
                Tref[i][j].style.backgroundColor = wrongHypCol;
                Marked[i][j] = 1;
            }
        }
    }
    saveGame();
}
function showSolveTime() {
    const text = getAssertedButton("log-txt");
    text.textContent = "";
    if (!timing || puzzleId === null || sudLvl < 0)
        return;
    timing = false;
    updateTimer();
    const seconds = elapsedMs / 1000;
    const entry = {
        id: puzzleId,
        level: sudLvl,
        ...(puzzleStr ? { puzzle: puzzleStr } : {}),
        ...(autoFillUsed ? { autoFill: true } : {}),
        seconds,
        date: new Date().toISOString(),
    };
    recordSolve(entry, settings.countAutoFill).then(({ previousBest, isBest, counted }) => {
        text.textContent =
            `Time: ${formatTime(seconds)}` +
                (!counted
                    ? " (auto-filled pencil marks, not counted for the best time)"
                    : isBest
                        ? previousBest === null
                            ? ""
                            : " - new best!"
                        : ` (best: ${formatTime(previousBest)})`);
    });
}
function updateTimer() {
    getAssertedButton("timer").textContent = timing
        ? `${levelName(sudLvl)} · ${formatTime(elapsedMs / 1000)}`
        : "";
}
function tick() {
    const now = Date.now();
    const delta = Math.min(now - lastTick, 2000);
    lastTick = now;
    if (timing && document.visibilityState === "visible" && currentPage() === "game") {
        elapsedMs += delta;
    }
    updateTimer();
}
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
function reselect() {
    if (curX >= 0)
        clickCell(Tref[curY][curX]);
}
const MAX_UNDO = 200;
const undoStack = [];
function captureState() {
    const cellProp = (f) => Tref.map((row) => row.map(f));
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
function withUndo(action) {
    const before = captureState();
    action();
    updateDigitCounts();
    const key = (s) => JSON.stringify([s.T, s.mini, s.marked, s.clickable, s.color, s.hyps.length]);
    if (key(before) !== key(captureState())) {
        undoStack.push(before);
        if (undoStack.length > MAX_UNDO)
            undoStack.shift();
        updateUndoButton();
        saveGame();
    }
}
function updateUndoButton() {
    setEnabled("undo-but", undoStack.length > 0);
}
function applySnapshot(s) {
    copyTo2d(s.T, T);
    TsubBinaryTables = deepCopy3D(s.mini);
    copyTo2d(s.marked, Marked);
    hyps = s.hyps.slice();
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            const cell = Tref[i][j];
            if (T[i][j] > 0) {
                cell.textContent = String(T[i][j]);
            }
            else {
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
    if (s.rejectionEnabled)
        enableHypRejection();
    else
        disableHypRejection();
    updateDigitCounts();
}
function undo() {
    const s = undoStack.pop();
    updateUndoButton();
    if (!s)
        return;
    log("Undo");
    finishedHypChoosing();
    applySnapshot(s);
    reselect();
    saveGame();
}
const SAVE_KEY = "serious-sudoku:game:v1";
const hasDigits = (g) => g.some((r) => r.some((v) => v !== 0));
function saveGame() {
    if (inputtingOwnSud || !hasDigits(Tinit))
        return;
    try {
        const game = {
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
    }
    catch (e) {
        log("Could not save the game");
    }
}
function clearSavedGame() {
    storageRemove(SAVE_KEY);
}
const isGrid = (a, depth = 2) => Array.isArray(a) &&
    a.length == 9 &&
    a.every((r) => (depth > 1 ? isGrid(r, depth - 1) : true));
async function loadGame() {
    try {
        const raw = await storageGet(SAVE_KEY);
        if (!raw)
            return false;
        const g = JSON.parse(raw);
        const valid = isGrid(g.T) &&
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
        if (!valid)
            return false;
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
        if (hyps.length > 0)
            enableHypRejection();
        unhighlightAll();
        return true;
    }
    catch (e) {
        return false;
    }
}
function pressDigit(d, e) {
    withUndo(() => digitHandlers[d]?.(e));
}
function onKeyDown(e) {
    if (currentPage() !== "game" || document.querySelector("dialog[open]"))
        return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
    }
    if (mod || e.altKey)
        return;
    const arrows = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
    };
    if (e.key in arrows) {
        e.preventDefault();
        if (curX < 0) {
            clickCell(Tref[0][0]);
        }
        else {
            const [dy, dx] = arrows[e.key];
            const ny = Math.min(8, Math.max(0, curY + dy));
            const nx = Math.min(8, Math.max(0, curX + dx));
            clickCell(Tref[ny][nx]);
        }
    }
    else if (/^[1-9]$/.test(e.key)) {
        pressDigit(Number(e.key), e);
    }
    else if (e.key === "Delete" || e.key === "Backspace" || e.key === "0") {
        e.preventDefault();
        pressDigit(0, e);
    }
}
function clickCell(cell) {
    unhighlightAll();
    const c = Number(cell.getAttribute("clickable"));
    const y = Number(cell.getAttribute("y"));
    const x = Number(cell.getAttribute("x"));
    const numSet = T[y][x] > 0;
    if (numSet) {
        highlight(y, x);
    }
    else {
        if (Marked[y][x] == 0) {
            Tref[y][x].style.backgroundColor = normH;
        }
    }
    curY = y;
    curX = x;
    const clickable = c == 1;
    if (clickable) {
        digitHandlers.length = 0;
        const allowedArray = allowed(T, y, x, clickable);
        const d = new Array(10).fill(false);
        for (let i = 0; i < allowedArray.length; i++)
            d[allowedArray[i]] = true;
        if (numSet) {
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
                            }
                            else {
                                Tref[y][x].style.color = col1;
                            }
                        }
                        setCell(y, x, v, large, true, true);
                        if (v == 0) {
                            clickCell(Tref[y][x]);
                        }
                        else if (large) {
                            unhighlightAll();
                            highlight(y, x);
                        }
                        checkSolvedSud();
                        e.stopPropagation();
                    };
                }
                else {
                    digitHandlers[i] = (e) => {
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
                        clickCell(Tref[y][x]);
                        finishedHypChoosing();
                        enableHypRejection();
                        checkSolvedSud();
                        log("Saved current.");
                        e.stopPropagation();
                    };
                }
            }
            else {
                digits[i].style.color = "var(--disabled)";
                digits[i].style.borderColor = "var(--disabled)";
                digitHandlers[i] = (e) => {
                    log("Cannot set this number!");
                    e.stopPropagation();
                };
            }
        }
    }
    else {
        digitHandlers.length = 0;
        for (let i = 0; i < 10; i++) {
            digits[i].style.color = "var(--disabled)";
            digits[i].style.borderColor = "var(--disabled)";
        }
    }
}
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
function setIfNotMarked(y, x) {
    if (Marked[y][x] == 0) {
        Tref[y][x].style.backgroundColor = rowColSquareForbidCol;
    }
}
function highlight(y, x) {
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
function unhighlightAll() {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (Marked[i][j] == 0) {
                Tref[i][j].style.backgroundColor = "";
            }
        }
    }
}
function updateDigitCounts() {
    const counts = new Array(10).fill(0);
    for (const row of T)
        for (const v of row)
            counts[v]++;
    for (let d = 1; d <= 9; d++) {
        const btn = digits[d];
        if (!btn)
            continue;
        btn.querySelector(".count").textContent = String(counts[d]);
        btn.classList.toggle("done", counts[d] >= 9);
        btn.title = `${counts[d]} of 9 set`;
    }
}
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
function setClickableTrefT() {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (T[i][j] == 0)
                Tref[i][j].setAttribute("clickable", "1");
            else {
                Tref[i][j].setAttribute("clickable", "0");
                Tref[i][j].style.color = "";
            }
        }
    }
}
function setSudFromStr(retSud, index) {
    closeDialog("newGrid");
    openDialog("waiting");
    const { sud, sol } = parseSudokuLine(retSud);
    copyTo2d(sud, T);
    copyTo2d(sol, Tsol);
    puzzleStr = gridToString(sud);
    autoFillUsed = false;
    permuteSuds(T, Tsol);
    copyTo2d(T, Tinit);
    puzzleId = `${sudLvl}-${index}`;
    elapsedMs = 0;
    timing = true;
    updateTimer();
    elsewhere();
    if (!solAvailable)
        solAvailable = true;
    updateToolButtons();
    updateGrid();
    setClickableTrefT();
    clearHyps();
    closeDialog("waiting");
    saveGame();
}
function disableSmallDigs() {
    log("Disabled pencil mark toggle");
    enlarge();
    smallDigsEnabled = false;
    setEnabled("mode-but", false);
}
function enableSmallDigs() {
    smallDigsEnabled = true;
    setEnabled("mode-but", true);
}
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
        inputtingOwnSud = true;
        solAvailable = false;
        updateToolButtons();
        updateOwnInputUi();
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
    }
    else {
        log("Done inputting own sudoku!");
        enableHyp();
        sudLvl = -1;
        inputtingOwnSud = false;
        updateOwnInputUi();
        copyTo2d(T, Tinit);
        updateToolButtons();
        setClickableTrefT();
        enableSmallDigs();
        saveGame();
    }
}
function loadRandomSud(lvl = MAX_LEVEL) {
    if (inputtingOwnSud) {
        inputCustomSudoku();
    }
    sudLvl = lvl;
    readSudokuFromFile(setSudFromStr, lvl);
    log(`Loaded sudoku with level ${lvl}`);
}
function setHypButtons() {
    setActive("but1", false);
    setEnabled("but1", true);
    setEnabled("but3", false);
}
function solve(solution = null) {
    const sol = solution ?? Tsol;
    if (solution === null && solAvailable == false)
        return;
    sudLvl = -2;
    timing = false;
    updateTimer();
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (T[i][j] == 0) {
                T[i][j] = sol[i][j];
                setCell(i, j, T[i][j]);
                Tref[i][j].style.color = "var(--disabled)";
            }
            else if (T[i][j] != sol[i][j]) {
                T[i][j] = sol[i][j];
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
function fillSmallDigits() {
    log("Autofilling...");
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (T[i][j] == 0) {
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
export { enlarge, shrink, initGrid, htmlButtonDict, col1, digits, loadRandomSud, setButtons, log, elsewhere, clickCell, };
//# sourceMappingURL=html_util.js.map