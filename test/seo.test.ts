import * as fs from "fs";
import * as path from "path";
import { en } from "../src/messages_en";
import { de } from "../src/messages_de";

const root = path.join(__dirname, "..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const html = read("src/index.html");
const URL_ = "https://chrisbaumann.ch/serious-sudoku/";

const meta = (attr: string, name: string): string => {
  const m = new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html);
  expect(m).not.toBeNull();
  return m![1];
};

test("title and description of the page and of both languages have a good length", () => {
  for (const texts of [en, de]) {
    expect(texts["app.title"].length).toBeLessThanOrEqual(60);
    expect(texts["app.title"]).toContain("Serious Sudoku");
    expect(texts["app.description"].length).toBeGreaterThan(70);
    expect(texts["app.description"].length).toBeLessThanOrEqual(160);
  }
  // the page as the crawler gets it (before the script runs): the English ones
  expect(/<title>([^<]*)<\/title>/.exec(html)![1]).toBe(en["app.title"]);
  expect(meta("name", "description")).toBe(en["app.description"]);
  expect(meta("property", "og:title")).toBe(en["app.title"]);
  expect(meta("property", "og:description")).toBe(en["app.description"]);
  expect(html).toContain('<html lang="en">');
});

test("canonical address, robots and social card", () => {
  expect(html).toContain(`<link rel="canonical" href="${URL_}" />`);
  expect(meta("name", "robots")).toBe("index, follow");
  expect(meta("property", "og:url")).toBe(URL_);
  const image = meta("property", "og:image");
  expect(image.startsWith(URL_ + "assets/")).toBe(true);
  expect(fs.existsSync(path.join(root, image.slice(URL_.length)))).toBe(true);
});

test("structured data is valid JSON for the web app", () => {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  expect(m).not.toBeNull();
  const data = JSON.parse(m![1]);
  expect(data["@type"]).toBe("WebApplication");
  expect(data.url).toBe(URL_);
  expect(data.description).toBe(en["app.description"]);
  expect(data.offers.price).toBe("0");
});

test("the sitemap lists the page and the privacy policy", () => {
  const sitemap = read("src/sitemap.xml");
  expect(sitemap).toContain(`<loc>${URL_}</loc>`);
  expect(sitemap).toContain(`<loc>${URL_}privacy.html</loc>`);
  expect(fs.existsSync(path.join(root, "src/privacy.html"))).toBe(true);
});
