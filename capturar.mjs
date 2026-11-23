// Capture a real, public web page for a reel (Playwright, clean logged-out browser: no profile, no cookies).
//
//   node capturar.mjs <url> <salida.png> [--selector "css"] [--texto "texto visible"] [--completa] [--ancho 900] [--claro]
//
//   --selector  capture only that element (e.g. "table", "pre", "#install")
//   --texto     capture the smallest block that contains this visible text (first match)
//   --completa  whole page (tall image, for a camera pan in the video)
//   --claro     light color scheme (default: dark, matches the brand)
// Exit codes: 0 ok, 2 bad arguments, 3 page did not load, 4 element not found.
// Rules (skill reel): only public pages listed in fuentes.md, never pages behind a login; the capture is not
// edited, only framed/zoomed in the video; crop out names or personal data.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const bool = (n) => { const i = args.indexOf(n); if (i >= 0) { args.splice(i, 1); return true; } return false; };
const selector = flag("--selector"), texto = flag("--texto"), ancho = +(flag("--ancho") || 900);
const completa = bool("--completa"), claro = bool("--claro");
const [url, out] = args;
if (!url || !out || !/^https:\/\//.test(url)) { console.error("uso: node capturar.mjs <https://...> <salida.png> [opciones]"); process.exit(2); }
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: ancho, height: Math.round(ancho * 1.22) }, deviceScaleFactor: 2,
  colorScheme: claro ? "light" : "dark", locale: "es-ES", acceptDownloads: false,
});
const page = await ctx.newPage();
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
} catch {
  try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }); }
  catch (e) { console.error(`ERROR: no cargó ${url}: ${e.message}`); await browser.close(); process.exit(3); }
}
// close cookie/consent banners when there is an obvious button (never log in, never accept anything else)
for (const name of [/^(accept|aceptar|allow all|accept all|aceptar todo|got it|ok|entendido)$/i, /^(reject|rechazar|decline)( all)?$/i]) {
  const b = page.getByRole("button", { name }).first();
  if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 2000 }).catch(() => {}); break; }
}
await page.waitForTimeout(1200);

// hide floating overlays (chat boxes, sticky bars) so they don't cover the captured part; the page itself is untouched
// (in a plain viewport capture only the ones in the lower half, so the site's own header stays)
await page.evaluate((all) => {
  for (const el of document.querySelectorAll("body *")) {
    const p = getComputedStyle(el).position;
    if (p !== "fixed" && p !== "sticky") continue;
    if (all || el.getBoundingClientRect().top > innerHeight * 0.5) el.style.setProperty("visibility", "hidden", "important");
  }
}, Boolean(selector || texto || completa));

let target = null;
if (selector) target = page.locator(selector).first();
else if (texto) {
  // smallest readable block that holds the text: a list item, table row, paragraph, code block or heading
  target = page.getByText(texto, { exact: false }).first()
    .locator("xpath=ancestor-or-self::*[self::li or self::tr or self::p or self::pre or self::h1 or self::h2 or self::h3 or self::blockquote][1]");
}
if (target) {
  await target.evaluate((el) => { el.style.setProperty("padding", "18px 22px", "important"); });
  if (!(await target.count())) { console.error(`ERROR: no encontré ${selector || texto}`); await browser.close(); process.exit(4); }
  await target.scrollIntoViewIfNeeded();
  await target.screenshot({ path: out });
} else {
  await page.screenshot({ path: out, fullPage: completa });
}
const host = new URL(url).hostname.replace(/^www\./, "");
fs.writeFileSync(out.replace(/\.png$/i, ".json"), JSON.stringify({ url, dominio: host, fecha: new Date().toISOString().slice(0, 10), selector: selector || null, texto: texto || null, completa }, null, 1));
await browser.close();
console.log(`ok ${out} (Captura: ${host})`);
