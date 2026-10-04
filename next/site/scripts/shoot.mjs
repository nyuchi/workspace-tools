// Screenshots every page of the site at 375, 768, 1280 and 1920px (dark),
// plus 1280px light, and fails if any page scrolls sideways at 320px.
// Needs puppeteer-core and a local Chrome; not a site dependency:
//   npx -p puppeteer-core node scripts/shoot.mjs http://127.0.0.1:8787 out

// Arguments: <base-url> <out-dir> [file-name prefix]
// Screenshots each page at four widths (full page) and reports horizontal
// overflow, including at 320px.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const [base, out, label = ""] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const pages = [
  ["home", "/"],
  ["studio", "/studio"],
  ["presets", "/presets"],
  ["signatures", "/signatures"],
];
const widths = [320, 375, 768, 1280, 1920];
const browser = await puppeteer.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
await page.emulateMediaFeatures([
  { name: "prefers-color-scheme", value: "dark" },
]);
let bad = 0;
for (const [name, path] of pages) {
  for (const w of widths) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    await page.goto(base + path, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    const o = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
    }));
    const flag = o.sw > o.iw ? `OVERFLOW ${o.sw}>${o.iw}` : "ok";
    if (o.sw > o.iw) bad++;
    console.log(`${name.padEnd(11)} ${String(w).padStart(4)} ${flag}`);
    if (w !== 320)
      await page.screenshot({
        path: `${out}/${label}${name}-${w}.png`,
        fullPage: true,
      });
  }
}
// Light mode at 1280, every page.
await page.emulateMediaFeatures([
  { name: "prefers-color-scheme", value: "light" },
]);
for (const [name, path] of pages) {
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto(base + path, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({
    path: `${out}/${label}${name}-1280-light.png`,
    fullPage: true,
  });
}
await browser.close();
process.exit(bad ? 1 : 0);
