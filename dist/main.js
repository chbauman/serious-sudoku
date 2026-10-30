import { initGrid, setButtons, htmlButtonDict, digits, log, elsewhere, clickCell, } from "./html_util.js";
import { setupPages } from "./pages.js";
let initialized = false;
const getDocEl = (id) => {
    const res = document.getElementById(id);
    if (res === undefined || res === null) {
        throw new Error("Undefined!");
    }
    return res;
};
export function init() {
    if (initialized) {
        return;
    }
    else {
        initialized = true;
    }
    document.addEventListener("click", (e) => {
        const target = e.target;
        if (!target.closest("dialog, [data-open], .bar button, #menu, #digits")) {
            elsewhere();
        }
    });
    const butIds = [
        "mode-but",
        "undo-but",
        "info-title",
        "info-desc",
        "confirm-title",
        "confirm-desc",
        "confirm-yes",
        "confirm-cancel",
        "restart_but",
        "auto-fill-button",
        "but1",
        "but3",
        "own_sud",
        "own-sud-text",
        "tools-btn",
        "finish-input",
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
    for (let i = 0; i < 10; i++)
        digits[i] = getDocEl("digit-" + String(i));
    const tbl = getDocEl("grid");
    initGrid(tbl);
    log("Initialized grid!");
    tbl.addEventListener("click", (e) => {
        const cell = e.target.closest(".gridCell");
        if (cell) {
            clickCell(cell);
            e.stopPropagation();
        }
    });
    log("Setup buttons!");
}
if ("serviceWorker" in navigator &&
    !location.pathname.includes("/src/") &&
    !("Capacitor" in window)) {
    navigator.serviceWorker
        .register("sw.js")
        .catch((e) => log("Service worker registration failed: " + e));
}
init();
//# sourceMappingURL=main.js.map