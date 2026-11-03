import * as fs from "fs";
import * as path from "path";
import { t, setLanguage, getLanguage, resolveLanguage } from "../src/i18n";
import { en } from "../src/messages_en";
import { de } from "../src/messages_de";
import { LEVEL_COUNT } from "../src/sudoku";

const srcDir = path.join(__dirname, "..", "src");
const read = (f: string) => fs.readFileSync(path.join(srcDir, f), "utf8");
const keys = Object.keys(en);

test("texts with placeholders", () => {
  expect(t("level.other", { n: 9 })).toBe("Level 9");
  // a placeholder without a value stays
  expect(t("level.other")).toBe("Level {n}");
  expect(t("win.time", { time: "1:23" })).toBe("Time: 1:23");
});

test("there is a name for every level", () => {
  for (let level = 0; level < LEVEL_COUNT; ++level) {
    expect(keys).toContain(`level.${level}`);
  }
  expect(keys).not.toContain(`level.${LEVEL_COUNT}`);
});

test("every key used in the code and in index.html exists", () => {
  const html = read("index.html");
  const used = new Set<string>();
  for (const m of html.matchAll(/data-i18n(?:-title|-aria|-label)?="([^"]+)"/g)) used.add(m[1]);
  for (const f of fs.readdirSync(srcDir).filter((f) => f.endsWith(".ts"))) {
    // t("key", ...) and the keys of the typed lists ("area.name": ...)
    for (const m of read(f).matchAll(/\bt\(\s*"([a-z0-9.-]+)"/g)) used.add(m[1]);
  }
  expect(used.size).toBeGreaterThan(50);
  for (const key of used) expect(keys).toContain(key);
});

test("every text is used", () => {
  const code = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".ts") && !f.startsWith("messages_"))
    .map(read)
    .join("\n");
  const html = read("index.html");
  for (const key of keys) {
    if (key.startsWith("level.") && key !== "level.other") continue; // level.<n>
    expect([key, code.includes(`"${key}"`) || html.includes(`"${key}"`)]).toEqual([key, true]);
  }
});

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
const tags = (text: string) => (text.match(/<[^>]+>/g) ?? []).join("");

test("the German texts have the same keys, placeholders and links as the English ones", () => {
  expect(Object.keys(de).sort()).toEqual(keys.slice().sort());
  for (const key of keys as (keyof typeof en)[]) {
    expect([key, de[key].trim() !== ""]).toEqual([key, true]);
    expect([key, placeholders(de[key])]).toEqual([key, placeholders(en[key])]);
    expect([key, tags(de[key])]).toEqual([key, tags(en[key])]);
  }
});

test("switching the language", () => {
  expect(resolveLanguage("de")).toBe("de");
  expect(resolveLanguage("en")).toBe("en");
  setLanguage("de");
  expect(getLanguage()).toBe("de");
  expect(t("win.time", { time: "1:23" })).toBe("Zeit: 1:23");
  setLanguage("en");
  expect(t("win.time", { time: "1:23" })).toBe("Time: 1:23");
});
