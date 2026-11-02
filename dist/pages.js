import { loadHistory, bestTime, averageTime, onlyWandSolves, formatTime, } from "./history.js";
import { LEVEL_NAMES, levelName } from "./sudoku.js";
import { settings, loadSettings, saveSettings, applyTheme, } from "./settings.js";
const TITLES = {
    game: "Serious Sudoku",
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
async function renderHistory() {
    const [entries] = await Promise.all([loadHistory(), loadSettings()]);
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
        row(["Level", "Solved", "Best", "Average"], "th") +
            levels
                .map((level) => {
                const solved = timed.filter((e) => e.level === level).length;
                const best = bestTime(entries, level, count);
                const wandOnly = onlyWandSolves(entries, level, count);
                const avg = wandOnly ? null : averageTime(entries, level, count);
                return row([
                    levelName(level),
                    String(solved),
                    best === null ? "-" : (wandOnly ? WAND : "") + formatTime(best),
                    avg === null ? "-" : formatTime(avg),
                ]);
            })
                .join("");
    const recent = entries.slice(-RECENT_ENTRIES).reverse();
    byId("history-recent").innerHTML =
        row(["Date", "Level", "Time", "ID"], "th") +
            recent
                .map((e) => row([
                new Date(e.date).toLocaleDateString(),
                levelName(e.level),
                (e.autoFill ? WAND : "") + (e.practice ? PRACTICE : formatTime(e.seconds)),
                `#${e.id.split("-")[1]}`,
            ]))
                .join("");
    byId("history-note").hidden = !recent.some((e) => e.autoFill);
    byId("history-note-practice").hidden = !recent.some((e) => e.practice);
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
export function setupPages() {
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
    showPage();
}
//# sourceMappingURL=pages.js.map