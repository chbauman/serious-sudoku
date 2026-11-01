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

/**
 * The solves of a level that count for the best and average times: the ones
 * that count (see isCounted), or all but the practice solves as long as the
 * level was never solved without help (the magic wand).
 */
function countedSolves(
  entries: HistoryEntry[],
  level: number,
  countAutoFill: boolean
): HistoryEntry[] {
  const ofLevel = entries.filter((e) => e.level === level);
  const counted = ofLevel.filter((e) => isCounted(e, countAutoFill));
  return counted.length > 0 ? counted : ofLevel.filter((e) => !e.practice);
}

/** Best time of a level, only of the solves that count (null if there is none) */
export function bestTime(
  entries: HistoryEntry[],
  level: number,
  countAutoFill = true
): number | null {
  const times = countedSolves(entries, level, countAutoFill).map((e) => e.seconds);
  return times.length ? Math.min(...times) : null;
}

/** Average time of a level, only of the solves that count (null if there is none) */
export function averageTime(
  entries: HistoryEntry[],
  level: number,
  countAutoFill = true
): number | null {
  const times = countedSolves(entries, level, countAutoFill).map((e) => e.seconds);
  return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
}

/**
 * Stores a finished sudoku, returns the previous best time of its level.
 * isBest is false for a solve that does not count (auto-filled pencil marks
 * with countAutoFill off, or practice mode), it is still stored. Solves with
 * auto-filled pencil marks count anyway as long as the level was never solved
 * without help.
 */
export async function recordSolve(
  entry: HistoryEntry,
  countAutoFill = true
): Promise<{ previousBest: number | null; isBest: boolean; counted: boolean }> {
  const entries = await loadHistory();
  const ofLevel = entries.filter((e) => e.level === entry.level);
  const clean = ofLevel.filter((e) => isCounted(e, countAutoFill));
  const counted =
    isCounted(entry, countAutoFill) || (clean.length === 0 && !entry.practice);
  // The solves to beat: the ones that count like the entry; a solve that does
  // not count is compared with the current best time of the level
  const rivals = isCounted(entry, countAutoFill)
    ? clean
    : counted
    ? ofLevel.filter((e) => !e.practice)
    : [];
  const previousBest = counted
    ? rivals.length
      ? Math.min(...rivals.map((e) => e.seconds))
      : null
    : bestTime(entries, entry.level, countAutoFill);
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
