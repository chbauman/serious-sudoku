import { en } from "./messages_en.js";
import { de } from "./messages_de.js";
export const LANGUAGES = ["en", "de"];
const catalogs = { en, de };
let language = "en";
const listeners = [];
export function getLanguage() {
    return language;
}
export function systemLanguage() {
    const preferred = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language];
    for (const tag of preferred) {
        const lang = LANGUAGES.find((l) => tag.toLowerCase().split("-")[0] === l);
        if (lang)
            return lang;
    }
    return "en";
}
export const resolveLanguage = (setting) => setting === "auto" ? systemLanguage() : setting;
export const dateLocale = () => language === systemLanguage() ? undefined : language;
export function onLanguageChange(listener) {
    listeners.push(listener);
}
export function setLanguage(lang) {
    if (lang === language)
        return;
    language = lang;
    if (typeof document !== "undefined") {
        document.documentElement.lang = lang;
        applyTranslations();
    }
    listeners.forEach((listener) => listener());
}
export function t(key, params = {}) {
    const text = catalogs[language][key] ?? en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (all, name) => (name in params ? String(params[name]) : all));
}
export function applyTranslations(root = document) {
    const keyOf = (el, attr) => el.getAttribute(attr);
    root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.innerHTML = t(keyOf(el, "data-i18n"));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.title = t(keyOf(el, "data-i18n-title"));
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
        el.setAttribute("aria-label", t(keyOf(el, "data-i18n-aria")));
    });
    root.querySelectorAll("[data-i18n-label]").forEach((el) => {
        const text = t(keyOf(el, "data-i18n-label"));
        el.title = text;
        el.setAttribute("aria-label", text);
    });
    root.querySelectorAll(".info-btn[data-info]").forEach((el) => {
        const text = t("settings.more-about", {
            name: t(`settings.${el.dataset.info}`),
        });
        el.title = text;
        el.setAttribute("aria-label", text);
    });
    if (root === document) {
        document.title = t("app.title");
        document
            .querySelector('meta[name="description"]')
            ?.setAttribute("content", t("app.description"));
    }
}
//# sourceMappingURL=i18n.js.map