// Achievements: unlocked when a sudoku is solved (see awardAchievements), stored
// locally with the date. The ones that only need the facts that the history has
// (level, time, practice mode, help) are also given for the solves that are
// already in the history, when the page is loaded.
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
  /** The pencil marks were filled in with the tool */
  fill?: boolean;
  /** The mistakes were found with the tool */
  mistakes?: boolean;
  /** Any pencil mark was set */
  pencil?: boolean;
  /** Deepest nesting of guesses (unknown for a game saved by an old version) */
  guessDepth?: number;
  /** A guess was rejected */
  rejected?: boolean;
  /** The sudoku came from the history (Replay) */
  replayed?: boolean;
  /** A sudoku that the player entered (no level, no time) */
  own?: boolean;
  /** Reached the state where all nine cells of one digit were left, all the others were done */
  digitLast?: boolean;
  /** Reached the state where only one 3x3 square without a digit of the player was left */
  squareLast?: boolean;
}

export interface Achievement {
  id: string;
  title: () => string;
  text: () => string;
  /** Whether the solve earns it */
  earned: (s: SolveInfo) => boolean;
  /** Also earned by practice solves and solves with help (otherwise they never earn it) */
  anySolve?: boolean;
  /** Only earned by the sudokus that the player entered (they earn nothing else) */
  forOwn?: boolean;
}

const TOP_LEVEL = LEVEL_COUNT - 1;
const HOUR = 3600;
const FAST_SECONDS = 5 * 60;
/** The level from which a solve without a guess is an achievement */
const NO_GUESS_LEVEL = 3;

/** All achievements, in the order of the list (the open ones are shown from the top) */
export const ACHIEVEMENTS: Achievement[] = [
  ...Array.from({ length: LEVEL_COUNT }, (_, level): Achievement => ({
    id: `level-${level}`,
    title: () => t("ach.level.title", { level: levelName(level) }),
    text: () => t("ach.level.text", { level: levelName(level) }),
    earned: (s) => s.level === level,
  })),
  {
    id: "practice",
    title: () => t("ach.practice.title"),
    text: () => t("ach.practice.text"),
    earned: (s) => s.practice,
    anySolve: true,
  },
  {
    id: "wand",
    title: () => t("ach.wand.title"),
    text: () => t("ach.wand.text"),
    earned: (s) => s.fill === true,
    anySolve: true,
  },
  {
    id: "detective",
    title: () => t("ach.detective.title"),
    text: () => t("ach.detective.text"),
    earned: (s) => s.mistakes === true,
    anySolve: true,
  },
  {
    id: "first-guess",
    title: () => t("ach.first-guess.title"),
    text: () => t("ach.first-guess.text"),
    earned: (s) => (s.guessDepth ?? 0) >= 1,
  },
  {
    id: "reject",
    title: () => t("ach.reject.title"),
    text: () => t("ach.reject.text"),
    earned: (s) => s.rejected === true,
  },
  {
    id: "replay",
    title: () => t("ach.replay.title"),
    text: () => t("ach.replay.text"),
    earned: (s) => s.replayed === true,
  },
  {
    id: "own",
    title: () => t("ach.own.title"),
    text: () => t("ach.own.text"),
    earned: (s) => s.own === true,
    forOwn: true,
  },
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
    id: "no-guess",
    title: () => t("ach.no-guess.title"),
    text: () => t("ach.no-guess.text", { level: levelName(NO_GUESS_LEVEL) }),
    earned: (s) => s.level >= NO_GUESS_LEVEL && s.guessDepth === 0,
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
  {
    id: "empty-square",
    title: () => t("ach.empty-square.title"),
    text: () => t("ach.empty-square.text"),
    earned: (s) => s.squareLast === true,
  },
];

export const achievementById = (id: string): Achievement | undefined =>
  ACHIEVEMENTS.find((a) => a.id === id);

/**
 * The achievements that a solve earns. Practice solves and solves with help
 * only earn the ones that are for them (anySolve).
 */
export function earnedBy(s: SolveInfo): Achievement[] {
  const clean = !s.practice && !s.helped;
  const own = s.own === true;
  return ACHIEVEMENTS.filter((a) => (a.forOwn === true) === own && (clean || a.anySolve) && a.earned(s));
}

/** The facts of a solve that are in the history */
export const infoOfEntry = (e: HistoryEntry): SolveInfo => ({
  level: e.level,
  seconds: e.seconds,
  practice: e.practice === true,
  helped: usedHelp(e),
  fill: e.autoFill === true,
  mistakes: e.mistakes === true,
});

/** Achievement id -> ISO date it was unlocked */
type Unlocked = { [id: string]: string };

interface Store {
  unlocked: Unlocked;
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
    const store: Store = { unlocked: {} };
    try {
      const raw = await storageGet(ACHIEVEMENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed.unlocked === "object" && parsed.unlocked !== null) {
        for (const a of ACHIEVEMENTS) {
          if (typeof parsed.unlocked[a.id] === "string") store.unlocked[a.id] = parsed.unlocked[a.id];
        }
      }
    } catch (e) {
      // start without
    }
    // The solves of the history give the achievements that they earn (quiet, with
    // the date of the solve): the first time, and for achievements that came later
    if (importEntries(store, await loadHistory())) save(store);
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
  /** The unlocked ones, the latest first (the harder one first among the ones of one solve) */
  done: { achievement: Achievement; date: string }[];
  /** The first open ones of the list */
  next: Achievement[];
  total: number;
}

export async function achievementStatus(): Promise<AchievementStatus> {
  const store = await loadStore();
  // Later in the list is harder: first among the ones with the same date
  const done = ACHIEVEMENTS.map((achievement, index) => ({ achievement, index }))
    .filter((a) => a.achievement.id in store.unlocked)
    .map((a) => ({ ...a, date: store.unlocked[a.achievement.id] }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.index - a.index)
    .map(({ achievement, date }) => ({ achievement, date }));
  const next = ACHIEVEMENTS.filter((a) => !(a.id in store.unlocked)).slice(0, NEXT_COUNT);
  return { done, next, total: ACHIEVEMENTS.length };
}
