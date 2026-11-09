import { storageGet, storageSet } from "./storage.js";
import { loadHistory, usedHelp } from "./history.js";
import { t } from "./i18n.js";
import { LEVEL_COUNT, levelName } from "./sudoku.js";
const TOP_LEVEL = LEVEL_COUNT - 1;
const HOUR = 3600;
export const ACHIEVEMENTS = [
    ...Array.from({ length: LEVEL_COUNT }, (_, level) => ({
        id: `level-${level}`,
        title: () => t("ach.level.title", { level: levelName(level) }),
        text: () => t("ach.level.text", { level: levelName(level) }),
        earned: (s) => s.level === level,
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
        id: "lightning",
        title: () => t("ach.lightning.title"),
        text: () => t("ach.lightning.text", { level: levelName(TOP_LEVEL) }),
        earned: (s) => s.level === TOP_LEVEL && s.seconds < 5 * 60,
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
export function earnedBy(s) {
    return s.practice || s.helped ? [] : ACHIEVEMENTS.filter((a) => a.earned(s));
}
export const infoOfEntry = (e) => ({
    level: e.level,
    seconds: e.seconds,
    practice: e.practice === true,
    helped: usedHelp(e),
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
        const store = { unlocked: {}, imported: false };
        try {
            const raw = await storageGet(ACHIEVEMENTS_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed.unlocked === "object" && parsed.unlocked !== null) {
                for (const a of ACHIEVEMENTS) {
                    if (typeof parsed.unlocked[a.id] === "string")
                        store.unlocked[a.id] = parsed.unlocked[a.id];
                }
                store.imported = parsed.imported === true;
            }
        }
        catch (e) {
        }
        if (!store.imported) {
            importEntries(store, await loadHistory());
            store.imported = true;
            save(store);
        }
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
    const done = ACHIEVEMENTS.filter((a) => a.id in store.unlocked)
        .map((achievement) => ({ achievement, date: store.unlocked[achievement.id] }))
        .sort((a, b) => b.date.localeCompare(a.date));
    const next = ACHIEVEMENTS.filter((a) => !(a.id in store.unlocked)).slice(0, NEXT_COUNT);
    return { done, next, total: ACHIEVEMENTS.length };
}
//# sourceMappingURL=achievements.js.map