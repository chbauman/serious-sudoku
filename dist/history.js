import { storageGet, storageSet } from "./storage.js";
const HISTORY_KEY = "serious-sudoku:history:v1";
const MAX_ENTRIES = 500;
let loading = null;
const isEntry = (e) => typeof e?.id === "string" &&
    Number.isInteger(e.level) &&
    (e.puzzle === undefined || typeof e.puzzle === "string") &&
    (e.autoFill === undefined || typeof e.autoFill === "boolean") &&
    (e.practice === undefined || typeof e.practice === "boolean") &&
    typeof e.seconds === "number" &&
    typeof e.date === "string";
export function loadHistory() {
    return (loading ?? (loading = (async () => {
        try {
            const raw = await storageGet(HISTORY_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
        }
        catch (e) {
            return [];
        }
    })()));
}
export function isCounted(e, countAutoFill) {
    return !e.practice && (countAutoFill || !e.autoFill);
}
export function bestTime(entries, level, countAutoFill = true) {
    const times = entries
        .filter((e) => e.level === level && isCounted(e, countAutoFill))
        .map((e) => e.seconds);
    return times.length ? Math.min(...times) : null;
}
export function averageTime(entries, level, countAutoFill = true) {
    const times = entries
        .filter((e) => e.level === level && isCounted(e, countAutoFill))
        .map((e) => e.seconds);
    return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
}
export async function recordSolve(entry, countAutoFill = true) {
    const entries = await loadHistory();
    const previousBest = bestTime(entries, entry.level, countAutoFill);
    const counted = isCounted(entry, countAutoFill);
    entries.push(entry);
    if (entries.length > MAX_ENTRIES)
        entries.splice(0, entries.length - MAX_ENTRIES);
    storageSet(HISTORY_KEY, JSON.stringify(entries));
    return {
        previousBest,
        isBest: counted && (previousBest === null || entry.seconds < previousBest),
        counted,
    };
}
export function formatTime(seconds) {
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
//# sourceMappingURL=history.js.map