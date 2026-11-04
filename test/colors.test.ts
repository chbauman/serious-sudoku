import * as fs from "fs";
import * as path from "path";
import { color, THEME_BG } from "../src/colors";

const srcDir = path.join(__dirname, "..", "src");
const read = (f: string) => fs.readFileSync(path.join(srcDir, f), "utf8");
const css = read("style.css");

/** The variables (--name: value) defined in the block that starts with the selector */
function variables(selector: string, last = false): { [name: string]: string } {
  // (the forced dark theme: the first block only sets color-scheme)
  const start = last ? css.lastIndexOf(selector + " {") : css.indexOf(selector + " {");
  expect(start).toBeGreaterThanOrEqual(0);
  const block = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const vars: { [name: string]: string } = {};
  for (const m of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].replace(/\s*\/\*.*$/, "").trim();
  return vars;
}

const light = variables(":root");
const darkAuto = variables(':root:not([data-theme="light"])');
const darkForced = variables(':root[data-theme="dark"]', true);

test("the dark theme is defined the same way for the system setting and for the setting", () => {
  expect(darkAuto).toEqual(darkForced);
  expect(Object.keys(darkAuto).length).toBeGreaterThan(10);
});

test("every color of the code is defined in all themes", () => {
  for (const value of Object.values(color)) {
    const name = /var\((--[\w-]+)\)/.exec(value)![1];
    expect([name, name in light]).toEqual([name, true]);
    expect([name, name in darkAuto]).toEqual([name, true]);
  }
});

test("every variable that is used is defined, and every dark one has a light one", () => {
  for (const m of css.matchAll(/var\((--[\w-]+)\)/g)) {
    expect([m[1], m[1] in light]).toEqual([m[1], true]);
  }
  for (const name of Object.keys(darkAuto)) expect([name, name in light]).toEqual([name, true]);
});

test("the theme colors of the browser are the backgrounds", () => {
  expect(THEME_BG.light).toBe(light["--bg"] === "#fff" ? "#ffffff" : light["--bg"]);
  expect(THEME_BG.dark).toBe(darkAuto["--bg"]);
  const html = read("index.html");
  expect(html).toContain(`content="${THEME_BG.light}" media="(prefers-color-scheme: light)"`);
  expect(html).toContain(`content="${THEME_BG.dark}" media="(prefers-color-scheme: dark)"`);
});

test("no literal colors outside of style.css", () => {
  for (const f of fs.readdirSync(srcDir).filter((f) => f.endsWith(".ts") && f !== "colors.ts" && !f.startsWith("messages_"))) {
    const code = read(f);
    expect([f, /["'`]#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(code)]).toEqual([f, false]);
  }
  // in the stylesheet only the definitions of the variables have them
  const outside = css
    .split("\n")
    .filter((line) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(line) && !/^\s*--[\w-]+:/.test(line));
  expect(outside).toEqual([]);
});
