// Page navigation: the game, help, settings, history and about are "pages" of
// the single index.html, selected by the URL hash (#help, #settings, ...). The hamburger menu
// in the header opens the other pages, the back button (and the Android back
// button) return to the game.
import {
  loadHistory,
  bestEntry,
  onlyHelpedSolves,
  usedHelp,
  solveStats,
  formatTime,
  HistoryEntry,
  SolveStats,
} from "./history.js";
import { levelName, levelNames } from "./sudoku.js";
import {
  MessageKey,
  t,
  dateLocale,
  onLanguageChange,
  setLanguage,
  resolveLanguage,
  LanguageSetting,
} from "./i18n.js";
import {
  settings,
  loadSettings,
  saveSettings,
  applyTheme,
  Theme,
} from "./settings.js";

// The text of the title of every page
const TITLES: { [page: string]: MessageKey } = {
  game: "app.name",
  help: "menu.help",
  settings: "menu.settings",
  history: "menu.history",
  about: "menu.about",
};

/** Number of recent solves shown on the history page */
const RECENT_ENTRIES = 10;

/** Marks the solves with auto-filled pencil marks in the history */
const wandIcon = () =>
  `<svg class="icon inline-icon" role="img" aria-label="${t("aria.wand")}">` +
  '<use href="#i-color-wand-outline" /></svg> ';

/** Marks the solves where the mistakes were found in the history */
const mistakesIcon = () =>
  `<svg class="icon inline-icon" role="img" aria-label="${t("aria.mistakes")}">` +
  '<use href="#i-search-outline" /></svg> ';

/** The icons of the help used for a solve (none if it was solved without help) */
const helpIcons = (e: HistoryEntry) =>
  (e.autoFill ? wandIcon() : "") + (e.mistakes ? mistakesIcon() : "");

/** Marks the solves in practice mode in the history (instead of the time) */
const practiceIcon = () =>
  `<svg class="icon inline-icon" role="img" aria-label="${t("aria.practice")}">` +
  '<use href="#i-practice-outline" /></svg>';

const byId = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

/** Page named by the current hash, "game" for none or unknown ones */
export function currentPage(): string {
  const page = location.hash.slice(1);
  return page in TITLES ? page : "game";
}

function showPage() {
  const page = currentPage();
  document.querySelectorAll<HTMLElement>("[data-page]").forEach((el) => {
    el.hidden = el.dataset.page !== page;
  });
  byId("page-title").textContent = t(TITLES[page]);
  byId("back-btn").hidden = page === "game";
  closeMenu();
  window.scrollTo(0, 0);
  if (page === "history") renderHistory();
}

// The solves that the "more" buttons refer to (indexes of the last rendering)
let shownEntries: HistoryEntry[] = [];
let replayHandler: (entry: HistoryEntry) => boolean = () => false;

const MORE_ICON =
  '<svg class="icon" aria-hidden="true"><use href="#i-ellipsis-circle-outline" /></svg>';

/** Button that opens the details of a level or of a solve */
const moreButton = (attr: string, label: string) =>
  `<button type="button" class="more-btn" ${attr} title="${label}" aria-label="${label}">${MORE_ICON}</button>`;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(dateLocale(), { year: "2-digit", month: "numeric", day: "numeric" });

/** The time of a solve for the lists: the wand in front, an icon instead of the time for practice */
const timeCell = (e: HistoryEntry) =>
  helpIcons(e) + (e.practice ? practiceIcon() : formatTime(e.seconds));

const infoRow = (name: string, value: string) => `<tr><th>${name}</th><td>${value}</td></tr>`;

function replayButton(index: number): string {
  return `<button type="button" class="action-btn" data-replay="${index}">${t(
    "history.replay"
  )}</button>`;
}

/** Details of a solve: level, date, time and the replay button */
function solveDetails(index: number): string {
  const e = shownEntries[index];
  return (
    '<table class="info-table">' +
    infoRow(t("history.d.level"), levelName(e.level)) +
    infoRow(t("history.d.date"), new Date(e.date).toLocaleString(dateLocale())) +
    infoRow(
      t("history.d.time"),
      helpIcons(e) +
        formatTime(e.seconds) +
        (usedHelp(e) || e.practice
          ? ` (${[
              usedHelp(e) ? t("history.d.help") : "",
              e.practice ? t("history.d.practice") : "",
            ]
              .filter((text) => text)
              .join(", ")})`
          : "")
    ) +
    "</table>" +
    replayButton(index)
  );
}

function openDialogById(id: string) {
  const dlg = byId<HTMLDialogElement>(id);
  if (!dlg.open) dlg.showModal();
}

function showSolve(index: number) {
  const e = shownEntries[index];
  byId("solve-info-title").textContent = t("history.solve.title", {
    level: levelName(e.level),
  });
  byId("solve-info-body").innerHTML = solveDetails(index);
  openDialogById("solve-info");
}

/** Details of a level: the best solve, the numbers of solves and all solves */
function showLevel(level: number) {
  const count = settings.countAutoFill;
  const best = bestEntry(shownEntries, level, count);
  const stats = solveStats(shownEntries, level);
  const statsRow = (name: string, s: SolveStats) =>
    `<tr><td>${name}</td><td class="num">${s.count}</td><td class="num">${
      s.average === null ? "-" : formatTime(s.average)
    }</td></tr>`;
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
    `<tr><th></th><th class="num">${t("history.col.solved")}</th><th class="num">${t(
      "history.col.average"
    )}</th></tr>` +
    statsRow(t("history.row.nohelp"), stats.unassisted) +
    // The solves with help only if there are any
    (stats.assisted.count > 0 ? statsRow(t("history.row.help"), stats.assisted) : "") +
    // All of them, if both kinds exist (otherwise it is the same as a row above)
    (stats.assisted.count > 0 && stats.unassisted.count > 0
      ? statsRow(t("history.row.all"), stats.all)
      : "") +
    "</table>" +
    `<h3>${t("history.all.solves")}</h3>` +
    '<table class="stats">' +
    indexes
      .map(
        (i) =>
          `<tr><td>${shortDate(shownEntries[i].date)}</td><td class="num">${timeCell(
            shownEntries[i]
          )}</td><td class="num">${moreButton(
            `data-solve="${i}"`,
            t("history.more.solve")
          )}</td></tr>`
      )
      .join("") +
    "</table>";
  openDialogById("level-info");
}

// Personal leaderboard: best solve per level and the most recent solves
async function renderHistory() {
  const [entries] = await Promise.all([loadHistory(), loadSettings()]);
  shownEntries = entries;
  const count = settings.countAutoFill;
  byId("history-empty").hidden = entries.length > 0;
  byId("history-content").hidden = entries.length === 0;

  const row = (cells: string[], tag = "td") =>
    "<tr>" +
    cells
      .map((c, i) => `<${tag}${i > 0 ? ' class="num"' : ""}>${c}</${tag}>`)
      .join("") +
    "</tr>";

  // The practice solves are only listed in the recent solves
  const timed = entries.filter((e) => !e.practice);
  const levels = [...new Set(timed.map((e) => e.level))].sort((a, b) => a - b);
  byId("history-levels").innerHTML =
    row(
      [t("history.col.level"), t("history.col.best"), t("history.col.date"), ""],
      "th"
    ) +
    levels
      .map((level) => {
        const best = bestEntry(entries, level, count);
        // With only solves with help the best time gets the icons of its help
        const helpOnly = onlyHelpedSolves(entries, level, count);
        return row([
          levelName(level),
          best === null ? "-" : (helpOnly ? helpIcons(best) : "") + formatTime(best.seconds),
          best === null ? "-" : shortDate(best.date),
          moreButton(
            `data-level="${level}"`,
            t("history.more.level", { level: levelName(level) })
          ),
        ]);
      })
      .join("");

  const firstRecent = Math.max(0, entries.length - RECENT_ENTRIES);
  const recent = entries.map((e, i) => i).slice(firstRecent).reverse();
  byId("history-recent").innerHTML =
    row(
      [t("history.col.date"), t("history.col.level"), t("history.col.time"), ""],
      "th"
    ) +
    recent
      .map((i) =>
        row([
          shortDate(entries[i].date),
          levelName(entries[i].level),
          timeCell(entries[i]),
          moreButton(`data-solve="${i}"`, t("history.more.solve")),
        ])
      )
      .join("");
  byId("history-note").hidden = !recent.some((i) => entries[i].autoFill);
  byId("history-note-mistakes").hidden = !recent.some((i) => entries[i].mistakes);
  byId("history-note-practice").hidden = !recent.some((i) => entries[i].practice);
}

/** The buttons of the history: details of a level or a solve, play a solve again */
function setupHistory() {
  byId("history").addEventListener("click", (e) => {
    const btn = (e.target as Element).closest<HTMLElement>(".more-btn");
    if (!btn) return;
    if (btn.dataset.level !== undefined) showLevel(Number(btn.dataset.level));
    else if (btn.dataset.solve !== undefined) showSolve(Number(btn.dataset.solve));
  });
  // Inside the dialogs: the details of a solve of the list of a level, replay
  for (const id of ["level-info", "solve-info"]) {
    byId(id).addEventListener("click", (e) => {
      const target = e.target as Element;
      const more = target.closest<HTMLElement>(".more-btn[data-solve]");
      if (more) {
        showSolve(Number(more.dataset.solve));
        return;
      }
      const replay = target.closest<HTMLElement>("[data-replay]");
      if (!replay) return;
      if (replayHandler(shownEntries[Number(replay.dataset.replay)])) {
        byId<HTMLDialogElement>("solve-info").close();
        byId<HTMLDialogElement>("level-info").close();
        byId("back-btn").click(); // back to the game
      } else {
        // The sudoku is not stored (or not valid)
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

// The info buttons of the toggle settings: their texts (the title is the name of the setting)
const SETTING_INFO: { [key: string]: { title: MessageKey; text: MessageKey } } = {
  practice: { title: "settings.practice", text: "info.practice" },
  "show-time": { title: "settings.show-time", text: "info.show-time" },
  "count-wand": { title: "settings.count-wand", text: "info.count-wand" },
};

function setupSettings() {
  document.querySelectorAll<HTMLButtonElement>(".info-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      // The button is part of the label of the setting: do not toggle it
      e.preventDefault();
      e.stopPropagation();
      const info = SETTING_INFO[btn.dataset.info!];
      byId("info-title").textContent = t(info.title);
      byId("info-desc").textContent = t(info.text);
      byId<HTMLDialogElement>("info").showModal();
    })
  );
  const level = byId<HTMLSelectElement>("setting-level");
  levelNames().forEach((name, i) => level.add(new Option(name, String(i))));
  const theme = byId<HTMLSelectElement>("setting-theme");
  const language = byId<HTMLSelectElement>("setting-language");
  const countAutoFill = byId<HTMLInputElement>("setting-count-autofill");
  const practice = byId<HTMLInputElement>("setting-practice");
  const showTime = byId<HTMLInputElement>("setting-show-time");
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
    settings.language = language.value as LanguageSetting;
    setLanguage(resolveLanguage(settings.language));
    saveSettings();
  });
  // The texts that are not static change with the language
  onLanguageChange(() => {
    levelNames().forEach((name, i) => (level.options[i].text = name));
    byId("page-title").textContent = t(TITLES[currentPage()]);
    if (currentPage() === "history") renderHistory();
  });
  theme.addEventListener("change", () => {
    settings.theme = theme.value as Theme;
    applyTheme(settings.theme);
    saveSettings();
  });
}

// Keyboard shortcuts are only listed where a keyboard is likely: with a mouse
// as primary pointer (also covers laptops with a touch screen) or without any
// touch screen.
function keyboardLikely(): boolean {
  return (
    matchMedia("(hover: hover) and (pointer: fine)").matches ||
    navigator.maxTouchPoints === 0
  );
}

// The Android back button / gesture. Capacitor does not handle it itself, that
// is done by the App plugin (called through the bridge, as the page has no
// bundler): without a listener the back gesture closes the app. It closes
// what is open (dialog, menu), returns from a page to the game and only
// closes the app from the game.
function setupAndroidBack() {
  const app = (window as any).Capacitor?.Plugins?.App;
  if (!app?.addListener) return;
  app.addListener("backButton", () => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
    if (dialog) {
      // like the Escape key: persistent dialogs stay open
      if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
    } else if (!byId("menu").hidden) {
      closeMenu();
    } else if (currentPage() !== "game") {
      byId("back-btn").click();
    } else {
      app.exitApp();
    }
  });
}

/**
 * @param replay Replays the sudoku of a solve,
 *   returns whether it was started
 */
export function setupPages(replay: (entry: HistoryEntry) => boolean) {
  replayHandler = replay;
  byId("keyboard-help").hidden = !keyboardLikely();

  // History is [game, subpage] at most: opening a subpage from another one
  // replaces the entry, so the back button (and the Android back button) always
  // returns to the game. Without a game entry before (page opened directly with
  // a #hash), back just sets an empty hash.
  let prev = currentPage();
  let cameFromGame = false;
  window.addEventListener("hashchange", () => {
    const page = currentPage();
    if (page === "game") cameFromGame = false;
    else if (prev === "game") cameFromGame = true;
    prev = page;
    showPage();
  });
  byId("back-btn").addEventListener("click", () => {
    if (cameFromGame) history.back();
    else location.hash = "";
  });
  byId("menu").addEventListener("click", (e) => {
    const link = (e.target as Element).closest("a");
    if (link && currentPage() !== "game") {
      e.preventDefault();
      location.replace(link.getAttribute("href")!);
    }
  });

  byId("menu-btn").addEventListener("click", toggleMenu);
  // Clicking an entry navigates via its link; anywhere else closes the menu
  document.addEventListener("click", (e) => {
    if (!(e.target as Element).closest("#menu-btn")) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  setupAndroidBack();
  setupSettings();
  setupHistory();
  showPage();
}
