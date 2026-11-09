import { storageGet, storageSet } from "./storage.js";
import { loadHistory, usedHelp } from "./history.js";
import { t } from "./i18n.js";
import { LEVEL_COUNT, levelName } from "./sudoku.js";
const TOP_LEVEL = LEVEL_COUNT - 1;
const HOUR = 3600;
const FAST_SECONDS = 5 * 60;
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
    return ACHIEVEMENTS.filter((a) => (clean || a.anySolve) && a.earned(s));
}
export const infoOfEntry = (e) => ({
    level: e.level,
    seconds: e.seconds,
    practice: e.practice === true,
    helped: usedHelp(e),
    fill: e.autoFill === true,
    mistakes: e.mistakes === true,
});
const ACHIEVEMENTS_KEY = "serious-sudoku-dev:achievements:v1";
let loading = null;
const save = (store) => storageSet(ACHIEVEMENTS_KEY, JSON.stringify(store));
export function importEntries(store, entries) {
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
function loadStore() {
    return (loading ?? (loading = (async () => {
        const store = { unlocked: {} };
        try {
            const raw = await storageGet(ACHIEVEMENTS_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed.unlocked === "object" && parsed.unlocked !== null) {
                for (const a of ACHIEVEMENTS) {
                    if (typeof parsed.unlocked[a.id] === "string")
                        store.unlocked[a.id] = parsed.unlocked[a.id];
                }
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
    const fresh = earnedBy(info).filter((a) => !(a.id in store.unlocked));
    if (fresh.length > 0) {
        for (const a of fresh)
            store.unlocked[a.id] = date;
        save(store);
    }
    return fresh;
}
export const NEXT_COUNT = 3;
export async function achievementStatus() {
    const store = await loadStore();
    const done = ACHIEVEMENTS.map((achievement, index) => ({ achievement, index }))
        .filter((a) => a.achievement.id in store.unlocked)
        .map((a) => ({ ...a, date: store.unlocked[a.achievement.id] }))
        .sort((a, b) => b.date.localeCompare(a.date) || b.index - a.index)
        .map(({ achievement, date }) => ({ achievement, date }));
    const next = ACHIEVEMENTS.filter((a) => !(a.id in store.unlocked)).slice(0, NEXT_COUNT);
    return { done, next, total: ACHIEVEMENTS.length };
}
//# sourceMappingURL=achievements.js.map