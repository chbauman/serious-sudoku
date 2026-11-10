import { storageGet, storageSet } from "./storage.js";
import { loadHistory, usedHelp } from "./history.js";
import { t } from "./i18n.js";
import { LEVEL_COUNT, levelName } from "./sudoku.js";
const TOP_LEVEL = LEVEL_COUNT - 1;
const HOUR = 3600;
const FAST_SECONDS = 5 * 60;
const TOTALS = [10, 20, 50, 100];
const NO_GUESS_LEVEL = 3;
export const ACHIEVEMENTS = [
    ...Array.from({ length: LEVEL_COUNT }, (_, level) => ({
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
    ...TOTALS.map((n) => ({
        id: `total-${n}`,
        title: () => t("ach.total.title", { n }),
        text: () => t("ach.total.text", { n }),
        earned: (s) => (s.total ?? 0) >= n,
    })),
    {
        id: "own",
        title: () => t("ach.own.title"),
        text: () => t("ach.own.text"),
        earned: (s) => s.own === true,
        forOwn: true,
    },
    ...Array.from({ length: LEVEL_COUNT }, (_, level) => ({
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
export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id);
export function earnedBy(s) {
    const clean = !s.practice && !s.helped;
    const own = s.own === true;
    return ACHIEVEMENTS.filter((a) => (a.forOwn === true) === own && (clean || a.anySolve) && a.earned(s));
}
export const infoOfEntry = (e) => ({
    level: e.level,
    seconds: e.seconds,
    practice: e.practice === true,
    helped: usedHelp(e),
    fill: e.autoFill === true,
    mistakes: e.mistakes === true,
});
const countsForTotal = (s) => !s.practice && !s.helped && s.own !== true;
const ACHIEVEMENTS_KEY = "serious-sudoku:achievements:v1";
let loading = null;
const save = (store) => storageSet(ACHIEVEMENTS_KEY, JSON.stringify(store));
export function importEntries(store, entries) {
    let changed = false;
    let total = 0;
    for (const e of entries) {
        const info = infoOfEntry(e);
        if (countsForTotal(info))
            total++;
        for (const a of earnedBy({ ...info, total })) {
            if (!(a.id in store.unlocked)) {
                store.unlocked[a.id] = e.date;
                changed = true;
            }
        }
    }
    if (total > store.solved) {
        store.solved = total;
        changed = true;
    }
    return changed;
}
function loadStore() {
    return (loading ?? (loading = (async () => {
        const store = { unlocked: {}, solved: 0 };
        try {
            const raw = await storageGet(ACHIEVEMENTS_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed.unlocked === "object" && parsed.unlocked !== null) {
                for (const a of ACHIEVEMENTS) {
                    if (typeof parsed.unlocked[a.id] === "string")
                        store.unlocked[a.id] = parsed.unlocked[a.id];
                }
                if (Number.isInteger(parsed.solved) && parsed.solved > 0)
                    store.solved = parsed.solved;
            }
        }
        catch (e) {
        }
        if (importEntries(store, await loadHistory()))
            save(store);
        return store;
    })()));
}
export async function awardAchievements(info, date = new Date().toISOString()) {
    const store = await loadStore();
    const counts = countsForTotal(info);
    const total = store.solved + (counts ? 1 : 0);
    const fresh = earnedBy({ ...info, total }).filter((a) => !(a.id in store.unlocked));
    for (const a of fresh)
        store.unlocked[a.id] = date;
    if (counts)
        store.solved = total;
    if (fresh.length > 0 || counts)
        save(store);
    return fresh;
}
export const NEXT_COUNT = 3;
export async function achievementStatus() {
    const store = await loadStore();
    const done = ACHIEVEMENTS.filter((a) => a.id in store.unlocked)
        .map((achievement) => ({ achievement, date: store.unlocked[achievement.id] }))
        .reverse();
    const next = ACHIEVEMENTS.filter((a) => !(a.id in store.unlocked)).slice(0, NEXT_COUNT);
    return { done, next, total: ACHIEVEMENTS.length };
}
//# sourceMappingURL=achievements.js.map