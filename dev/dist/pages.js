import { loadHistory, bestTime, averageTime, formatTime, } from "./history.js";
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
const WAND = ' <svg class="icon inline-icon" role="img" aria-label="Pencil marks filled in automatically">' +
    '<use href="#i-color-wand-outline" /></svg>';
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
    const levels = [...new Set(entries.map((e) => e.level))].sort((a, b) => a - b);
    byId("history-levels").innerHTML =
        row(["Level", "Solved", "Best", "Average"], "th") +
            levels
                .map((level) => {
                const solved = entries.filter((e) => e.level === level).length;
                const best = bestTime(entries, level, count);
                const avg = averageTime(entries, level, count);
                return row([
                    levelName(level),
                    String(solved),
                    best === null ? "-" : formatTime(best),
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
                formatTime(e.seconds) + (e.autoFill ? WAND : ""),
                `#${e.id.split("-")[1]}`,
            ]))
                .join("");
    byId("history-note").hidden = !recent.some((e) => e.autoFill);
}
function closeMenu() {
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
        text: "Practise without a clock. The time is neither shown nor measured, and solved " +
            "sudokus are not recorded in the history, so they do not count for the best times. " +
            "This also holds for a sudoku on which you turn the practice mode off again before " +
            "you finish it: restart it (tools) for a timed attempt.",
    },
    "show-time": {
        title: "Show time",
        text: "Shows the time below the buttons. When it is off, the solving is still timed and " +
            "recorded as usual, and the time of a solved sudoku is shown when you finish it. " +
            "Not available in the practice mode, where no time is shown.",
    },
    "count-wand": {
        title: "Count wand solves",
        text: "Solves with auto-filled pencil marks (the magic wand in the tools) only count for " +
            "the best and average times if this is on. They are always recorded in the " +
            "history, marked with the wand.",
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
    const updateShowTime = () => {
        showTime.disabled = settings.practiceMode;
        showTime.closest("label").classList.toggle("disabled", settings.practiceMode);
    };
    loadSettings().then(() => {
        practice.checked = settings.practiceMode;
        showTime.checked = settings.showTime;
        updateShowTime();
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
        updateShowTime();
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