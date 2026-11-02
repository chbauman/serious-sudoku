import { en } from "./messages_en.js";
const catalogs = { en };
let language = "en";
export function getLanguage() {
    return language;
}
export function setLanguage(lang) {
    language = lang;
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
    if (root === document)
        document.title = t("app.name");
}
//# sourceMappingURL=i18n.js.map