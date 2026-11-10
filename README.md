# Serious Sudoku

Serious Sudoku is a game of sudoku written in TypeScript as a mobile app.
Let's you solve the hardest sudokus by hand with depth-first search.
It allows you to guess a number and continue solving while being able to
return to the point of guessing. This process can be done in a nested way.
Try it at [chrisbaumann.ch/serious-sudoku](https://chrisbaumann.ch/serious-sudoku/), a screenshot (light and dark mode) is shown below.

![Screenshot of Serious Sudoku in light and dark mode](docs/screenshot.png)

The menu in the header opens the help, the settings and the history of your
solve times (light mode shown, the dark mode is available in the settings):

![Screenshots of the help, settings and history pages](docs/screenshot-pages.png)

Can you solve the one below? It was [devised by Arto Inkala, a Finnish mathematician,
and is specifically designed to be unsolvable to all but the sharpest minds.](https://www.telegraph.co.uk/news/science/science-news/9359579/Worlds-hardest-sudoku-can-you-crack-it.html)

<img src="https://secure.i.telegraph.co.uk/multimedia/archive/02260/Untitled-1_2260717b.jpg" alt="alt text" width="300px">

## Implementation

Built upon simpler JavaScript version found at https://github.com/baruchel/sudoku-js.
The icons are open source (Ionicons, MIT) and taken from https://ionicons.com/; they are inlined in `src/index.html`.

## Texts

All texts of the app are in one module, `src/messages_en.ts` (English, one entry per
key, placeholders like `{name}`). The code gets a text with `t(key, params)`
(`src/i18n.ts`); the static texts of `src/index.html` are empty elements with
`data-i18n="key"` (the content, may have markup like links), `data-i18n-title`,
`data-i18n-aria` or `data-i18n-label` (title and aria-label), which
`applyTranslations()` fills in when the app starts. The tests check that every key
that is used exists and that every text is used. The privacy policy
(`src/privacy.html`) and the web manifest are separate files and not part of it.

## Level files

The sudokus are in `assets/data/ext_lvl_<level>.txt` (levels 0 to 6: Beginner, Easy, Medium, Hard, Expert, Master and Grandmaster, see
`LEVEL_NAMES` in `src/sudoku.ts`), one per
line in the format of the generator in [sudoku-cpp](https://github.com/chbauman/sudoku-cpp):
`<description>;<puzzle>;<solution>`, where puzzle and solution are the 81
space separated cell values (0 = empty) and the description is
`<level>,<number of givens>,<digit frequencies>`.

The level is the level of the generator (see the difficulty level section of
the sudoku-cpp README): level 0 (Beginner) can be solved with only two rules
(a number that fits in only one cell of a square, the last empty cell of a row or
column), level 1 (Easy) with the basic rules (also a cell with one candidate left
and a number that fits in only one cell of a row or column). Level 2 (Medium) can
be solved without any guess, the others need nested guesses (the depth of the
search tree when guessing a cell with n candidates or a number that fits in n
cells of a row, column or square, with the smallest n). Level 6 (Grandmaster),
which holds everything from the level 6 of the generator on, is the hardest. All
sudokus have a unique solution and no given can be removed.

The files are built from collections of the sudoku-cpp generator with

```
$ node scripts/make-levels.mjs path/to/generated_dat.txt [more.txt ...]
```

which removes duplicates and puts all levels above the top level into the top
level (`TOP_LEVEL` in the script, to be kept in sync with `MAX_LEVEL` in
`src/sudoku.ts` and the number of files in `src/sw.js`; the tests check the
files). Each loaded puzzle is shuffled (digits, rows within their
bands, columns within their stacks, bands, stacks, transposition), which keeps
its level.

## Menu, pages and settings

The hamburger menu in the header opens the Help, Settings, History and About pages (the About page has the links to the sources, the author and the privacy policy). The pages are sections of the single
`index.html`, selected by the URL hash (`#help`, `#settings`, ...), so the browser and
Android back buttons work and the game state is kept while a page is open.
Settings (stored like the saved game, see `src/settings.ts`): the level that is
loaded when there is no saved game, the appearance (system / light / dark),
the practice mode (off by default: the solves are listed in the history with a
practice icon instead of a time and do not count for the best times; it
can be switched at any time, the mode when the sudoku is finished counts), independent of
it whether the time is shown below the buttons (on by default; the solving is
timed anyway) and whether solves with auto-filled pencil marks (the
magic wand) count for the best times (off by default).

The app works in portrait and landscape and on large screens (tablets, foldables, resizable windows): on short landscape screens the grid is on the left and takes the whole height, the title with the menu, the digits and the buttons are on the right (`src/style.css`). The Android app draws behind the system bars (edge-to-edge, `MainActivity`), the Capacitor SystemBars plugin pads the web view by the insets.

In the Android app the back button / gesture closes the open dialog or menu,
returns from a page to the game and only closes the app from the game. This
needs the Capacitor App plugin (`@capacitor/app`), which is not part of the
Capacitor core; it is called through the bridge in
`setupAndroidBack` (`src/pages.ts`).

Each digit button shows how many of its digit are set in the grid, and the
digit is crossed out when all nine are set. Below the buttons the level of the
sudoku is shown next to the solving time.

Clicking anywhere deselects the selected cell, except on dialogs and the
buttons that open them, the header buttons and menu, and the digit pad (the
digit buttons also react between them).

## History (personal leaderboard)

The time to solve a sudoku (only the time the game page is visible, restarting
the sudoku restarts the clock), the level, the puzzle ID (`<level>-<line in the
level file>`), the sudoku itself as it is in the level file (81 digits, 0 =
empty, before it is shuffled, so that the solves can be rated again if the
levels change) and whether the pencil marks
were filled in automatically (the magic wand) are stored when you finish a
sudoku without the solver; custom sudokus are not recorded. The History page
has the leaderboard (per level: the best time, its date and a button for more:
the best solve, a table with the number of solves and the average time without
help, using help (the wand, if there are any) and all of them, and all solves of the level) and the 10 most recent solves, each with a button for its details
(level, date, time). Solves with the magic wand are marked (left of the time)
and only count for the best time if the setting says so, or as long as the level was
never solved without help (then the wand is shown in front of the best time).
Practice solves never count. A solve can be replayed from its details ("Replay":
the same sudoku, shuffled like every sudoku), if its sudoku is stored. The win dialog congratulates
(a short message, the next level to try) and shows the time and whether it is a new best;
it is shown once per sudoku (not again after taking back a digit, and not after using
the solver). A new sudoku starts in the digit mode (not the pencil marks). The version
is shown on the About page. The data stays on the device (same
storage as the saved game, see below), there is no server; the last 500 solves
are kept.

## Achievements

The menu has an Achievements page (32 of them: a sudoku of every level solved, and every level
in under 5 minutes, solved in practice mode, after filling in the pencil marks, after finding the
mistakes, with a guess, after rejecting a guess, a sudoku started with Replay, a sudoku you entered
yourself (without help), 10, 20, 50 and 100 sudokus solved in total (without help), Hard or higher without any guess, without any pencil mark, the top level without pencil marks, more than an
hour for a sudoku, guessing 4 levels deep, and finishing with all nine cells of one digit set last,
after all the other digits are complete, and leaving one 3×3 square empty, with only its given
digits, until the rest of the board is complete (at least 5 empty cells). The page lists the ones that are done (the hardest
first) and the next 3 open ones, each as a round trophy (blue if done, grey if open) with its
name; tapping it opens the details (what to do, and when it was unlocked). Practice solves and
solves with help only earn the three that are for them (`src/achievements.ts` has the rules). They
are checked when a sudoku is solved and shown in the same style in the win dialog. The ones
that only need what the history has (level, time, practice mode, help) are also given for the
solves that are already in the history, when the page is loaded, with the date of the solve.
The total of solves without help is counted from the history and kept with the achievements
(the history keeps only the last 500 solves). For the others the game keeps a few facts (pencil marks used, deepest guess, a rejected guess, started with Replay, last digit, last square),
saved with the game (a game saved by an older version counts as "pencil marks used").
The done ones are listed the hardest first (not by date), the open ones the easiest first.
They are stored with the history (`serious-sudoku:achievements:v1`).

Custom sudokus (Tools, "Input own sudoku"): any sudoku can be entered. It is only
analysed when "Mark mistakes" or "Solve" is requested: `solveSudoku`
(`src/sudoku.ts`, backtracking that fills the cell with the fewest candidates and
stops after 2 solutions) solves its givens. With exactly one solution the tools
work as for the other sudokus; a sudoku without a solution is reported, for one
with several solutions a warning is shown first (the mistakes are marked against one
of the solutions, "Solve" fills in one of them). Custom sudokus are not recorded in the history.

## Saved game

The current game (digits, pencil marks and guesses) is stored in the
browser's `localStorage` (in the Android app additionally in the native
Preferences, see `src/storage.ts`: the WebView writes `localStorage` to disk
lazily, so a game could be lost when the app was swiped away right after a
move) after every move, so reloading the page (easily done
by accident on mobile) continues where you left off. Solving a sudoku, loading
a new one or clearing the site data starts a fresh game. The undo history is
not saved.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Arrow keys | Move the selected cell (starts at the top left) |
| `1`-`9` | Enter the digit (or toggle the pencil mark in pencil mode) |
| `Delete` / `Backspace` / `0` | Clear the selected cell |
| `Ctrl`/`Cmd` + `Z` | Undo (digits, pencil marks, autofill, rejected guesses) |

## Development

Requires `Node.js`. Everything is run through npm:

```
$ npm install     # install dependencies
$ npm run build   # compile TypeScript to dist/
$ npm run watch   # recompile on changes
$ npm start       # build and serve at http://localhost:8080/src/index.html
$ npm run dev     # watch + serve
$ npm test        # run the jest tests
```

The port may differ if 8080 is already in use.
The local dev server does not register the service worker (see below).

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs the tests,
builds the TypeScript (`dist/` is not committed) and publishes the site to the
`gh-pages` branch (site root = `src/` contents plus `dist/` and `assets/`).
In the repository settings, set Pages to deploy from the `gh-pages` branch
(root). The page is then available at the default GitHub Pages address,
<https://chrisbaumann.ch/serious-sudoku/>. All paths are relative, so it works
under the `/serious-sudoku/` sub-path.

### Test build of a branch

Every push to a branch other than `main` triggers `.github/workflows/deploy-dev.yml`,
which runs the tests and publishes that build under `dev/` of the site,
<https://chrisbaumann.ch/serious-sudoku/dev/> (it overwrites the build of the
previous push, so it always shows the branch that was pushed last). The test
build is served from the same origin as the real app, so `npm run assemble` with
`DEV_BUILD=1` gives it its own stored data (`serious-sudoku-dev:` keys), its own
service worker caches (`dev-sudoku-...`) and the name "Serious Sudoku (dev)".
The deployment of `main` keeps the `dev/` folder, and the two workflows wait for
each other (they push to the same `gh-pages` branch).

### Search engines

`src/index.html` has what search engines need: title and description (also in
German, set by the script), canonical address, Open Graph / Twitter card
(`assets/social-card.png`), structured data (`WebApplication`) and the English
texts of all pages in the HTML itself (filled in by `scripts/assemble-site.mjs`,
so they are there before the script runs). `src/sitemap.xml` lists the page and
the privacy policy. The test build in `dev/` is marked `noindex` and has no
sitemap. A `robots.txt` has to be at the root of the domain
(`https://chrisbaumann.ch/robots.txt`), a `Sitemap:` line there can point to
<https://chrisbaumann.ch/serious-sudoku/sitemap.xml>; it can also be submitted in
the Google Search Console.

## Installable / offline (PWA)

The deployed page is an installable web app (`src/manifest.webmanifest`) and
works offline: `src/sw.js` is a service worker that precaches the app, the
icons and all level files. On deploy the cache name gets the commit hash, so
every release replaces the cached version. The service worker is not
registered when the page is served from `/src/` (local dev), so changes show
up immediately while developing.

## Android app

The Android app is a thin [Capacitor](https://capacitorjs.com) wrapper around
the same web app: `npm run assemble` builds the site into `_site/` (the same
step that is deployed to GitHub Pages) and `npx cap sync android` copies it
into the Android project in `android/`. There is no separate Android code to
maintain; the app works offline because all files are bundled.

The workflow `.github/workflows/android.yml` builds a debug APK on every push
to `main` and for pull requests that touch the app (Actions run -> Artifacts ->
`serious-sudoku-debug-apk`). The APK is named after the app and the build, e.g.
`serious-sudoku-1.2-build57-1a2b3c4-debug.apk`. To install it, copy it to the phone and open
it (allow installing from unknown sources). To build locally you need Node 22,
JDK 21 and the Android SDK:

```
$ npm run assemble
$ npx cap sync android
$ cd android && ./gradlew assembleDebug   # android/app/build/outputs/apk/debug/serious-sudoku-1.2-local-debug.apk
```

All debug APKs (CI and local) are signed with the same debug key,
`android/app/debug.keystore` (committed on purpose, it is not a secret), so a
debug APK can be installed over an older one, which keeps the app data (saved
game, history, settings): open the new APK on the phone or run
`adb install -r serious-sudoku-*-debug.apk`. Switching to a release build (other
signing key) needs an uninstall once, which deletes the app data.

The data in the browser and in the app is stored under the keys `serious-sudoku:settings:v1`,
`serious-sudoku:history:v1` and `serious-sudoku:game:v1`.

In CI the version code of the APK is the run number of the workflow and the
version name shows it with the commit (`1.2 (build 57, 1a2b3c4)`, see the app
info of the phone), so each CI build is newer than the one before. Local
builds have the version code 1; installing one over a CI build is a downgrade
and needs `adb install -r -d serious-sudoku-*-debug.apk`.

A signed release bundle for the Play Store is built by the workflow
`.github/workflows/android-release.yml`; the setup and the store listing material
are described in [`docs/play-store/`](docs/play-store/README.md).
