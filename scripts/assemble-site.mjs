// Assembles the deployable site (also the web content of the Android app)
// in _site/ from the compiled sources. Run `npm run build` first.
//
// src/ references its siblings as "../dist" and "../assets"; in the site,
// index.html lives next to dist/ and assets/, so those paths are rewritten.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const out = "_site";
const build = (process.env.GITHUB_SHA ?? "dev").slice(0, 10);

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ["index.html", "style.css", "manifest.webmanifest", "sw.js", "privacy.html", "sitemap.xml"]) {
  cpSync(`src/${f}`, `${out}/${f}`);
}
cpSync("dist", `${out}/dist`, { recursive: true });
cpSync("assets", `${out}/assets`, { recursive: true });

const rewrite = (file, f) => writeFileSync(file, f(readFileSync(file, "utf8")));
const flatten = (s) => s.replaceAll('"../', '"./');
for (const f of ["index.html", "manifest.webmanifest"]) {
  rewrite(`${out}/${f}`, flatten);
}
for (const f of ["main", "html_util", "sudoku", "storage", "settings", "pages", "history"]) {
  rewrite(`${out}/dist/${f}.js`, flatten);
}
// Version shown on the About page: from package.json and the commit
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
rewrite(`${out}/index.html`, (s) =>
  s.replaceAll("__VERSION__", `${version} (build ${build}${process.env.DEV_BUILD ? ", test build" : ""})`)
);

// New service worker cache per release
rewrite(`${out}/sw.js`, (s) => s.replaceAll("__BUILD__", build));

// Test build of a branch (DEV_BUILD=1, see .github/workflows/deploy-dev.yml): it
// is served from the same origin as the real app, so it gets its own stored data
// (the keys of the settings, the history and the saved game), its own service
// worker caches, and says "(dev)" in its names.
if (process.env.DEV_BUILD) {
  const dev = (s) =>
    s
      .replaceAll("serious-sudoku:", "serious-sudoku-dev:")
      .replaceAll("Serious Sudoku", "Serious Sudoku (dev)");
  for (const f of ["index.html", "manifest.webmanifest"]) rewrite(`${out}/${f}`, dev);
  // (the texts of the app name are in the messages)
  for (const f of ["main", "html_util", "storage", "settings", "pages", "history", "messages_en", "messages_de"]) {
    rewrite(`${out}/dist/${f}.js`, dev);
  }
  rewrite(`${out}/sw.js`, (s) => s.replace('"sudoku-', '"dev-sudoku-'));
}
// Search engines: the test build of a branch must not be indexed (it would
// compete with the real page), it has no sitemap and its own address.
if (process.env.DEV_BUILD) {
  rmSync(`${out}/sitemap.xml`);
  for (const f of ["index.html", "privacy.html"]) {
    rewrite(`${out}/${f}`, (s) =>
      s
        .replace('<meta name="robots" content="index, follow" />', '<meta name="robots" content="noindex, nofollow" />')
        .replace(/ *<link rel="canonical"[^>]*>\n/, "")
    );
  }
}

// The static texts of the page in English (crawlers and browsers without
// JavaScript see them, the app replaces them in the language of the user, see
// src/i18n.ts). Elements like <span data-i18n="menu.help"></span> get their text.
const { en } = await import(pathToFileURL(resolve(out, "dist/messages_en.js")).href);
rewrite(`${out}/index.html`, (s) =>
  s.replace(
    /(<([a-z0-9]+)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)(<\/\2>)/g,
    (all, open, tag, key, close) => (key in en ? open + en[key] + close : all)
  )
);

console.log(`Assembled ${out}/ (build ${build}${process.env.DEV_BUILD ? ", dev" : ""})`);
