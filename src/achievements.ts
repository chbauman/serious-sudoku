// Achievements: unlocked when a sudoku is solved (see awardAchievements), stored
// locally with the date. The ones that only need the level and the time are
// also given for the solves that are already in the history (once).
import { storageGet, storageSet } from "./storage.js";
import { loadHistory, usedHelp, HistoryEntry } from "./history.js";
import { t } from "./i18n.js";
import { LEVEL_COUNT, levelName } from "./sudoku.js";

/** What is known about a solved sudoku (the last three only for the solves of the current game) */
export interface SolveInfo {
  level: number;
  seconds: number;
  /** Solved in practice mode */
  practice: boolean;
  /** Pencil marks were filled in or mistakes were found */
  helped: boolean;
  /** Any pencil mark was set */
  pencil?: boolean;
  /** Deepest nesting of guesses */
  guessDepth?: number;
  /** Reached the state where all nine cells of one digit were left, all the others were done */
  digitLast?: boolean;
}

export interface Achievement {
  id: string;
  title: () => string;
  text: () => string;
  /** Whether the solve earns it (practice solves and solves with help are excluded before) */
  earned: (s: SolveInfo) => boolean;
}

const TOP_LEVEL = LEVEL_COUNT - 1;
const HOUR = 3600;
const FAST_SECONDS = 5 * 60;

/** All achievements, in the order of the list (the open ones are shown from the top) */
export const ACHIEVEMENTS: Achievement[] = [
  ...Array.from({ length: LEVEL_COUNT }, (_, level): Achievement => ({
    id: `level-${level}`,
    title: () => t("ach.level.title", { level: levelName(level) }),
    text: () => t("ach.level.text", { level: levelName(level) }),
    earned: (s) => s.level === level,
  })),
  ...Array.from({ length: LEVEL_COUNT }, (_, level): Achievement => ({
    id: `fast-${level}`,
    title: () => t("ach.fast.title", { level: levelName(level) }),
    text: () => t("ach.fast.text", { level: levelName(level) }),
    earned: (s) => s.level === level && s.seconds < FAST_SECONDS,
  })),
  {
    id: "no-pencil",
    title: () => t("ach.no-pencil.title"),
    text: () => t("ach.no-pencil.text"),
    earned: (s) => s.pencil === false,
  },
  {
    id: "no-pencil-top",
    title: () => t("ach.no-pencil-top.title"),
    text: () => t("ach.no-pencil-top.text", { level: levelName(TOP_LEVEL) }),
    earned: (s) => s.pencil === false && s.level === TOP_LEVEL,
  },
  {
    id: "marathon",
    title: () => t("ach.marathon.title"),
    text: () => t("ach.marathon.text"),
    earned: (s) => s.seconds > HOUR,
  },
  {
    id: "deep",
    title: () => t("ach.deep.title"),
    text: () => t("ach.deep.text"),
    earned: (s) => (s.guessDepth ?? 0) >= 4,
  },
  {
    id: "one-digit",
    title: () => t("ach.one-digit.title"),
    text: () => t("ach.one-digit.text"),
    earned: (s) => s.digitLast === true,
  },
];

export const achievementById = (id: string): Achievement | undefined =>
  ACHIEVEMENTS.find((a) => a.id === id);

/** The achievements that a solve earns (none for practice solves and solves with help) */
export function earnedBy(s: SolveInfo): Achievement[] {
  return s.practice || s.helped ? [] : ACHIEVEMENTS.filter((a) => a.earned(s));
}

/** The facts of a solve that are in the history */
export const infoOfEntry = (e: HistoryEntry): SolveInfo => ({
  level: e.level,
  seconds: e.seconds,
  practice: e.practice === true,
  helped: usedHelp(e),
});

/** Achievement id -> ISO date it was unlocked */
type Unlocked = { [id: string]: string };

interface Store {
  unlocked: Unlocked;
  /** The solves of the history are checked once */
  imported: boolean;
}

const ACHIEVEMENTS_KEY = "serious-sudoku:achievements:v1";

let loading: Promise<Store> | null = null;

const save = (store: Store) => storageSet(ACHIEVEMENTS_KEY, JSON.stringify(store));

/** Unlocks what the entries (oldest first) earn and are not unlocked yet, returns whether something is new */
export function importEntries(store: Store, entries: HistoryEntry[]): boolean {
  let changed = false;
  for (const e of entries) {
    for (const a of earnedBy(infoOfEntry(e))) {
      if (!(a.id in store.unlocked)) {
        store.unlocked[a.id] = e.date;
        changed = true;
      }
    }
  }
  return changed;
}

function loadStore(): Promise<Store> {
  return (loading ??= (async () => {
    const store: Store = { unlocked: {}, imported: false };
    try {
      const raw = await storageGet(ACHIEVEMENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed.unlocked === "object" && parsed.unlocked !== null) {
        for (const a of ACHIEVEMENTS) {
          if (typeof parsed.unlocked[a.id] === "string") store.unlocked[a.id] = parsed.unlocked[a.id];
        }
        store.imported = parsed.imported === true;
      }
    } catch (e) {
      // start without
    }
    if (!store.imported) {
      importEntries(store, await loadHistory());
      store.imported = true;
      save(store);
    }
    return store;
  })());
}

/**
 * Unlocks the achievements that a solve earns. Call it before the solve is
 * added to the history (the first time the history is imported).
 * @returns the achievements that are new
 */
export async function awardAchievements(
  info: SolveInfo,
  date = new Date().toISOString()
): Promise<Achievement[]> {
  const store = await loadStore();
  const fresh = earnedBy(info).filter((a) => !(a.id in store.unlocked));
  if (fresh.length > 0) {
    for (const a of fresh) store.unlocked[a.id] = date;
    save(store);
  }
  return fresh;
}

/** How many open achievements are shown */
export const NEXT_COUNT = 3;

export interface AchievementStatus {
  /** The unlocked ones, the latest first */
  done: { achievement: Achievement; date: string }[];
  /** The first open ones of the list */
  next: Achievement[];
  total: number;
}

export async function achievementStatus(): Promise<AchievementStatus> {
  const store = await loadStore();
  const done = ACHIEVEMENTS.filter((a) => a.id in store.unlocked)
    .map((achievement) => ({ achievement, date: store.unlocked[achievement.id] }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const next = ACHIEVEMENTS.filter((a) => !(a.id in store.unlocked)).slice(0, NEXT_COUNT);
  return { done, next, total: ACHIEVEMENTS.length };
}
