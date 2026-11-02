// Page navigation: the game, help, settings, history and about are "pages" of
// the single index.html, selected by the URL hash (#help, #settings, ...). The hamburger menu
// in the header opens the other pages, the back button (and the Android back
// button) return to the game.
import {
  loadHistory,
  bestEntry,
  onlyWandSolves,
  solveCounts,
  formatTime,
  HistoryEntry,
} from "./history.js";
import { LEVEL_NAMES, levelName } from "./sudoku.js";
import {
  settings,
  loadSettings,
  saveSettings,
  applyTheme,
  Theme,
} from "./settings.js";

const TITLES: { [page: string]: string } = {
  game: "Serious Sudoku",
  help: "Help",
  settings: "Settings",
  history: "History",
  about: "About",
};

/** Number of recent solves shown on the history page */
const RECENT_ENTRIES = 10;

/** Marks the solves with auto-filled pencil marks in the history */
const WAND =
  '<svg class="icon inline-icon" role="img" aria-label="Pencil marks filled in automatically">' +
  '<use href="#i-color-wand-outline" /></svg> ';

/** Marks the solves in practice mode in the history (instead of the time) */
const PRACTICE =
  '<svg class="icon inline-icon" role="img" aria-label="Practice, no time">' +
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
  byId("page-title").textContent = TITLES[page];
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
  new Date(iso).toLocaleDateString(undefined, { year: "2-digit", month: "numeric", day: "numeric" });

/** The time of a solve for the lists: the wand in front, an icon instead of the time for practice */
const timeCell = (e: HistoryEntry) =>
  (e.autoFill ? WAND : "") + (e.practice ? PRACTICE : formatTime(e.seconds));

const infoRow = (name: string, value: string) => `<tr><th>${name}</th><td>${value}</td></tr>`;

/** Button to play a solve again, only if its sudoku is stored */
function replayButton(index: number): string {
  const e = shownEntries[index];
  return e.puzzle
    ? `<button type="button" class="action-btn" data-replay="${index}">Play again</button>` +
        '<p class="info-note">The sudoku is shuffled differently.</p>'
    : '<p class="info-note">The sudoku of this solve is not stored, it cannot be played again.</p>';
}

/** Details of a solve: level, date, time, ID and the button to play it again */
function solveDetails(index: number): string {
  const e = shownEntries[index];
  return (
    '<table class="info-table">' +
    infoRow("Level", levelName(e.level)) +
    infoRow("Date", new Date(e.date).toLocaleString()) +
    infoRow("Time", formatTime(e.seconds) + (e.practice ? " (practice)" : "")) +
    (e.autoFill ? infoRow("Pencil marks", WAND + "filled in automatically") : "") +
    infoRow("ID", `#${e.id.split("-")[1]}`) +
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
  byId("solve-info-title").textContent = `${levelName(e.level)} sudoku`;
  byId("solve-info-body").innerHTML = solveDetails(index);
  openDialogById("solve-info");
}

/** Details of a level: the best solve, the numbers of solves and all solves */
function showLevel(level: number) {
  const count = settings.countAutoFill;
  const best = bestEntry(shownEntries, level, count);
  const counts = solveCounts(shownEntries, level);
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
    infoRow("Without the wand", String(counts.unassisted)) +
    infoRow("Including the wand", String(counts.all)) +
    "</table>" +
    "<h3>All solves</h3>" +
    '<table class="stats">' +
    indexes
      .map(
        (i) =>
          `<tr><td>${shortDate(shownEntries[i].date)}</td><td class="num">${timeCell(
            shownEntries[i]
          )}</td><td class="num">${moreButton(`data-solve="${i}"`, "Details of this solve")}</td></tr>`
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
    row(["Level", "Best", "Date", ""], "th") +
    levels
      .map((level) => {
        const best = bestEntry(entries, level, count);
        // With only wand solves the best time gets the wand
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
      .map((i) =>
        row([
          shortDate(entries[i].date),
          levelName(entries[i].level),
          timeCell(entries[i]),
          moreButton(`data-solve="${i}"`, "Details of this solve"),
        ])
      )
      .join("");
  byId("history-note").hidden = !recent.some((i) => entries[i].autoFill);
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
  // Inside the dialogs: the details of a solve of the list of a level, play again
  for (const id of ["level-info", "solve-info"]) {
    byId(id).addEventListener("click", (e) => {
      const target = e.target as Element;
      const more = target.closest<HTMLElement>(".more-btn[data-solve]");
      if (more) {
        showSolve(Number(more.dataset.solve));
        return;
      }
      const replay = target.closest<HTMLElement>("[data-replay]");
      if (replay && replayHandler(shownEntries[Number(replay.dataset.replay)])) {
        byId<HTMLDialogElement>("solve-info").close();
        byId<HTMLDialogElement>("level-info").close();
        byId("back-btn").click(); // back to the game
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

// Longer explanations of the toggle settings, shown by their info buttons
const SETTING_INFO: { [key: string]: { title: string; text: string } } = {
  practice: {
    title: "Practice mode",
    text:
      "Solves are listed in the history with a practice icon instead of a time and " +
      "do not count for the best times.",
  },
  "show-time": {
    title: "Show time",
    text: "Shows the time below the buttons. The solving is timed either way.",
  },
  "count-wand": {
    title: "Count wand solves",
    text:
      "Solves with auto-filled pencil marks (the magic wand) only count for the best " +
      "times if this is on, or as long as the level was never solved without help. " +
      "They are always listed in the history.",
  },
};

function setupSettings() {
  document.querySelectorAll<HTMLButtonElement>(".info-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      // The button is part of the label of the setting: do not toggle it
      e.preventDefault();
      e.stopPropagation();
      const info = SETTING_INFO[btn.dataset.info!];
      byId("info-title").textContent = info.title;
      byId("info-desc").textContent = info.text;
      byId<HTMLDialogElement>("info").showModal();
    })
  );
  const level = byId<HTMLSelectElement>("setting-level");
  LEVEL_NAMES.forEach((name, i) => level.add(new Option(name, String(i))));
  const theme = byId<HTMLSelectElement>("setting-theme");
  const countAutoFill = byId<HTMLInputElement>("setting-count-autofill");
  const practice = byId<HTMLInputElement>("setting-practice");
  const showTime = byId<HTMLInputElement>("setting-show-time");
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
 * @param replay Plays the sudoku of a solve again (shuffled differently),
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
