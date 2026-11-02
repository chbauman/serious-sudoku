// Regenerates the screenshots of the README (docs/) and of the Play Store
// listing (docs/play-store/screenshots/) with example data.
//
//   npm run assemble
//   npm install --no-save playwright   # once, a Chromium is needed
//   node scripts/screenshots.mjs
//
// The built site (_site/) is served locally, the game and the history are
// made up (no data of the user is used).
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Playwright is no dependency of the project (it is only needed here): the
// local or a global installation (NODE_PATH) is used
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  try {
    ({ chromium } = createRequire(import.meta.url)("playwright"));
  } catch {
    console.error("Playwright is missing: npm install --no-save playwright");
    process.exit(1);
  }
}

const root = join(fileURLToPath(import.meta.url), "..", "..");
const site = join(root, "_site");
const docs = join(root, "docs");
const store = join(docs, "play-store", "screenshots");

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

// Serves _site/ on a free port
const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(site, path.endsWith("/") ? path + "index.html" : path);
    if (!file.startsWith(site)) throw new Error("outside");
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const URL_ = `http://127.0.0.1:${server.address().port}/`;

// Example solves, relative to 2 Nov 2026
const day = (n) => new Date(Date.UTC(2026, 10, 2, 12) - n * 864e5).toISOString();
const solve = (level, min, sec, daysAgo, extra = {}) => ({
  id: `${level}-${10 + level * 7 + daysAgo}`,
  level,
  seconds: min * 60 + sec,
  date: day(daysAgo),
  ...extra,
});
const HISTORY = [
  solve(1, 7, 12, 24), solve(1, 6, 26, 20), solve(1, 6, 51, 13),
  solve(2, 10, 40, 22), solve(2, 9, 8, 18), solve(2, 9, 57, 9),
  solve(2, 11, 5, 3, { autoFill: true }), solve(2, 10, 12, 1),
  solve(3, 22, 31, 19), solve(3, 14, 5, 15), solve(3, 20, 10, 10),
  solve(3, 29, 48, 6), solve(3, 16, 2, 2, { mistakes: true }),
  solve(4, 35, 5, 16), solve(4, 32, 30, 8),
  solve(5, 43, 30, 12),
].sort((a, b) => a.date.localeCompare(b.date)); // oldest first, as stored

const browser = await chromium.launch();

/**
 * Screenshots (PNG buffers) of one viewport size: the game in light and dark
 * mode, then the given pages.
 */
async function shoot(width, height, scale, pages) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    locale: "en-US",
  });
  const page = await context.newPage();
  await page.clock.install(); // the timer below the buttons is set with this
  await page.goto(URL_);
  await page.waitForTimeout(1200);
  await page.evaluate(
    (h) => localStorage.setItem("serious-sudoku:history:v1", JSON.stringify(h)),
    HISTORY
  );

  // The game: all pencil marks, then some digits that are the only candidate
  await page.click("#tools-btn");
  await page.click("#auto-fill-button");
  await page.click("#confirm-yes");
  for (let k = 0; k < 14; k++) {
    const single = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#grid > tbody > tr")];
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          const marks = [...rows[i].children[j].querySelectorAll("td")]
            .map((m) => m.textContent.trim())
            .filter(Boolean);
          if (marks.length === 1) return [i, j, marks[0]];
        }
      }
      return null;
    });
    if (!single) break;
    await page.locator("#grid > tbody > tr").nth(single[0]).locator("> td").nth(single[1]).click();
    await page.click(`#digit-${single[2]}`);
  }
  await page.clock.runFor(252000); // 4:12 on the timer
  await page.waitForTimeout(300);
  await page.locator("#grid > tbody > tr").nth(1).locator("> td").nth(4).click();

  const shots = {};
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    shots[`game-${scheme}`] = await page.screenshot();
  }
  await page.emulateMedia({ colorScheme: "light" });
  for (const name of pages) {
    await page.goto(`${URL_}#${name}`);
    await page.reload();
    await page.waitForTimeout(900);
    shots[name] = await page.screenshot();
  }
  await context.close();
  return shots;
}

/** Puts PNG buffers next to each other */
async function sideBySide(images) {
  const page = await browser.newPage({ viewport: { width: 390 * images.length, height: 740 } });
  await page.setContent(
    '<body style="margin:0;display:flex">' +
      images
        .map((b) => `<img src="data:image/png;base64,${b.toString("base64")}">`)
        .join("") +
      "</body>"
  );
  const out = await page.screenshot();
  await page.close();
  return out;
}

await mkdir(store, { recursive: true });

// README: 390x740 pixels per page
const web = await shoot(390, 740, 1, ["help", "settings", "history"]);
await writeFile(join(docs, "screenshot.png"), await sideBySide([web["game-light"], web["game-dark"]]));
await writeFile(
  join(docs, "screenshot-pages.png"),
  await sideBySide([web.help, web.settings, web.history])
);

// Play Store: 1080x1920 pixels (360x640 at 3x)
const play = await shoot(360, 640, 3, ["help", "history"]);
await writeFile(join(store, "1-game-light.png"), play["game-light"]);
await writeFile(join(store, "2-game-dark.png"), play["game-dark"]);
await writeFile(join(store, "3-history.png"), play.history);
await writeFile(join(store, "4-help.png"), play.help);

await browser.close();
server.close();
console.log("Screenshots written to docs/");
