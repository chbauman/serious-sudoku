import { loadHistory, bestEntry, usedHelp, solveStats, formatTime, } from "./history.js";
import { levelName, levelNames } from "./sudoku.js";
import { t, dateLocale, onLanguageChange, setLanguage, resolveLanguage, } from "./i18n.js";
import { settings, loadSettings, saveSettings, applyTheme, } from "./settings.js";
const TITLES = {
    game: "app.name",
    help: "menu.help",
    settings: "menu.settings",
    history: "menu.history",
    about: "menu.about",
};
const RECENT_ENTRIES = 10;
const wandIcon = () => `<svg class="icon inline-icon" role="img" aria-label="${t("aria.wand")}">` +
    '<use href="#i-color-wand-outline" /></svg> ';
const mistakesIcon = () => `<svg class="icon inline-icon" role="img" aria-label="${t("aria.mistakes")}">` +
    '<use href="#i-search-outline" /></svg> ';
const helpIcons = (e) => (e.autoFill ? wandIcon() : "") + (e.mistakes ? mistakesIcon() : "");
const practiceIcon = () => `<svg class="icon inline-icon" role="img" aria-label="${t("aria.practice")}">` +
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
    byId("page-title").textContent = t(TITLES[page]);
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
const shortDate = (iso) => new Date(iso).toLocaleDateString(dateLocale(), { year: "2-digit", month: "numeric", day: "numeric" });
const timeCell = (e) => helpIcons(e) + (e.practice ? practiceIcon() : formatTime(e.seconds));
const infoRow = (name, value) => `<tr><th>${name}</th><td>${value}</td></tr>`;
function replayButton(index) {
    return `<button type="button" class="action-btn" data-replay="${index}">${t("history.replay")}</button>`;
}
function solveDetails(index) {
    const e = shownEntries[index];
    return ('<table class="info-table">' +
        infoRow(t("history.d.level"), levelName(e.level)) +
        infoRow(t("history.d.date"), new Date(e.date).toLocaleString(dateLocale())) +
        infoRow(t("history.d.time"), helpIcons(e) +
            formatTime(e.seconds) +
            (usedHelp(e) || e.practice
                ? ` (${[
                    usedHelp(e) ? t("history.d.help") : "",
                    e.practice ? t("history.d.practice") : "",
                ]
                    .filter((text) => text)
                    .join(", ")})`
                : "")) +
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
    byId("solve-info-title").textContent = t("history.solve.title", {
        level: levelName(e.level),
    });
    byId("solve-info-body").innerHTML = solveDetails(index);
    openDialogById("solve-info");
}
function showLevel(level) {
    const count = settings.countAutoFill;
    const best = bestEntry(shownEntries, level, count);
    const stats = solveStats(shownEntries, level);
    const statsRow = (name, s) => `<tr><td>${name}</td><td class="num">${s.count}</td><td class="num">${s.average === null ? "-" : formatTime(s.average)}</td></tr>`;
    const indexes = shownEntries
        .map((e, i) => i)
        .filter((i) => shownEntries[i].level === level)
        .reverse();
    byId("level-info-title").textContent = levelName(level);
    byId("level-info-body").innerHTML =
        `<h3>${t("history.best.solve")}</h3>` +
            (best ? solveDetails(shownEntries.indexOf(best)) : `<p>${t("history.none")}</p>`) +
            `<h3>${t("history.solves")}</h3>` +
            '<table class="stats">' +
            `<tr><th></th><th class="num">${t("history.col.solved")}</th><th class="num">${t("history.col.average")}</th></tr>` +
            statsRow(t("history.row.nohelp"), stats.unassisted) +
            (stats.assisted.count > 0 ? statsRow(t("history.row.help"), stats.assisted) : "") +
            (stats.assisted.count > 0 && stats.unassisted.count > 0
                ? statsRow(t("history.row.all"), stats.all)
                : "") +
            "</table>" +
            `<h3>${t("history.all.solves")}</h3>` +
            '<table class="stats">' +
            indexes
                .map((i) => `<tr><td>${shortDate(shownEntries[i].date)}</td><td class="num">${timeCell(shownEntries[i])}</td><td class="num">${moreButton(`data-solve="${i}"`, t("history.more.solve"))}</td></tr>`)
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
        row([t("history.col.level"), t("history.col.best"), t("history.col.date"), ""], "th") +
            levels
                .map((level) => {
                const best = bestEntry(entries, level, count);
                return row([
                    levelName(level),
                    best === null ? "-" : helpIcons(best) + formatTime(best.seconds),
                    best === null ? "-" : shortDate(best.date),
                    moreButton(`data-level="${level}"`, t("history.more.level", { level: levelName(level) })),
                ]);
            })
                .join("");
    const firstRecent = Math.max(0, entries.length - RECENT_ENTRIES);
    const recent = entries.map((e, i) => i).slice(firstRecent).reverse();
    byId("history-recent").innerHTML =
        row([t("history.col.date"), t("history.col.level"), t("history.col.time"), ""], "th") +
            recent
                .map((i) => row([
                shortDate(entries[i].date),
                levelName(entries[i].level),
                timeCell(entries[i]),
                moreButton(`data-solve="${i}"`, t("history.more.solve")),
            ]))
                .join("");
    byId("history-note").hidden = !recent.some((i) => entries[i].autoFill);
    byId("history-note-mistakes").hidden = !recent.some((i) => entries[i].mistakes);
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
            if (!replay)
                return;
            if (replayHandler(shownEntries[Number(replay.dataset.replay)])) {
                byId("solve-info").close();
                byId("level-info").close();
                byId("back-btn").click();
            }
            else {
                byId("info-title").textContent = t("history.replay.fail.title");
                byId("info-desc").textContent = t("history.replay.fail.text");
                openDialogById("info");
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
    practice: { title: "settings.practice", text: "info.practice" },
    "show-time": { title: "settings.show-time", text: "info.show-time" },
    "count-wand": { title: "settings.count-wand", text: "info.count-wand" },
};
function setupSettings() {
    document.querySelectorAll(".info-btn").forEach((btn) => btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const info = SETTING_INFO[btn.dataset.info];
        byId("info-title").textContent = t(info.title);
        byId("info-desc").textContent = t(info.text);
        byId("info").showModal();
    }));
    const level = byId("setting-level");
    levelNames().forEach((name, i) => level.add(new Option(name, String(i))));
    const theme = byId("setting-theme");
    const language = byId("setting-language");
    const countAutoFill = byId("setting-count-autofill");
    const practice = byId("setting-practice");
    const showTime = byId("setting-show-time");
    loadSettings().then(() => {
        practice.checked = settings.practiceMode;
        showTime.checked = settings.showTime;
        level.value = String(settings.level);
        theme.value = settings.theme;
        language.value = settings.language;
        setLanguage(resolveLanguage(settings.language));
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
    language.addEventListener("change", () => {
        settings.language = language.value;
        setLanguage(resolveLanguage(settings.language));
        saveSettings();
    });
    onLanguageChange(() => {
        levelNames().forEach((name, i) => (level.options[i].text = name));
        byId("page-title").textContent = t(TITLES[currentPage()]);
        if (currentPage() === "history")
            renderHistory();
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