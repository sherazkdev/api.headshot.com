import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "http://127.0.0.1:3001";
const OUT = path.resolve("qa/screenshots");
const envFile = await readFile(path.resolve(".env"), "utf8");
const env = Object.fromEntries(
  envFile
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const PASSWORD = process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD || "";

const PAGES = [
  ["login", "/login"],
  ["overview", "/"],
  ["users", "/users"],
  ["user-detail", "/users/usr_8f3a7b2c9d1e"],
  ["credits", "/credits"],
  ["transactions", "/transactions"],
  ["subscriptions", "/subscriptions"],
  ["headshots", "/headshots"],
  ["job-detail", "/headshots/JOB-5X9A1B2C"],
  ["branding", "/branding"],
  ["reviews", "/reviews"],
  ["projects", "/projects"],
  ["notifications", "/notifications"],
  ["fcm", "/fcm"],
  ["ai-usage", "/ai-usage"],
  ["jobs", "/jobs"],
  ["webhooks", "/webhooks"],
  ["api-keys", "/api-keys"],
  ["remote-config", "/remote-config"],
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 1024 },
  small: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

async function shot(page, file) {
  await mkdir(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem("headshot-admin-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("input").nth(1).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 }).catch(() => undefined);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
const page = await context.newPage();
page.setDefaultTimeout(20000);

await login(page);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

for (const theme of ["light", "dark"]) {
  await setTheme(page, theme);
  for (const [name, href] of PAGES) {
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    await shot(page, path.join(OUT, name, `${theme}-round-1.png`));
    await shot(page, path.join(OUT, name, `${theme}-round-2.png`));
    await shot(page, path.join(OUT, name, `${theme}-final.png`));
  }
}

await page.setViewportSize(VIEWPORTS.small);
await setTheme(page, "light");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await shot(page, path.join(OUT, "overview", "light-desktop-1280.png"));

await page.setViewportSize(VIEWPORTS.tablet);
await page.goto(`${BASE}/users`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await shot(page, path.join(OUT, "users", "light-tablet.png"));
await setTheme(page, "dark");
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await shot(page, path.join(OUT, "users", "dark-tablet.png"));

await page.setViewportSize(VIEWPORTS.mobile);
await setTheme(page, "light");
await page.goto(`${BASE}/api-keys`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await shot(page, path.join(OUT, "api-keys", "light-mobile.png"));
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await shot(page, path.join(OUT, "login", "light-mobile.png"));

await writeFile(
  path.join(OUT, "..", "qa-report.json"),
  JSON.stringify({ capturedAt: new Date().toISOString(), pageErrors: errors, pages: PAGES.map(([n]) => n) }, null, 2),
);

await browser.close();
console.log("captured", PAGES.length, "pages x 2 themes");
