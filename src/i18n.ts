// Texts of the app: the keys and the English texts are in messages_en.ts, the
// German ones in messages_de.ts. `t` gives the text for a key in the current
// language, `applyTranslations` fills the static texts of index.html (elements
// with data-i18n attributes).
import { en, MessageKey } from "./messages_en.js";
import { de } from "./messages_de.js";

export type { MessageKey };
export type Messages = { readonly [K in MessageKey]: string };
export type Lang = "en" | "de";
/** The language setting: "auto" follows the system */
export type LanguageSetting = "auto" | Lang;

export const LANGUAGES: Lang[] = ["en", "de"];

const catalogs: { [lang in Lang]: Messages } = { en, de };
let language: Lang = "en";
const listeners: (() => void)[] = [];

export function getLanguage(): Lang {
  return language;
}

/** The language of the system (the first of its languages that the app has, otherwise English) */
export function systemLanguage(): Lang {
  const preferred = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language];
  for (const tag of preferred) {
    const lang = LANGUAGES.find((l) => tag.toLowerCase().split("-")[0] === l);
    if (lang) return lang;
  }
  return "en";
}

/** The language for a language setting */
export const resolveLanguage = (setting: LanguageSetting): Lang =>
  setting === "auto" ? systemLanguage() : setting;

/**
 * Locale for the dates: the one of the system when the app has its language,
 * otherwise the language of the app
 */
export const dateLocale = (): string | undefined =>
  language === systemLanguage() ? undefined : language;

/** Registers a function that updates the texts that are not static, called after the language changed */
export function onLanguageChange(listener: () => void) {
  listeners.push(listener);
}

/**
 * Sets the language: the static texts are replaced, then the listeners update
 * the other ones (lists, timer, ...). Nothing happens if it is the same language.
 */
export function setLanguage(lang: Lang) {
  if (lang === language) return;
  language = lang;
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    applyTranslations();
  }
  listeners.forEach((listener) => listener());
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
