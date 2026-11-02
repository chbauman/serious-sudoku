import { loadHistory, averageTime, bestEntry, onlyWandSolves, solveCounts, formatTime, } from "./history.js";
import { LEVEL_NAMES, levelName } from "./sudoku.js";
import { settings, loadSettings, saveSettings, applyTheme, } from "./settings.js";
const TITLES = {
    game: "Serious Sudoku (dev)",
    help: "Help",
    settings: "Settings",
    history: "History",
    about: "About",
};
const RECENT_ENTRIES = 10;
const WAND = '<svg class="icon inline-icon" role="img" aria-label="Pencil marks filled in automatically">' +
    '<use href="#i-color-wand-outline" /></svg> ';
const PRACTICE = '<svg class="icon inline-icon" role="img" aria-label="Practice, no time">' +
    '<use href="#i-practice-outline" /></svg>';
const byId = (id) => document.getElementById(id);
export function currentPage() {
    const page = location.hash.slice(1);
    return page in TITLES ? page : "game";
}
function showPage() {
    const page = currentPage();
    document.querySelectorAll("[data-page]").forEach((el) => {
        el.hidden = el.dataset.page !== page;
    });
    byId("page-title").textContent = TITLES[page];
    byId("back-btn").hidden = page === "game";
    closeMenu();
    window.scrollTo(0, 0);
    if (page === "history")
        renderHistory();
}
let shownEntries = [];
let replayHandler = () => false;
const MORE_ICON = '<svg class="icon" aria-hidden="true"><use href="#i-ellipsis-circle-outline" /></svg>';
const moreButton = (attr, label) => `<button type="button" class="more-btn" ${attr} title="${label}" aria-label="${label}">${MORE_ICON}</button>`;
const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { year: "2-digit", month: "numeric", day: "numeric" });
const timeCell = (e) => (e.autoFill ? WAND : "") + (e.practice ? PRACTICE : formatTime(e.seconds));
const infoRow = (name, value) => `<tr><th>${name}</th><td>${value}</td></tr>`;
function replayButton(index) {
    const e = shownEntries[index];
    return e.puzzle
        ? `<button type="button" class="action-btn" data-replay="${index}">Replay</button>`
        : '<p class="info-note">The sudoku of this solve is not stored, no replay possible.</p>';
}
function solveDetails(index) {
    const e = shownEntries[index];
    return ('<table class="info-table">' +
        infoRow("Level", levelName(e.level)) +
        infoRow("Date", new Date(e.date).toLocaleString()) +
        infoRow("Time", formatTime(e.seconds) + (e.practice ? " (practice)" : "")) +
        (e.autoFill ? infoRow("Pencil marks", WAND + "filled in automatically") : "") +
        infoRow("ID", `#${e.id.split("-")[1]}`) +
        "</table>" +
        replayButton(index));
}
function openDialogById(id) {
    const dlg = byId(id);
    if (!dlg.open)
        dlg.showModal();
}
function showSolve(index) {
    const e = shownEntries[index];
    byId("solve-info-title").textContent = `${levelName(e.level)} sudoku`;
    byId("solve-info-body").innerHTML = solveDetails(index);
    openDialogById("solve-info");
}
function showLevel(level) {
    const count = settings.countAutoFill;
    const best = bestEntry(shownEntries, level, count);
    const counts = solveCounts(shownEntries, level);
    const average = onlyWandSolves(shownEntries, level, count)
        ? null
        : averageTime(shownEntries, level, count);
    const indexes = shownEntries
        .map((e, i) => i)
        .filter((i) => shownEntries[i].level === level)
        .reverse();
    byId("level-info-title").textContent = levelName(level);
    byId("level-info-body").innerHTML =
        "<h3>Best solve</h3>" +
            (best ? solveDetails(shownEntries.indexOf(best)) : "<p>None yet.</p>") +
            "<h3>Solves</h3>" +
            '<table class="info-table">' +
            infoRow("Solved", String(counts.unassisted)) +
            (counts.assisted > 0 ? infoRow("Solved using help", String(counts.assisted)) : "") +
            (average === null ? "" : infoRow("Average time", formatTime(average))) +
            "</table>" +
            "<h3>All solves</h3>" +
            '<table class="stats">' +
            indexes
                .map((i) => `<tr><td>${shortDate(shownEntries[i].date)}</td><td class="num">${timeCell(shownEntries[i])}</td><td class="num">${moreButton(`data-solve="${i}"`, "Details of this solve")}</td></tr>`)
                .join("") +
            "</table>";
    openDialogById("level-info");
}
async function renderHistory() {
    const [entries] = await Promise.all([loadHistory(), loadSettings()]);
    shownEntries = entries;
    const count = settings.countAutoFill;
    byId("history-empty").hidden = entries.length > 0;
    byId("history-content").hidden = entries.length === 0;
    const row = (cells, tag = "td") => "<tr>" +
        cells
            .map((c, i) => `<${tag}${i > 0 ? ' class="num"' : ""}>${c}</${tag}>`)
            .join("") +
        "</tr>";
    const timed = entries.filter((e) => !e.practice);
    const levels = [...new Set(timed.map((e) => e.level))].sort((a, b) => a - b);
    byId("history-levels").innerHTML =
        row(["Level", "Best", "Date", ""], "th") +
            levels
                .map((level) => {
                const best = bestEntry(entries, level, count);
                const wandOnly = onlyWandSolves(entries, level, count);
                return row([
                    levelName(level),
                    best === null ? "-" : (wandOnly ? WAND : "") + formatTime(best.seconds),
                    best === null ? "-" : shortDate(best.date),
                    moreButton(`data-level="${level}"`, `Details of ${levelName(level)}`),
                ]);
            })
                .join("");
    const firstRecent = Math.max(0, entries.length - RECENT_ENTRIES);
    const recent = entries.map((e, i) => i).slice(firstRecent).reverse();
    byId("history-recent").innerHTML =
        row(["Date", "Level", "Time", ""], "th") +
            recent
                .map((i) => row([
                shortDate(entries[i].date),
                levelName(entries[i].level),
                timeCell(entries[i]),
                moreButton(`data-solve="${i}"`, "Details of this solve"),
            ]))
                .join("");
    byId("history-note").hidden = !recent.some((i) => entries[i].autoFill);
    byId("history-note-practice").hidden = !recent.some((i) => entries[i].practice);
}
function setupHistory() {
    byId("history").addEventListener("click", (e) => {
        const btn = e.target.closest(".more-btn");
        if (!btn)
            return;
        if (btn.dataset.level !== undefined)
            showLevel(Number(btn.dataset.level));
        else if (btn.dataset.solve !== undefined)
            showSolve(Number(btn.dataset.solve));
    });
    for (const id of ["level-info", "solve-info"]) {
        byId(id).addEventListener("click", (e) => {
            const target = e.target;
            const more = target.closest(".more-btn[data-solve]");
            if (more) {
                showSolve(Number(more.dataset.solve));
                return;
            }
            const replay = target.closest("[data-replay]");
            if (replay && replayHandler(shownEntries[Number(replay.dataset.replay)])) {
                byId("solve-info").close();
                byId("level-info").close();
                byId("back-btn").click();
            }
        });
    }
}
export function closeMenu() {
    byId("menu").hidden = true;
    byId("menu-btn").setAttribute("aria-expanded", "false");
}
function toggleMenu() {
    const menu = byId("menu");
    menu.hidden = !menu.hidden;
    byId("menu-btn").setAttribute("aria-expanded", String(!menu.hidden));
}
const SETTING_INFO = {
    practice: {
        title: "Practice mode",
        text: "Solves are listed in the history with a practice icon instead of a time and " +
            "do not count for the best times.",
    },
    "show-time": {
        title: "Show time",
        text: "Shows the time below the buttons. The solving is timed either way.",
    },
    "count-wand": {
        title: "Count wand solves",
        text: "Solves with auto-filled pencil marks (the magic wand) only count for the best " +
            "times if this is on, or as long as the level was never solved without help. " +
            "They are always listed in the history.",
    },
};
function setupSettings() {
    document.querySelectorAll(".info-btn").forEach((btn) => btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const info = SETTING_INFO[btn.dataset.info];
        byId("info-title").textContent = info.title;
        byId("info-desc").textContent = info.text;
        byId("info").showModal();
    }));
    const level = byId("setting-level");
    LEVEL_NAMES.forEach((name, i) => level.add(new Option(name, String(i))));
    const theme = byId("setting-theme");
    const countAutoFill = byId("setting-count-autofill");
    const practice = byId("setting-practice");
    const showTime = byId("setting-show-time");
    loadSettings().then(() => {
        practice.checked = settings.practiceMode;
        showTime.checked = settings.showTime;
        level.value = String(settings.level);
        theme.value = settings.theme;
        countAutoFill.checked = settings.countAutoFill;
    });
    level.addEventListener("change", () => {
        settings.level = Number(level.value);
        saveSettings();
    });
    practice.addEventListener("change", () => {
        settings.practiceMode = practice.checked;
        saveSettings();
    });
    showTime.addEventListener("change", () => {
        settings.showTime = showTime.checked;
        saveSettings();
    });
    countAutoFill.addEventListener("change", () => {
        settings.countAutoFill = countAutoFill.checked;
        saveSettings();
    });
    theme.addEventListener("change", () => {
        settings.theme = theme.value;
        applyTheme(settings.theme);
        saveSettings();
    });
}
function keyboardLikely() {
    return (matchMedia("(hover: hover) and (pointer: fine)").matches ||
        navigator.maxTouchPoints === 0);
}
function setupAndroidBack() {
    const app = window.Capacitor?.Plugins?.App;
    if (!app?.addListener)
        return;
    app.addListener("backButton", () => {
        const dialog = document.querySelector("dialog[open]");
        if (dialog) {
            if (dialog.dispatchEvent(new Event("cancel", { cancelable: true })))
                dialog.close();
        }
        else if (!byId("menu").hidden) {
            closeMenu();
        }
        else if (currentPage() !== "game") {
            byId("back-btn").click();
        }
        else {
            app.exitApp();
        }
    });
}
export function setupPages(replay) {
    replayHandler = replay;
    byId("keyboard-help").hidden = !keyboardLikely();
    let prev = currentPage();
    let cameFromGame = false;
    window.addEventListener("hashchange", () => {
        const page = currentPage();
        if (page === "game")
            cameFromGame = false;
        else if (prev === "game")
            cameFromGame = true;
        prev = page;
        showPage();
    });
    byId("back-btn").addEventListener("click", () => {
        if (cameFromGame)
            history.back();
        else
            location.hash = "";
    });
    byId("menu").addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (link && currentPage() !== "game") {
            e.preventDefault();
            location.replace(link.getAttribute("href"));
        }
    });
    byId("menu-btn").addEventListener("click", toggleMenu);
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#menu-btn"))
            closeMenu();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape")
            closeMenu();
    });
    setupAndroidBack();
    setupSettings();
    setupHistory();
    showPage();
}
//# sourceMappingURL=pages.js.map