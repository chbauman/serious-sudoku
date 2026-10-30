// This is the main TypeScript file, it imports all necessary funtions and
// variables from `html_utils`.
//
// Import sudoku module
import {
  initGrid,
  setButtons,
  htmlButtonDict,
  digits,
  log,
  elsewhere,
  clickCell,
} from "./html_util.js";
import { setupPages } from "./pages.js";

// State Variables
let initialized = false;

const getDocEl = (id: string) => {
  const res = document.getElementById(id);
  if (res === undefined || res === null) {
    throw new Error("Undefined!");
  }
  return res;
};

// Initializing function
export function init() {
  // Abort if already called
  if (initialized) {
    return;
  } else {
    initialized = true;
  }
  // Clicking anywhere deselects the cell, except on dialogs and the buttons
  // that open them (cancelling must not lose the selection), the header
  // buttons and menu, and the digit pad (also between its buttons).
  document.addEventListener("click", (e) => {
    const target = e.target as Element;
    if (
      !target.closest(
        "dialog, [data-open], #auto-fill-button, .bar button, #menu, #digits"
      )
    ) {
      elsewhere();
    }
  });

  // Set button map
  const butIds = [
    "mode-but",
    "undo-but",
    "tools-note",
    "confirm-title",
    "confirm-desc",
    "confirm-yes",
    "confirm-cancel",
    "restart_but",
    "auto-fill-button",
    "but1",
    "but3",
    "own_sud",
    "tools-btn",
    "tools-restart",
    "digits",
    "lvl_list",
    "solve",
    "check",
    "timer",
    "log-txt",
    "solved-text",
    "solved-h",
  ];
  for (const bId of butIds) {
    htmlButtonDict.set(bId, getDocEl(bId));
  }
  setButtons();
  setupPages();

  // Set digits
  for (let i = 0; i < 10; i++) digits[i] = getDocEl("digit-" + String(i));

  // Initialize grid
  const tbl = getDocEl("grid") as HTMLTableElement;
  initGrid(tbl);
  log("Initialized grid!");

  // click on cells
  tbl.addEventListener("click", (e) => {
    const cell = (e.target as Element).closest<HTMLTableCellElement>(".gridCell");
    if (cell) {
      clickCell(cell);
      e.stopPropagation();
    }
  });

  log("Setup buttons!");
}

// Offline support / installability. Only in the deployed layout: the local dev
// server serves the page from /src/, where the service worker paths differ.
// Not needed in the Android app, which bundles all files.
if (
  "serviceWorker" in navigator &&
  !location.pathname.includes("/src/") &&
  !("Capacitor" in window)
) {
  navigator.serviceWorker
    .register("sw.js")
    .catch((e) => log("Service worker registration failed: " + e));
}

// Initialize
init();
