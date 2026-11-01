// Page navigation: the game, help, settings, history and about are "pages" of
// the single index.html, selected by the URL hash (#help, #settings, ...). The hamburger menu
// in the header opens the other pages, the back button (and the Android back
// button) return to the game.
import {
  loadHistory,
  bestTime,
  averageTime,
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
  ' <svg class="icon inline-icon" role="img" aria-label="Pencil marks filled in automatically">' +
  '<use href="#i-color-wand-outline" /></svg>';

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

// Personal leaderboard: best time per level and the most recent solves
async function renderHistory() {
  const [entries] = await Promise.all([loadHistory(), loadSettings()]);
  const count = settings.countAutoFill;
  byId("history-empty").hidden = entries.length > 0;
  byId("history-content").hidden = entries.length === 0;

  const row = (cells: string[], tag = "td") =>
    "<tr>" +
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

  const recent: HistoryEntry[] = entries.slice(-RECENT_ENTRIES).reverse();
  byId("history-recent").innerHTML =
    row(["Date", "Level", "Time", "ID"], "th") +
    recent
      .map((e) =>
        row([
          new Date(e.date).toLocaleDateString(),
          levelName(e.level),
          formatTime(e.seconds) + (e.autoFill ? WAND : ""),
          `#${e.id.split("-")[1]}`,
        ])
      )
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

function setupSettings() {
  const level = byId<HTMLSelectElement>("setting-level");
  LEVEL_NAMES.forEach((name, i) => level.add(new Option(name, String(i))));
  const theme = byId<HTMLSelectElement>("setting-theme");
  const countAutoFill = byId<HTMLInputElement>("setting-count-autofill");
  const practice = byId<HTMLInputElement>("setting-practice");
  const showTime = byId<HTMLInputElement>("setting-show-time");
  // The time is never shown in the practice mode
  const updateShowTime = () => {
    showTime.disabled = settings.practiceMode;
    showTime.closest("label")!.classList.toggle("disabled", settings.practiceMode);
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

export function setupPages() {
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
  showPage();
}
