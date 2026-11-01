// Personal leaderboard: the solve times of finished sudokus, stored locally
// (same storage as the saved game, see storage.ts).
import { storageGet, storageSet } from "./storage.js";

export interface HistoryEntry {
  /** "<level>-<line number in the level file>" */
  id: string;
  level: number;
  /**
   * The sudoku as in the level file (before it is shuffled): its 81 digits row
   * by row, 0 = empty. Allows to rate the sudoku again if the levels change.
   */
  puzzle?: string;
  /** The pencil marks were filled in automatically (the magic wand) */
  autoFill?: boolean;
  /** Solved in practice mode: shown in the history, but without time for the leaderboard */
  practice?: boolean;
  seconds: number;
  /** ISO date of the solve */
  date: string;
}

const HISTORY_KEY = "serious-sudoku:history:v1";
const MAX_ENTRIES = 500;

let loading: Promise<HistoryEntry[]> | null = null;

const isEntry = (e: any): e is HistoryEntry =>
  typeof e?.id === "string" &&
  Number.isInteger(e.level) &&
  (e.puzzle === undefined || typeof e.puzzle === "string") &&
  (e.autoFill === undefined || typeof e.autoFill === "boolean") &&
  (e.practice === undefined || typeof e.practice === "boolean") &&
  typeof e.seconds === "number" &&
  typeof e.date === "string";

/** All entries, oldest first (loaded once, then kept in memory) */
export function loadHistory(): Promise<HistoryEntry[]> {
  return (loading ??= (async () => {
    try {
      const raw = await storageGet(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
    } catch (e) {
      return [];
    }
  })());
}

/** Whether a solve counts for the best and average times (never in practice mode) */
export function isCounted(e: HistoryEntry, countAutoFill: boolean): boolean {
  return !e.practice && (countAutoFill || !e.autoFill);
}

/** Best time of a level, only of the solves that count (null if there is none) */
export function bestTime(
  entries: HistoryEntry[],
  level: number,
  countAutoFill = true
): number | null {
  const times = entries
    .filter((e) => e.level === level && isCounted(e, countAutoFill))
    .map((e) => e.seconds);
  return times.length ? Math.min(...times) : null;
}

/** Average time of a level, only of the solves that count (null if there is none) */
export function averageTime(
  entries: HistoryEntry[],
  level: number,
  countAutoFill = true
): number | null {
  const times = entries
    .filter((e) => e.level === level && isCounted(e, countAutoFill))
    .map((e) => e.seconds);
  return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
}

/**
 * Stores a finished sudoku, returns the previous best time of its level.
 * isBest is false for a solve that does not count (auto-filled pencil marks
 * with countAutoFill off, or practice mode), it is still stored.
 */
export async function recordSolve(
  entry: HistoryEntry,
  countAutoFill = true
): Promise<{ previousBest: number | null; isBest: boolean; counted: boolean }> {
  const entries = await loadHistory();
  const previousBest = bestTime(entries, entry.level, countAutoFill);
  const counted = isCounted(entry, countAutoFill);
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  storageSet(HISTORY_KEY, JSON.stringify(entries));
  return {
    previousBest,
    isBest: counted && (previousBest === null || entry.seconds < previousBest),
    counted,
  };
}

/** 83 -> "1:23", 3725 -> "1:02:05" */
export function formatTime(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
