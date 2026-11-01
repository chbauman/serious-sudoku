// User settings, stored with the saved game (see storage.ts)
import { storageGet, storageSet } from "./storage.js";
import { MAX_LEVEL } from "./sudoku.js";

export type Theme = "auto" | "light" | "dark";

export interface Settings {
  /** Level of the sudoku that is loaded when the app starts without a saved game */
  level: number;
  theme: Theme;
  /** Solves with auto-filled pencil marks (the magic wand) count for the best times */
  countAutoFill: boolean;
  /**
   * Practice mode: the solved sudokus are not recorded in the history (so they do
   * not count for the best times)
   */
  practiceMode: boolean;
  /** Show the time below the buttons (independent of the practice mode) */
  showTime: boolean;
}

const SETTINGS_KEY = "serious-sudoku:settings:v1";

export const settings: Settings = {
  level: 2,
  theme: "auto",
  countAutoFill: false,
  practiceMode: false,
  showTime: true,
};

// theme-color of the browser / app UI, matching the page background
const THEME_COLORS = { light: "#ffffff", dark: "#16181d" };

/** Applies the theme: "auto" follows the system, the others force a theme. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;

  const metas = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  metas.forEach((meta) => {
    const dark = meta.media.includes("dark");
    const color =
      theme === "auto"
        ? THEME_COLORS[dark ? "dark" : "light"]
        : THEME_COLORS[theme];
    meta.content = color;
  });
}

let loading: Promise<void> | null = null;

/** Loads the stored settings once (later calls return the same promise) */
export function loadSettings(): Promise<void> {
  return (loading ??= readSettings());
}

async function readSettings() {
  try {
    const raw = await storageGet(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Number.isInteger(s.level) && s.level >= 0 && s.level <= MAX_LEVEL) {
        settings.level = s.level;
      }
      if (["auto", "light", "dark"].includes(s.theme)) settings.theme = s.theme;
      if (typeof s.countAutoFill === "boolean") settings.countAutoFill = s.countAutoFill;
      if (typeof s.practiceMode === "boolean") settings.practiceMode = s.practiceMode;
      if (typeof s.showTime === "boolean") settings.showTime = s.showTime;
    }
  } catch (e) {
    // keep the defaults
  }
  applyTheme(settings.theme);
}

export function saveSettings() {
  storageSet(SETTINGS_KEY, JSON.stringify(settings));
}
