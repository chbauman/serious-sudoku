// Texts of the app: the keys and the English texts are in messages_en.ts. `t`
// gives the text for a key in the current language, `applyTranslations` fills
// the static texts of index.html (elements with data-i18n attributes).
import { en, MessageKey } from "./messages_en.js";

export type { MessageKey };
export type Messages = { readonly [K in MessageKey]: string };
export type Lang = "en";

const catalogs: { [lang in Lang]: Messages } = { en };
let language: Lang = "en";

export function getLanguage(): Lang {
  return language;
}

export function setLanguage(lang: Lang) {
  language = lang;
}

/** The text for a key in the current language, {name} replaced by params["name"] */
export function t(key: MessageKey, params: { [name: string]: string | number } = {}): string {
  const text: string = catalogs[language][key] ?? en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (all, name) => (name in params ? String(params[name]) : all));
}

/**
 * Fills the texts of the page (or of a part of it). Attributes of the elements:
 * - data-i18n="key": the content (can have markup, e.g. links)
 * - data-i18n-title / data-i18n-aria="key": the title / aria-label
 * - data-i18n-label="key": the title and the aria-label
 * The info buttons of the settings (data-info="name") get "More about: <setting>".
 */
export function applyTranslations(root: ParentNode = document) {
  const keyOf = (el: HTMLElement, attr: string) => el.getAttribute(attr) as MessageKey;
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.innerHTML = t(keyOf(el, "data-i18n"));
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(keyOf(el, "data-i18n-title"));
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(keyOf(el, "data-i18n-aria")));
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-label]").forEach((el) => {
    const text = t(keyOf(el, "data-i18n-label"));
    el.title = text;
    el.setAttribute("aria-label", text);
  });
  root.querySelectorAll<HTMLElement>(".info-btn[data-info]").forEach((el) => {
    const text = t("settings.more-about", {
      name: t(`settings.${el.dataset.info}` as MessageKey),
    });
    el.title = text;
    el.setAttribute("aria-label", text);
  });
  if (root === document) document.title = t("app.name");
}
