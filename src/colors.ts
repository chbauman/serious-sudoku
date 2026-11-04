// The colors of the app. The values are CSS variables in style.css (`:root` is
// the light theme, the dark theme is defined there twice: for the system
// setting and for the forced one). The code only uses the colors by the names
// here, never by literal values; test/colors.test.ts checks that everything
// matches.

export const color = {
  /** Text */
  text: "var(--fg)",
  /** Digits that the user sets, active buttons */
  accent: "var(--accent)",
  /** Disabled buttons */
  disabled: "var(--disabled)",
  /** Digits of a guess (hypothesis) */
  guess: "var(--hyp)",
  /** Digits (and cells) that are wrong */
  wrong: "var(--wrong)",
  /** Digits that the solver filled in */
  solved: "var(--solved)",
  /** The selected cell */
  selected: "var(--selected-bg)",
  /** Cells in the row, column and block of the selected cell */
  sameUnit: "var(--forbid-bg)",
  /** Cells with the same digit as the selected cell */
  sameDigit: "var(--same-bg)",
  /** Empty cells that have the digit of the selected cell as a pencil mark */
  pencilMatch: "var(--small-dig-bg)",
} as const;

/**
 * Background of the page per theme, for the theme-color of the browser / app UI
 * (the same as --bg in style.css and the theme-color meta tags in index.html)
 */
export const THEME_BG = { light: "#ffffff", dark: "#16181d" } as const;
